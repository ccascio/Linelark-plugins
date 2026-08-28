// GitHub — a git client in the side panel.
//
// Everything here is local git. The panel shows what has changed, what is staged, what the
// branch is against its remote, and lets you stage, commit, fetch, pull and push without
// leaving the editor. The optional half at the bottom asks github.com about pull requests
// and checks, and only if you give it a token.
//
// Three things shape the whole file.
//
// **The host does the dangerous part, and refuses most of it.** There is no force push, no
// reset, no discard and no merge in the API at all, and `pull` is fast-forward only — so
// nothing this plugin can do will destroy committed work or overwrite somebody else's. That
// is a property of Linelark, not of this code being careful, which is the only kind of
// safety worth relying on.
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
    remoteInfo: null
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
    var tracking = repository().tracking;
    return {
        type: "actions",
        actions: [
            { id: "action:fetch", title: "Fetch", symbol: "arrow.down.circle" },
            { id: "action:pull",
              title: tracking && tracking.behind
                  ? "Pull " + tracking.behind + " behind" : "Pull",
              symbol: "arrow.down.to.line" },
            { id: "action:push",
              title: tracking
                  ? (tracking.ahead ? "Push " + tracking.ahead + " ahead" : "Push")
                  : "Push and set upstream",
              symbol: "arrow.up.to.line" },
            { id: "action:view",
              title: state.tree ? "View as list" : "View as tree",
              symbol: state.tree ? "list.bullet" : "list.bullet.indent" },
            { id: "action:refresh", title: "Refresh", symbol: "arrow.clockwise" }
        ]
    };
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
    invalidate();
    if (!linelark.repoIsAvailable()) {
        return [
            { type: "heading", text: "No repository" },
            { type: "text",
              text: linelark.folderRoot()
                  ? "The open folder is not inside a git repository."
                  : "Open a folder to see its repository." },
            // Said here rather than nowhere: in the sandboxed edition this is not a
            // temporary state to be fixed by opening a different folder.
            { type: "text",
              text: "Git needs Linelark Studio; the Mac App Store edition cannot run it." }
        ];
    }

    var nodes = [{ type: "rows", rows: [branchRow()] }];
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
    nodes = nodes.concat(section("branches", "Branches", true, branchNodes()));
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
    invalidate();
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
        if (rest === "unstageAll") {
            var toUnstage = repository().staged.map(function (file) { return file.path; });
            if (toUnstage.length) {
                await perform("Unstage", function () { return linelark.repoUnstageAsync(toUnstage); });
            }
            return;
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
        // A pull request's own page. Opened as a buffer rather than in a browser: a plugin
        // has no way to open a URL, and this at least puts the thing in front of you.
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
            throw new Error("GitHub refused the request. Without a token you get 60 an hour; "
                            + "add one in Manage Plugins.");
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

// A pull request as a Markdown buffer.
//
// A plugin cannot open a browser — there is no API for it — so the next best thing is the
// description, in a tab, named `.md` so the Preview button lights up and the links in it
// become clickable there.
function openPullRequest(number) {
    var pull = null;
    (state.pulls || []).forEach(function (candidate) {
        if (String(candidate.number) === String(number)) { pull = candidate; }
    });
    if (!pull) { return; }
    var lines = [
        "# " + pull.title,
        "",
        "[#" + pull.number + " on GitHub](" + pull.html_url + ")",
        "",
        "| | |",
        "| --- | --- |",
        "| Author | " + (pull.user ? pull.user.login : "unknown") + " |",
        "| Branch | `" + pull.head.ref + "` → `" + pull.base.ref + "` |",
        "| State | " + (pull.draft ? "draft" : pull.state) + " |",
        "| Updated | " + pull.updated_at + " |",
        "",
        "---",
        "",
        pull.body || "*No description.*"
    ];
    linelark.openVirtual({
        key: "pr:" + pull.number,
        name: "PR-" + pull.number + ".md",
        label: "GitHub",
        text: lines.join("\n"),
        language: "markdown"
    });
}
