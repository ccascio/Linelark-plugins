// GitHub — a git client in the side panel.
//
// Everything here is local git. The panel shows what has changed, what is staged, what the
// branch is against its remote, and lets you stage, commit, fetch, pull and push without
// leaving the editor. The optional half at the bottom asks github.com about pull requests
// and checks, and only once you have signed in — in your browser, through GitHub's device
// flow, or by pasting a token by hand if you would rather.
//
// Three things shape the whole file.
//
// **The host does the dangerous part, and refuses most of it.** There is no force push,
// reset or merge in the API at all, and `pull` is fast-forward only. Discarding edits and
// removing a remote are confirmed by Linelark itself. That is a property of Linelark, not
// of this code being careful, which is the only kind of safety worth relying on.
//
// **The panel says which project it is about, and lets you change it.** A window can hold
// several folders, and before generation 8 every git call went to whichever one held the
// tab in front — so this panel silently configured whichever repository you had last
// clicked into. It cost a remote added to the wrong project. `linelark.workspaceFolders()`
// names them and `repoSelectFolder` binds the calls to one, which is what the Project
// section at the top is.
//
// **A panel has one click per row.** So clicking a changed file *selects* it and shows its
// diff, and the actions for that file appear as their own rows underneath. Trying to fit
// "open the diff" and "stage it" onto one row would mean guessing which was meant.
//
// **Every write is asynchronous and the panel says so.** `perform` is the only way any of
// them are called: it marks the panel busy, redraws, awaits, keeps git's own message, and
// redraws again. Without that a push looks like nothing happening for four seconds.

var COMMIT_LIMIT = 120;

// What the panel is showing that git cannot tell it: which file is selected, what is being
// typed, and what the last operation said. Redraws are frequent and this survives them.
var state = {
    selected: null,
    busy: null,
    outcome: null,
    message: "",
    branch: "",
    // The workspace folder every git call is bound to, or null for "follow the tab in
    // front", which is what this panel always did and still does with one folder open.
    project: null,
    remoteEntry: "",
    selectedRemote: null,
    remoteURL: "",
    // Flat names with their folder underneath, or the folder structure itself. Both are
    // wanted: a handful of files reads better flat, and thirty across five directories is
    // unreadable that way. Not persisted — a view preference is not worth a stored key.
    tree: true,
    // Whether this session has seen a commit go through, which is what stops the numbering
    // being furniture. "Step 1" is for somebody who does not yet know that staging gates
    // committing; once they have committed once, they know, and two numbers that never go
    // away are noise on the five-hundredth commit.
    //
    // In memory rather than stored: there is no key-value store in the plugin API, and
    // adding one to the host to hide two words would be the wrong trade. The numbers come
    // back after a restart, for one commit.
    committed: false,
    // Filled in by the GitHub half when it has something. Never blocks the panel.
    remoteInfo: null,
    // A sign-in that is part-way through: the code GitHub gave us to show, or the reason
    // the attempt ended. Null the rest of the time, which is nearly always. It is also the
    // cancel flag — see `pollForToken`.
    signIn: null
};

// A successful outcome clears itself; a failure does not.
//
// "Push finished." is worth a few seconds and no more. git explaining *why* a push was
// rejected is the entire reason the panel said anything at all, and putting that on a timer
// would throw away the only copy of it — there is no scrollback in a sidebar.
var outcomeTimer = null;

function clearOutcome() {
    if (outcomeTimer !== null) {
        clearTimeout(outcomeTimer);
        outcomeTimer = null;
    }
    state.outcome = null;
}

function showOutcome(ok, text) {
    clearOutcome();
    state.outcome = { ok: ok, text: text };
    if (!ok) { return; }
    outcomeTimer = setTimeout(function () {
        outcomeTimer = null;
        state.outcome = null;
        linelark.refreshPanels();
    }, 4000);
}

// MARK: - Running a write

// The one path every change goes through, so "in progress" and "here is what git said" are
// not something each action has to remember to do.
async function perform(label, work) {
    if (state.busy) {
        return null;
    }
    state.busy = label;
    clearOutcome();
    invalidate();
    linelark.refreshPanels();
    var result = null;
    try {
        result = await work();
        showOutcome(result.ok,
                    // git is quiet on success — `--quiet` is passed precisely so a panel is
                    // not filled with progress — so say something when it says nothing.
                    result.output || (result.ok ? label + " finished." : label + " failed."));
    } catch (error) {
        // A refusal from the host arrives here: no consent, no repository, wrong edition.
        showOutcome(false, String(error && error.message ? error.message : error));
    }
    state.busy = null;
    invalidate();
    linelark.refreshPanels();
    return result;
}

// MARK: - Reading
//
// Every git read is a subprocess, and the nodes below want the same answers several times
// over — the file list alone was read five times while one panel was built. This takes each
// answer once per draw and hands it round.
//
// It is a *per-draw* snapshot and nothing longer. Keeping it for a second or two across
// draws was tried and was wrong: the panel then showed the working tree as it had been
// before the last save, and — the case that gave it away — went on saying "read-only" for
// two seconds after the user granted permission. Anything the user can change out of band
// must not be answered from a cache, so this one is dropped at the top of every draw and
// every click, and exists only to stop one pass asking git the same question five times.
var cache = null;

function invalidate() {
    cache = null;
}

// Every folder the window has open. The host answers, so the names are the ones the
// sidebar shows rather than anything this plugin invents.
function projects() {
    return linelark.workspaceFolders();
}

// Binds the host's git calls to the chosen project, and is called before every read and
// every write.
//
// Re-asserted rather than set once: the host drops a binding whose folder the window no
// longer has, so a project closed while the panel was open falls back to the front tab
// instead of quietly answering for a folder that is gone. Re-selecting a folder that is
// still there costs nothing.
function bindProject() {
    if (state.project && !linelark.repoSelectFolder(state.project)) {
        state.project = null;
        linelark.repoSelectFolder("");
    } else if (!state.project) {
        linelark.repoSelectFolder("");
    }
    invalidate();
}

// What the panel calls the project it is acting on. The bound one when there is one, and
// otherwise whichever folder the front tab put us in — said out loud either way, because
// the whole point is that it should never have to be guessed.
function projectName() {
    var bound = linelark.repoSelectedFolder();
    var found = null;
    projects().forEach(function (folder) {
        if (bound ? folder.path === bound : folder.isActive) { found = folder; }
    });
    return found ? found.name : null;
}

// Shown only when there is a choice to make. One folder needs no picker, and a list of one
// above every panel is chrome explaining a decision nobody has.
function projectNodes() {
    var folders = projects();
    if (folders.length < 2) { return []; }
    var bound = linelark.repoSelectedFolder();
    return [{
        type: "rows",
        rows: folders.map(function (folder) {
            var chosen = bound ? folder.path === bound : folder.isActive;
            return {
                id: "project:" + folder.path,
                title: folder.name,
                detail: folder.path,
                symbol: chosen ? "checkmark.circle.fill" : "folder",
                // A folder that is not a repository is still offered — it is a project in
                // this workspace — but saying so beforehand beats letting somebody pick it
                // and read "No repository".
                badge: folder.isRepository ? null : "no git",
                badgeTint: folder.isRepository ? null : "negative"
            };
        })
    }, {
        type: "text",
        text: bound
            ? "Every git action below is about this project."
            : "Following the tab in front. Pick a project to pin it.",
        style: "secondary"
    }];
}

function repository() {
    if (cache) {
        return cache;
    }
    var files = linelark.repoFiles();
    cache = {
        head: linelark.repoHead(),
        root: linelark.repoRoot(),
        tracking: linelark.repoTracking(),
        files: files,
        staged: files.filter(function (file) { return file.staged; }),
        unstaged: files.filter(function (file) { return file.unstaged || file.untracked; }),
        branches: linelark.repoBranches(),
        remotes: linelark.repoRemotes(),
        commits: linelark.repoLog(COMMIT_LIMIT),
        canWrite: linelark.repoCanWrite()
    };
    return cache;
}

function fileOf(path) {
    var found = null;
    repository().files.forEach(function (file) {
        if (file.path === path) { found = file; }
    });
    return found;
}

function badge(file, staging) {
    var column = staging ? file.index : file.worktree;
    if (column === "?") { return "new"; }
    return column || null;
}

// Modified is a warning, added is positive, deleted is negative, and a file git has never
// seen is none of those — it is information. Left alone the host draws every badge the same
// grey, and a column of identical grey letters is a column nobody reads.
function badgeTint(file, staging) {
    var column = staging ? file.index : file.worktree;
    if (column === "?") { return "info"; }
    if (column === "A") { return "positive"; }
    if (column === "D") { return "negative"; }
    if (column === "R") { return "info"; }
    return "warning";
}
function symbolFor(file, staging) {
    var column = staging ? file.index : file.worktree;
    if (column === "?") { return "plus.circle"; }
    if (column === "D") { return "minus.circle"; }
    if (column === "A") { return "plus.circle.fill"; }
    if (column === "R") { return "arrow.right.circle"; }
    return "pencil.circle";
}

// MARK: - Rows

function branchRow() {
    var repo = repository();
    var head = repo.head;
    var tracking = repo.tracking;
    var detail = repo.root;
    var badgeText = null;
    if (tracking) {
        detail = tracking.upstream;
        var parts = [];
        if (tracking.ahead) { parts.push("↑" + tracking.ahead); }
        if (tracking.behind) { parts.push("↓" + tracking.behind); }
        badgeText = parts.length ? parts.join(" ") : "up to date";
    } else {
        detail = "not tracking a remote";
    }
    return {
        id: "noop",
        title: head || "detached",
        detail: detail,
        symbol: "arrow.triangle.branch",
        badge: badgeText
    };
}

// Fetch, pull and push, each saying what it would actually do. A button labelled "Pull"
// beside a branch that is level is a button that does nothing, and one labelled "Pull (2)"
// is a reason to press it.
// Icons on one line rather than a stack of rows. The titles still say what each will
// actually do — "Pull 2 behind", "Push and set upstream" — they say it on hover now, which
// is the trade: several lines of the sidebar back, at the cost of having to point at one.
function remoteActions() {
    if (state.busy) {
        return { type: "rows", rows: [{ id: "noop", title: state.busy + "…", symbol: "clock" }] };
    }
    var repo = repository();
    var tracking = repo.tracking;
    var hasRemote = repo.remotes.length > 0;
    return {
        type: "actions",
        actions: [
            { id: "action:fetch", title: "Fetch", symbol: "arrow.down.circle",
              enabled: repo.canWrite && hasRemote },
            { id: "action:pull",
              title: tracking && tracking.behind
                  ? "Pull " + tracking.behind + " behind" : "Pull",
              symbol: "arrow.down.to.line", enabled: repo.canWrite && hasRemote },
            { id: "action:push",
              title: tracking
                  ? (tracking.ahead ? "Push " + tracking.ahead + " ahead" : "Push")
                  : "Push and set upstream",
              symbol: "arrow.up.to.line", enabled: repo.canWrite && hasRemote },
            { id: "action:view",
              title: state.tree ? "View as list" : "View as tree",
              symbol: state.tree ? "list.bullet" : "list.bullet.indent" },
            { id: "action:refresh", title: "Refresh", symbol: "arrow.clockwise" }
        ]
    };
}

// Remotes are repository configuration, so they belong beside fetch/pull/push instead of
// being hidden in a settings screen. Selecting one reveals its editable URL and remove
// action. The host validates every argument and confirms removal itself.
function remoteNodes() {
    var repo = repository();
    var remotes = repo.remotes;
    var nodes = [];

    if (remotes.length) {
        nodes.push({
            type: "rows",
            rows: remotes.map(function (remote) {
                return {
                    id: "remote:" + remote.name,
                    title: remote.name,
                    detail: remote.url,
                    symbol: state.selectedRemote === remote.name
                        ? "checkmark.circle.fill" : "network"
                };
            })
        });
    } else {
        nodes.push({ type: "text",
                     text: "No remote is configured for " + (projectName() || "this project")
                         + "." });
    }

    if (state.selectedRemote) {
        var selected = null;
        remotes.forEach(function (remote) {
            if (remote.name === state.selectedRemote) { selected = remote; }
        });
        if (selected) {
            nodes.push({
                type: "field", id: "remoteURL", label: "Change " + selected.name + " URL",
                placeholder: "https://github.com/owner/repository.git",
                value: state.remoteURL, multiline: false, submit: "Save URL",
                enabled: repo.canWrite && !state.busy
            });
            nodes.push({
                type: "button", id: "removeRemote:" + selected.name,
                title: "Remove " + selected.name, symbol: "trash",
                enabled: repo.canWrite && !state.busy
            });
        } else {
            state.selectedRemote = null;
            state.remoteURL = "";
        }
    }

    if (repo.canWrite) {
        nodes.push({
            // Named, because this is the one control whose wrong target is invisible until
            // somebody pushes: adding a remote succeeds just as quietly in the wrong
            // repository as in the right one.
            type: "field", id: "addRemote",
            label: "Add a remote for " + (projectName() || "this project"),
            placeholder: "origin https://github.com/owner/repository.git",
            value: state.remoteEntry, multiline: false, submit: "Add",
            enabled: !state.busy
        });
    }
    return nodes;
}

// The name on the first line, the folder it is in on the second.
//
// The whole path in the title is what the panel truncates through the middle, and a
// repository whose interesting files are five directories deep then renders twenty rows
// that all read "AI Minute/Source/Core/Recordin…" and cannot be told apart. The name is
// the part being looked for; the folder is what disambiguates two files sharing one.
function fileRows(files, staging) {
    return files.map(function (file) {
        var cut = file.path.lastIndexOf("/");
        return {
            id: (staging ? "diff:staged:" : "diff:worktree:") + file.path,
            title: cut === -1 ? file.path : file.path.slice(cut + 1),
            detail: cut === -1 ? null : file.path.slice(0, cut),
            symbol: symbolFor(file, staging),
            badge: badge(file, staging),
            badgeTint: badgeTint(file, staging)
        };
    });
}

// One section of files, drawn whichever way the toggle is set.
//
// The tree is the host's: it is handed the paths and does the folding, the folders-first
// ordering and the collapsing itself. A tree item carries only a path and a badge, so the
// status symbol is dropped in that mode — the badge letter still says what changed.
// Returns a *list* of nodes, because the selected file's actions go directly beneath it:
// the rows down to the selection, the actions, then the rest. Scrolling past thirty files
// to reach the one button that applies to the file you just clicked is not a panel.
//
// A tree cannot be split that way — it is a single node and the host builds the folders
// from the paths it is handed — so there the actions follow the whole tree instead.
function fileNodes(files, staging) {
    if (state.tree) {
        var nodes = [{
            type: "tree",
            items: files.map(function (file) {
                return { path: file.path, badge: badge(file, staging),
                         badgeTint: badgeTint(file, staging) };
            })
        }];
        if (indexOfSelected(files) !== -1) { nodes.push(selectionActions()); }
        return nodes;
    }

    var rows = fileRows(files, staging);
    var at = indexOfSelected(files);
    if (at === -1) { return [{ type: "rows", rows: rows }]; }

    var out = [{ type: "rows", rows: rows.slice(0, at + 1) }, selectionActions()];
    if (at + 1 < rows.length) { out.push({ type: "rows", rows: rows.slice(at + 1) }); }
    return out;
}

function indexOfSelected(files) {
    for (var i = 0; i < files.length; i++) {
        if (files[i].path === state.selected) { return i; }
    }
    return -1;
}

// A foldable group, as an array so it concatenates like every other run of nodes here and
// disappears entirely when there is nothing to put in it.
//
// The panel is long: a repository with thirty changed files pushed Branches, GitHub and the
// history graph so far down that nobody scrolled to them. Folding is what gives the reader
// somewhere to put the part they are not looking at.
// A title, numbered only while the numbering is still teaching something.
function step(number, title) {
    return state.committed ? title : "Step " + number + " · " + title;
}

function section(id, title, collapsed, children) {
    if (!children.length) { return []; }
    return [{ type: "section", id: id, title: title, collapsed: collapsed, children: children }];
}

// What can be done to the selected file, as icons under it. Separate from the file's own
// row because a row has one click and it is already spent on showing the diff.
//
// An empty `rows` node is the "nothing here" answer: the host drops it, which is what makes
// this safe to insert unconditionally.
function selectionActions() {
    var file = state.selected ? fileOf(state.selected) : null;
    if (!file) {
        state.selected = null;
        return { type: "rows", rows: [] };
    }
    var name = state.selected.split("/").pop();
    var actions = [];
    if (file.unstaged || file.untracked) {
        actions.push({ id: "stage:" + state.selected, title: "Stage " + name,
                       symbol: "plus.square" });
    }
    if (file.staged) {
        actions.push({ id: "unstage:" + state.selected, title: "Unstage " + name,
                       symbol: "minus.square" });
    }
    actions.push({ id: "open:" + state.selected, title: "Open " + name, symbol: "doc.text" });
    // Only where there is something to restore *to*. An untracked file has no index entry,
    // so discarding it would mean deleting it, and this API cannot delete a file.
    if (file.unstaged && !file.untracked) {
        actions.push({ id: "discard:" + state.selected,
                       title: "Discard changes to " + name,
                       symbol: "arrow.uturn.backward", tint: "negative" });
    }
    return { type: "actions", actions: actions };
}

// MARK: - The panel

function panelNodes() {
    bindProject();
    // Before the early return below, so a window whose front tab is in a folder with no
    // repository can still be pointed at one of the others. Putting it after was the first
    // draft, and it made the picker unreachable in exactly the case that needs it.
    var project = section("project", "Project" + (projectName() ? " · " + projectName() : ""),
                          false, projectNodes());
    if (!linelark.repoIsAvailable()) {
        return project.concat([
            { type: "heading", text: "No repository" },
            { type: "text",
              text: linelark.folderRoot()
                  ? "This project is not inside a git repository."
                  : "Open a folder to see its repository." },
            // Said here rather than nowhere: in the sandboxed edition this is not a
            // temporary state to be fixed by opening a different folder.
            { type: "text",
              text: "Git needs Linelark Studio; the Mac App Store edition cannot run it." }
        ]);
    }

    var nodes = project.concat([{ type: "rows", rows: [branchRow()] }]);
    nodes.push(remoteActions());

    if (state.outcome) {
        nodes.push({ type: "heading", text: state.outcome.ok ? "Done" : "git said" });
        nodes.push({ type: "text", text: state.outcome.text,
                     style: state.outcome.ok ? "secondary" : "primary" });
    }

    var repo = repository();
    var stagedFiles = repo.staged;
    var unstagedFiles = repo.unstaged;

    // Open, both of them: what has changed is why the panel was opened.
    if (stagedFiles.length) {
        nodes = nodes.concat(section("staged", "Staged · " + stagedFiles.length, false,
            fileNodes(stagedFiles, true).concat([
                { type: "button", id: "action:unstageAll", title: "Unstage everything",
                  symbol: "minus.square" }
            ])));
    }

    if (unstagedFiles.length) {
        nodes = nodes.concat(section("changes", "Changes · " + unstagedFiles.length, false,
            fileNodes(unstagedFiles, false).concat([
                // Filled only while nothing is staged, because that is the one moment it is
                // the obvious next thing to press. Once something is staged the obvious next
                // thing is Commit, and two filled buttons would argue with each other.
                { type: "button", id: "action:stageAll",
                  title: step(1, "Stage everything"),
                  symbol: "plus.square", prominent: stagedFiles.length === 0 }
            ])));
    }

    if (!stagedFiles.length && !unstagedFiles.length) {
        nodes.push({ type: "rows", rows: [{ id: "action:refresh", title: "Working tree clean",
                                            symbol: "checkmark.circle" }] });
    }

    // Only offered when it could work. A commit box on a plugin the user has not allowed to
    // write is a box that throws when you press the button.
    if (repo.canWrite && stagedFiles.length) {
        nodes.push({ type: "heading", text: step(2, "Commit") });
        // The box exists only when there is something to commit, the same way there is no
        // Stage button with nothing to stage. A box that cannot be used teaches nobody what
        // would make it usable — it just looks broken — and the step above it says what to
        // press instead. The label counts what the commit will actually include, and says
        // it in the one place that does not vanish as soon as somebody types.
        nodes.push({
            type: "field", id: "commit",
            label: stagedFiles.length + " staged file"
                + (stagedFiles.length === 1 ? "" : "s"),
            placeholder: "Message",
            value: state.message,
            multiline: true,
            submit: "Commit",
            enabled: !state.busy
        });
    } else if (!repo.canWrite) {
        nodes.push({ type: "heading", text: "Read-only" });
        nodes.push({ type: "text",
                     text: "Allow “Changes to git” for this plugin in Plugins ▸ Manage "
                         + "Plugins to stage, commit, pull and push from here." });
    }

    // Shut to begin with. All three are reference rather than the task in hand, and the
    // panel is read top-down: a branch list between the commit box and the history is what
    // made the graph unreachable without scrolling past everything else.
    nodes = nodes.concat(section("remotes", "Remotes · " + repo.remotes.length, true,
                                 remoteNodes()));
    nodes = nodes.concat(section("branches", "Branches", true, branchNodes()));
    nodes = nodes.concat(section("account", "GitHub account", linelark.hasSecret("token"),
                                 githubAccountNodes()));
    nodes = nodes.concat(section("github", githubTitle(), true, remoteInfoNodes()));
    nodes = nodes.concat(section("history", "History", true,
                                 repo.commits.length
                                     ? [{ type: "graph", commits: repo.commits }]
                                     : []));
    return nodes;
}

function branchNodes() {
    var branches = repository().branches;
    if (branches.length < 1) { return []; }
    var nodes = [];
    nodes.push({
        type: "rows",
        rows: branches.map(function (branch) {
            return {
                id: branch.current ? "noop" : "switch:" + branch.name,
                title: branch.name,
                detail: branch.upstream || null,
                symbol: branch.current ? "checkmark.circle.fill" : "circle"
            };
        })
    });
    if (repository().canWrite) {
        nodes.push({ type: "field", id: "branch", placeholder: "New branch name",
                     value: state.branch, multiline: false, submit: "Create",
                     enabled: !state.busy });
    }
    return nodes;
}

// MARK: - Clicks

async function showDiff(path, isStaged) {
    var file = fileOf(path);
    if (!file) { return; }
    // An untracked file has nothing in the index to compare against, so `git diff` says
    // nothing about it. `untracked: true` asks for the whole file as an addition instead,
    // which is what a new file's diff is.
    var diff = await linelark.repoDiffAsync({
        path: path,
        staged: isStaged,
        untracked: !isStaged && file.untracked
    });
    if (!diff) {
        linelark.log("No diff for " + path + "; opening the file instead.");
        linelark.openFile(path);
        return;
    }
    // `openDiff` rather than `openVirtual`: the editor draws the patch as the two files it
    // describes, side by side, instead of showing the patch itself. What is handed over is
    // the same string either way — git's own answer, which is the only thing that knows how
    // to compare a staged change against the index.
    linelark.openDiff({
        key: "diff:" + (isStaged ? "staged:" : "worktree:") + path,
        name: path.split("/").pop() + ".diff",
        label: isStaged ? "staged" : "changes",
        patch: diff
    });
}

async function handle(id) {
    // Before anything is read or written: a press arrives long after the panel was drawn,
    // and the window may have closed the folder in between.
    bindProject();
    if (id === "noop") {
        linelark.refreshPanels();
        return;
    }
    var colon = id.indexOf(":");
    var kind = colon === -1 ? id : id.slice(0, colon);
    var rest = colon === -1 ? "" : id.slice(colon + 1);

    if (kind === "action") {
        if (rest === "refresh") { linelark.refreshPanels(); return; }
        if (rest === "view") { state.tree = !state.tree; linelark.refreshPanels(); return; }
        if (rest === "fetch") { await perform("Fetch", function () { return linelark.repoFetchAsync(); }); return; }
        if (rest === "pull") { await perform("Pull", function () { return linelark.repoPullAsync(); }); return; }
        if (rest === "push") { await perform("Push", function () { return linelark.repoPushAsync(); }); return; }
        if (rest === "stageAll") {
            var toStage = repository().unstaged.map(function (file) { return file.path; });
            if (toStage.length) {
                await perform("Stage", function () { return linelark.repoStageAsync(toStage); });
            }
            return;
        }
        if (rest === "github") { await loadGitHub(); return; }
        if (rest === "login") {
            // Signed in already, so this button reads "Manage GitHub token…" and means it.
            // Starting a device flow here would be a second sign-in nobody asked for.
            if (linelark.hasSecret("token")) { linelark.openPluginSettings(); return; }
            // No browser here. This click fetches the code and draws it; the button it
            // turns into is what opens the page — see the note above `wait`.
            await startSignIn();
            return;
        }
        if (rest === "openDevicePage") {
            var attempt = state.signIn;
            if (!attempt || !attempt.code) { return; }
            // Copied again rather than trusted to have survived: whatever else has been
            // copied since, the code is on the clipboard at the moment the page opens.
            linelark.copyToClipboard(attempt.code);
            linelark.openURL(attempt.verificationURI);
            return;
        }
        if (rest === "cancelSignIn") {
            // Dropping the attempt object is the whole cancellation: the polling loop
            // compares against it after every sleep and stops when it is no longer the one.
            state.signIn = null;
            linelark.refreshPanels();
            return;
        }
        if (rest === "signOut") { signOut(); return; }
        if (rest === "token") { linelark.openPluginSettings(); return; }
        if (rest === "newToken") {
            linelark.openURL("https://github.com/settings/personal-access-tokens/new");
            return;
        }
        if (rest === "repository") {
            var slug = githubSlug();
            if (slug) {
                linelark.openURL("https://github.com/" + slug.owner + "/" + slug.repo);
            }
            return;
        }
        if (rest === "unstageAll") {
            var toUnstage = repository().staged.map(function (file) { return file.path; });
            if (toUnstage.length) {
                await perform("Unstage", function () { return linelark.repoUnstageAsync(toUnstage); });
            }
            return;
        }
        return;
    }

    if (kind === "project") {
        // Pressing the project already bound unpins it, which is how you get back to
        // following the tab in front without hunting for a control that says so.
        state.project = state.project === rest ? null : rest;
        state.selected = null;
        state.selectedRemote = null;
        state.remoteURL = "";
        state.outcome = null;
        bindProject();
        linelark.refreshPanels();
        return;
    }

    if (kind === "remote") {
        var chosen = null;
        repository().remotes.forEach(function (remote) {
            if (remote.name === rest) { chosen = remote; }
        });
        if (chosen) {
            state.selectedRemote = chosen.name;
            state.remoteURL = chosen.url;
            linelark.refreshPanels();
        }
        return;
    }
    if (kind === "removeRemote") {
        var removed = await perform("Remove " + rest, function () {
            return linelark.repoRemoveRemoteAsync(rest);
        });
        if (removed && removed.ok) {
            state.selectedRemote = null;
            state.remoteURL = "";
        }
        return;
    }

    if (kind === "diff") {
        var slash = rest.indexOf(":");
        var isStaged = rest.slice(0, slash) === "staged";
        var path = rest.slice(slash + 1);
        state.selected = path;
        linelark.refreshPanels();
        await showDiff(path, isStaged);
        return;
    }
    if (kind === "stage") {
        await perform("Stage", function () { return linelark.repoStageAsync([rest]); });
        return;
    }
    if (kind === "discard") {
        // The host asks before it does this; a refusal comes back as an ordinary failed
        // outcome, so "Cancelled." lands in the same place git's own words would.
        await perform("Discard", function () { return linelark.repoDiscardAsync([rest]); });
        return;
    }
    if (kind === "unstage") {
        await perform("Unstage", function () { return linelark.repoUnstageAsync([rest]); });
        return;
    }
    if (kind === "open") {
        linelark.openFile(rest);
        return;
    }
    if (kind === "switch") {
        await perform("Switch to " + rest, function () { return linelark.repoSwitchAsync(rest); });
        return;
    }
    if (kind === "pr") {
        openPullRequest(rest);
        return;
    }
    // Anything else is a path the tree sent: its items are files, not rows with ids of our
    // making. A changed file gets the same click as its row would — the diff — and working
    // out staged from unstaged is ours to do, since the path alone does not say.
    var tracked = fileOf(id);
    if (tracked) {
        state.selected = id;
        linelark.refreshPanels();
        await showDiff(id, !!(tracked.staged && !tracked.unstaged));
        return;
    }
    linelark.openFile(id);
}

linelark.addPanel({
    id: "repository",
    title: "Repository",
    symbol: "arrow.triangle.branch",
    render: panelNodes,

    onSelect: async function (id) {
        try {
            await handle(id);
        } catch (error) {
            // After the first await this can no longer reach the user as a failed click, so
            // it goes where the manager will show it.
            linelark.log("Click failed: " + error);
            state.outcome = { ok: false, text: String(error) };
            linelark.refreshPanels();
        }
    },

    onSubmit: async function (id, value) {
        invalidate();
        if (id === "commit") {
            // Kept before the await so a failed commit gives the message back rather than
            // eating it. Cleared only once git has actually taken it.
            state.message = value;
            var result = await perform("Commit", function () {
                return linelark.repoCommitAsync(value);
            });
            if (result && result.ok) {
                state.message = "";
                state.selected = null;
                state.committed = true;
                linelark.refreshPanels();
            }
            return;
        }
        if (id === "branch") {
            state.branch = value;
            var created = await perform("Create " + value, function () {
                return linelark.repoCreateBranchAsync(value);
            });
            if (created && created.ok) {
                state.branch = "";
                linelark.refreshPanels();
            }
            return;
        }
        if (id === "addRemote") {
            state.remoteEntry = value;
            var match = /^\s*(\S+)\s+(.\S(?:.*\S)?)\s*$/.exec(value);
            if (!match) {
                showOutcome(false, "Enter a name and URL, for example: origin "
                            + "https://github.com/owner/repository.git");
                linelark.refreshPanels();
                return;
            }
            var added = await perform("Add " + match[1], function () {
                return linelark.repoAddRemoteAsync(match[1], match[2]);
            });
            if (added && added.ok) {
                state.remoteEntry = "";
                state.selectedRemote = match[1];
                state.remoteURL = match[2];
                linelark.refreshPanels();
            }
            return;
        }
        if (id === "remoteURL" && state.selectedRemote) {
            state.remoteURL = value;
            var changed = await perform("Change " + state.selectedRemote + " URL", function () {
                return linelark.repoSetRemoteURLAsync(state.selectedRemote, value);
            });
            if (changed && changed.ok) {
                state.remoteURL = value.trim();
                linelark.refreshPanels();
            }
        }
    }
});

// MARK: - Commands
//
// The same actions from the Plugins menu, for the half of the work that happens with the
// sidebar closed.

linelark.addCommand("refresh", "Refresh Repository Panel", function () {
    state.outcome = null;
    invalidate();
    linelark.refreshPanels();
});

linelark.addCommand("diffCurrent", "Compare This File With HEAD", async function () {
    var path = currentRepositoryPath();
    if (!path) {
        linelark.log("This file is not inside the open repository.");
        return;
    }
    var file = fileOf(path);
    await showDiff(path, !!(file && file.staged && !file.unstaged));
});

linelark.addCommand("stageCurrent", "Stage This File", async function () {
    var path = currentRepositoryPath();
    if (path) {
        await perform("Stage", function () { return linelark.repoStageAsync([path]); });
    }
});

linelark.addCommand("pull", "Pull", async function () {
    await perform("Pull", function () { return linelark.repoPullAsync(); });
});

linelark.addCommand("push", "Push", async function () {
    await perform("Push", function () { return linelark.repoPushAsync(); });
});

linelark.addCommand("account", "GitHub Account…", function () {
    linelark.openPluginSettings();
});

linelark.addCommand("signIn", "Sign In to GitHub…", async function () {
    if (linelark.hasSecret("token")) {
        linelark.openPluginSettings();
        return;
    }
    // Ends with the code in the Repository panel, where the button that opens github.com
    // is. A command cannot draw anything itself.
    await startSignIn();
});

linelark.addCommand("openRepository", "Open Repository on GitHub", function () {
    var slug = githubSlug();
    if (!slug) {
        linelark.log("No github.com remote is configured for this repository.");
        return;
    }
    linelark.openURL("https://github.com/" + slug.owner + "/" + slug.repo);
});

// The front tab as git names it: relative to the work tree, which is not always the folder
// that was opened.
function currentRepositoryPath() {
    var full = linelark.filePath();
    var root = linelark.repoRoot();
    if (!full || !root) { return null; }
    var prefix = root.charAt(root.length - 1) === "/" ? root : root + "/";
    return full.indexOf(prefix) === 0 ? full.slice(prefix.length) : null;
}

// ---------------------------------------------------------------------------------------
// github.com
// ---------------------------------------------------------------------------------------
//
// Everything above works offline, with no token and no permission prompt, because a branch
// and a diff are facts about the folder on disk. This part is not: pull requests and check
// runs exist only on the server, and they are the reason the manifest declares a host and a
// credential at all.
//
// It is deliberately opt-in and deliberately lazy. Nothing here runs while the panel draws
// — a render that made a request would make one on every keystroke — so the panel offers a
// row and fetches when it is pressed. Without a token it still works for public
// repositories, at the rate limit GitHub gives anonymous callers; with one it works for
// private ones too. The token is never readable by this code: `hasSecret` answers yes or no
// and the host attaches the value to requests bound for api.github.com.

var GITHUB_API = "https://api.github.com";
var GITHUB_WEB = "https://github.com";

// This plugin's own OAuth app. A device-flow client id is public by construction — it names
// the application on the consent screen and nothing more — which is why there is no secret
// beside it and why one being here is not a leak. The flow is designed for exactly this
// case: a program that can open a browser but cannot receive a redirect back.
var CLIENT_ID = "Ov23li1VRpexHTDxwLsY";

// `repo` is the narrowest scope that covers a private repository's pull requests and check
// runs. GitHub has no read-only equivalent for OAuth apps, so this is the floor rather than
// a convenience — and it is why signing in is offered rather than assumed.
var SIGN_IN_SCOPE = "repo";

// `git@github.com:owner/repo.git` and `https://github.com/owner/repo.git` are the same
// repository written two ways, and a client that only understood one of them would work for
// half of everybody.
function githubSlug() {
    var remotes = repository().remotes;
    for (var i = 0; i < remotes.length; i++) {
        var url = remotes[i].url;
        var match = /^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/.exec(url)
            || /^(?:https?|ssh):\/\/(?:[^@]*@)?github\.com\/([^/]+)\/(.+?)(?:\.git)?\/?$/.exec(url);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
    }
    return null;
}

// MARK: - Signing in
//
// GitHub's device flow, which is the only browser sign-in a plugin can actually complete.
// The usual OAuth dance ends with the browser redirecting to a URL the application is
// listening on, and a plugin has nowhere for that to land: Linelark registers no URL scheme
// and a plugin cannot open a socket. The device flow was made for that shape of program —
// it asks GitHub for a short code, the user types it into a page in their own browser, and
// the *plugin* polls until GitHub says it was approved. Nothing comes back to us but the
// answer to a question we asked.
//
// **The code is on screen before the browser is.** Opening the page first and fetching the
// code afterwards saves a click and was wrong: GitHub's page asks for the code immediately,
// and by then the user is looking at a browser while the only copy of it appears in an
// editor behind it. So the first click asks GitHub and draws the code, and opening the page
// is its own button — which is a second user action, and therefore still allowed to call
// `openURL`.
//
// The token that arrives at the end goes straight to `setSecret`, which files it in the
// Keychain slot the manifest declares. It is never kept in `state`, never written to the
// plugin store, and after `finishSignIn` returns no variable here refers to it: from then on
// this code is in exactly the position it was in with a hand-pasted token — able to send it
// by asking the host to, and unable to read it.

function wait(seconds) {
    return new Promise(function (resolve) {
        setTimeout(resolve, Math.max(1, seconds) * 1000);
    });
}

// The two device-flow endpoints are on github.com rather than the API host, which is the
// only reason the manifest declares a second host. Both answer form-encoded by default;
// `Accept` is what makes them answer JSON.
async function deviceEndpoint(path, body) {
    var response = await linelark.fetch({
        url: GITHUB_WEB + path,
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: body
    });
    if (!response.ok) {
        throw new Error("GitHub answered " + response.status + " to the sign-in request.");
    }
    return JSON.parse(response.body);
}

// GitHub's own words for the ways this ends, in ours. Anything unrecognised is passed
// through rather than swallowed: a new error code should read as a new error, not as
// silence.
function signInFailure(answer) {
    if (answer.error === "expired_token") {
        return "That code expired before it was approved. Start again when you are ready.";
    }
    if (answer.error === "access_denied") {
        return "Sign-in was declined on github.com.";
    }
    if (answer.error === "device_flow_disabled") {
        return "This build's GitHub app does not have device flow switched on.";
    }
    return answer.error_description || answer.error || "GitHub refused the sign-in.";
}

// A verification URL is only usable if it is one of GitHub's own.
function deviceURL(candidate) {
    if (typeof candidate !== "string") { return null; }
    return /^https:\/\/github\.com\//.test(candidate) ? candidate : null;
}

async function startSignIn() {
    // An attempt that has not ended is still an attempt, even in the second before GitHub
    // has answered with a code: without this a second click asks for a second device code
    // and the first one is left to expire unwatched.
    if (state.signIn && !state.signIn.error) { return; }
    state.signIn = { status: "Asking GitHub for a code…" };
    linelark.refreshPanels();

    var answer;
    try {
        answer = await deviceEndpoint("/login/device/code",
                                      "client_id=" + encodeURIComponent(CLIENT_ID)
                                      + "&scope=" + encodeURIComponent(SIGN_IN_SCOPE));
    } catch (error) {
        state.signIn = { error: String(error && error.message ? error.message : error) };
        linelark.refreshPanels();
        return;
    }
    if (!answer.device_code || !answer.user_code) {
        state.signIn = { error: signInFailure(answer) };
        linelark.refreshPanels();
        return;
    }

    // The attempt object is its own identity token. Everything below compares against
    // `state.signIn` rather than trusting that it is still the one it started with, so a
    // cancelled or restarted sign-in stops this loop instead of racing the next one.
    var attempt = {
        code: answer.user_code,
        deviceCode: answer.device_code,
        // Where to send the user. `verification_uri_complete` is the device-flow field that
        // carries the code in the URL, so the page opens already filled in; GitHub does not
        // send it today, and `verification_uri` is what actually arrives. Both are checked
        // against github.com before being opened — a URL out of a response is still a URL
        // this plugin did not write.
        verificationURI: deviceURL(answer.verification_uri_complete)
                      || deviceURL(answer.verification_uri)
                      || GITHUB_WEB + "/login/device",
        // GitHub's floor, and it says so in the response. Polling faster earns `slow_down`.
        interval: answer.interval || 5,
        expiresAt: Date.now() + (answer.expires_in || 900) * 1000,
        status: "Waiting for you to approve it on github.com…"
    };

    state.signIn = attempt;
    // On the clipboard as well as on screen: the code is what the user has to get into
    // another application, and eight characters retyped from a sidebar is the one step of
    // this that can go wrong for no reason.
    linelark.copyToClipboard(attempt.code);
    linelark.refreshPanels();
    await pollForToken(attempt);
}

async function pollForToken(attempt) {
    while (state.signIn === attempt) {
        await wait(attempt.interval);
        // Cancelled, or replaced by a newer attempt, while we were asleep.
        if (state.signIn !== attempt) { return; }
        if (Date.now() > attempt.expiresAt) {
            state.signIn = { error: signInFailure({ error: "expired_token" }) };
            linelark.refreshPanels();
            return;
        }

        var answer;
        try {
            answer = await deviceEndpoint(
                "/login/oauth/access_token",
                "client_id=" + encodeURIComponent(CLIENT_ID)
                + "&device_code=" + encodeURIComponent(attempt.deviceCode)
                + "&grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:device_code"));
        } catch (error) {
            state.signIn = { error: String(error && error.message ? error.message : error) };
            linelark.refreshPanels();
            return;
        }
        if (state.signIn !== attempt) { return; }

        if (answer.access_token) {
            finishSignIn(answer.access_token);
            return;
        }
        // Not yet approved, which is the answer nearly every time round.
        if (answer.error === "authorization_pending") { continue; }
        // Asked for too often. GitHub sends the new floor with it; five more is the
        // documented fallback when it does not.
        if (answer.error === "slow_down") {
            attempt.interval = answer.interval || (attempt.interval + 5);
            continue;
        }
        state.signIn = { error: signInFailure(answer) };
        linelark.refreshPanels();
        return;
    }
}

// The end of the flow, and the only place a token is ever in this plugin's hands.
//
// `setSecret` answers with a refusal or with nothing, the way `storeSet` does — so this
// tests it for falsiness rather than against a value, and says what it was told when the
// Keychain would not take it. A sign-in that silently failed to save would look exactly
// like one that worked until the next request.
function finishSignIn(token) {
    var refusal = linelark.setSecret("token", token);
    state.signIn = refusal ? { error: refusal } : null;
    // Cleared so the next draw asks GitHub again as the signed-in user rather than showing
    // what the anonymous request managed to see.
    if (!refusal) { state.remoteInfo = null; }
    showOutcome(!refusal, refusal || "Signed in to GitHub.");
    linelark.refreshPanels();
}

function signOut() {
    var refusal = linelark.clearSecret("token");
    if (!refusal) {
        state.signIn = null;
        state.remoteInfo = null;
    }
    showOutcome(!refusal, refusal || "Signed out. The token is gone from your Keychain.");
    linelark.refreshPanels();
}

// Four nodes, always, whatever is happening.
//
// A node's identity is its position in the list, so a section that grows a line when it has
// something to say moves every node after it — and the commit box lives in this same panel.
// The words change; the shape does not. That is why the status line is drawn even when it
// is only restating the obvious, and why the icon strip is one node however many icons are
// in it.
function githubAccountNodes() {
    var connected = linelark.hasSecret("token");
    var pending = state.signIn;
    var slug = githubSlug();

    var summary;
    if (pending && pending.code) {
        summary = "Your code is " + pending.code + ", and it is on your clipboard. Open "
                + "github.com below and paste it there to finish signing in. "
                + pending.status;
    } else if (pending && pending.error) {
        summary = pending.error;
    } else if (pending) {
        summary = pending.status;
    } else if (connected) {
        summary = "Signed in for GitHub API requests. The token stays in your Keychain and "
                + "is never exposed to this plugin.";
    } else {
        summary = "Public repositories work anonymously. Sign in for private repositories "
                + "and a higher API limit.";
    }
    var nodes = [{ type: "text", text: summary }];

    // One button, and it is whatever the single obvious next step is: open the page while a
    // code is waiting to be typed into it, sign in when nobody is signed in, and the
    // credential screen when somebody is — where a pasted token can be replaced by hand.
    if (pending && pending.code) {
        nodes.push({
            type: "button", id: "action:openDevicePage",
            title: "Open github.com/login/device",
            symbol: "arrow.up.forward.square",
            prominent: true
        });
    } else if (pending && !pending.error) {
        nodes.push({
            type: "button", id: "action:login",
            title: "Asking GitHub for a code…",
            symbol: "ellipsis",
            enabled: false
        });
    } else {
        nodes.push({
            type: "button", id: "action:login",
            title: connected ? "Manage GitHub token…" : "Sign in with your browser",
            symbol: connected ? "checkmark.shield" : "person.crop.circle.badge.plus",
            prominent: !connected
        });
    }

    var actions = [];
    if (pending && !pending.error) {
        actions.push({ id: "action:cancelSignIn", title: "Cancel sign-in", symbol: "xmark" });
    } else if (pending) {
        // The attempt is over and its message is still on screen. Clearing it is what puts
        // the ordinary choices back.
        actions.push({ id: "action:cancelSignIn", title: "Dismiss", symbol: "xmark" });
    } else if (connected) {
        actions.push({ id: "action:signOut", title: "Sign out", symbol: "rectangle.portrait.and.arrow.right",
                       tint: "warning" });
    } else {
        // The way in for anybody who would rather not sign an OAuth app in: a fine-grained
        // personal access token, pasted into the credential field, works exactly as well.
        actions.push({ id: "action:token", title: "Paste a token instead", symbol: "key" });
        actions.push({ id: "action:newToken", title: "Create a token on GitHub",
                       symbol: "plus.rectangle.on.rectangle" });
    }
    if (slug) {
        actions.push({
            id: "action:repository", title: "Open repository on GitHub",
            symbol: "arrow.up.forward.square"
        });
    }
    nodes.push({ type: "actions", actions: actions });

    nodes.push({
        type: "text",
        text: "This signs in API features such as pull requests and checks. Git push and "
            + "pull continue to use your normal git credential helper."
    });
    return nodes;
}

async function api(path) {
    var response = await linelark.fetch({
        url: GITHUB_API + path,
        headers: {
            // The documented way to pin the response shape; without it a future default
            // could change fields underneath this.
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }
    });
    if (!response.ok) {
        // 403 without a token is nearly always the anonymous rate limit, and saying so is
        // more use than the status number.
        if (response.status === 403 && !linelark.hasSecret("token")) {
            throw new Error("GitHub refused the request. Signed out you get 60 an hour; "
                            + "sign in under GitHub account for more.");
        }
        throw new Error("GitHub answered " + response.status + ".");
    }
    return JSON.parse(response.body);
}

// The section's title, which is where the repository's name now lives.
function githubTitle() {
    var slug = githubSlug();
    return slug ? "github.com/" + slug.owner + "/" + slug.repo : "GitHub";
}

function remoteInfoNodes() {
    var slug = githubSlug();
    if (!slug) { return []; }

    var nodes = [];
    if (!linelark.canReachNetwork()) {
        nodes.push({
            type: "text",
            text: "Allow network access for this plugin in Manage Plugins to see pull "
                + "requests and checks. Everything above works without it."
        });
        return nodes;
    }

    if (state.remoteInfo && state.remoteInfo.error) {
        nodes.push({ type: "text", text: state.remoteInfo.error });
    }
    nodes.push({
        type: "rows",
        rows: [{
            id: "action:github",
            title: state.remoteInfo && state.remoteInfo.loading
                ? "Asking GitHub…"
                : "Refresh pull requests and checks",
            symbol: "arrow.clockwise"
        }]
    });

    if (state.remoteInfo && state.remoteInfo.checks) {
        nodes.push({ type: "rows", rows: [state.remoteInfo.checks] });
    }
    if (state.remoteInfo && state.remoteInfo.pulls) {
        if (!state.remoteInfo.pulls.length) {
            nodes.push({ type: "text", text: "No open pull requests." });
        } else {
            nodes.push({ type: "rows", rows: state.remoteInfo.pulls });
        }
    }
    return nodes;
}

// Rolled up rather than listed: a panel row per check run is a wall on any repository with
// a real workflow, and "3 of 12 failed" is the thing being looked for.
function checksRow(runs) {
    var failed = 0;
    var pending = 0;
    runs.forEach(function (run) {
        if (run.status !== "completed") { pending += 1; }
        else if (run.conclusion !== "success" && run.conclusion !== "neutral"
                 && run.conclusion !== "skipped") { failed += 1; }
    });
    if (!runs.length) {
        return { id: "noop", title: "No checks for this commit", symbol: "circle.dashed" };
    }
    if (failed) {
        return { id: "noop", title: failed + " of " + runs.length + " checks failed",
                 symbol: "xmark.circle.fill", badge: "failed" };
    }
    if (pending) {
        return { id: "noop", title: pending + " of " + runs.length + " checks running",
                 symbol: "clock", badge: "running" };
    }
    return { id: "noop", title: "All " + runs.length + " checks passed",
             symbol: "checkmark.circle.fill", badge: "passed" };
}

async function loadGitHub() {
    var slug = githubSlug();
    if (!slug || !linelark.canReachNetwork() || state.busy) { return; }
    state.remoteInfo = { loading: true };
    linelark.refreshPanels();

    var info = { loading: false };
    try {
        var pulls = await api("/repos/" + slug.owner + "/" + slug.repo + "/pulls?state=open&per_page=20");
        var head = repository().head;
        info.pulls = pulls.map(function (pull) {
            return {
                id: "pr:" + pull.number,
                title: "#" + pull.number + " " + pull.title,
                detail: pull.user ? pull.user.login + " → " + pull.base.ref : pull.base.ref,
                symbol: pull.draft ? "circle.dashed" : "arrow.triangle.pull",
                // The one that matters is the one for the branch you are on.
                badge: pull.head && pull.head.ref === head ? "yours" : null
            };
        });
        state.pulls = pulls;

        var commits = repository().commits;
        if (commits.length) {
            var checks = await api("/repos/" + slug.owner + "/" + slug.repo
                                   + "/commits/" + commits[0].sha + "/check-runs");
            info.checks = checksRow(checks.check_runs || []);
        }
    } catch (error) {
        info.error = String(error && error.message ? error.message : error);
    }
    state.remoteInfo = info;
    linelark.refreshPanels();
}

// The row goes to the actual review surface. `openURL` accepts only absolute http/https
// links, and this one came from the GitHub API response retained in `state.pulls`.
function openPullRequest(number) {
    var pull = null;
    (state.pulls || []).forEach(function (candidate) {
        if (String(candidate.number) === String(number)) { pull = candidate; }
    });
    if (!pull) { return; }
    linelark.openURL(pull.html_url);
}
