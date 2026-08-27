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
    // Filled in by the GitHub half when it has something. Never blocks the panel.
    remoteInfo: null
};

// MARK: - Running a write

// The one path every change goes through, so "in progress" and "here is what git said" are
// not something each action has to remember to do.
async function perform(label, work) {
    if (state.busy) {
        return null;
    }
    state.busy = label;
    state.outcome = null;
    invalidate();
    linelark.refreshPanels();
    var result = null;
    try {
        result = await work();
        state.outcome = {
            ok: result.ok,
            // git is quiet on success — `--quiet` is passed precisely so a panel is not
            // filled with progress — so say something when it says nothing.
            text: result.output || (result.ok ? label + " finished." : label + " failed.")
        };
    } catch (error) {
        // A refusal from the host arrives here: no consent, no repository, wrong edition.
        state.outcome = { ok: false, text: String(error && error.message ? error.message : error) };
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
function remoteRows() {
    var tracking = repository().tracking;
    var rows = [];
    if (state.busy) {
        rows.push({ id: "noop", title: state.busy + "…", symbol: "clock" });
        return rows;
    }
    rows.push({ id: "action:fetch", title: "Fetch", symbol: "arrow.down.circle" });
    rows.push({
        id: "action:pull",
        title: tracking && tracking.behind ? "Pull " + tracking.behind + " behind" : "Pull",
        symbol: "arrow.down.to.line"
    });
    rows.push({
        id: "action:push",
        title: tracking
            ? (tracking.ahead ? "Push " + tracking.ahead + " ahead" : "Push")
            : "Push and set upstream",
        symbol: "arrow.up.to.line"
    });
    return rows;
}

function fileRows(files, staging) {
    return files.map(function (file) {
        return {
            id: (staging ? "diff:staged:" : "diff:worktree:") + file.path,
            title: file.path,
            symbol: symbolFor(file, staging),
            badge: badge(file, staging),
            detail: state.selected === file.path ? "selected" : null
        };
    });
}

// The actions for whichever file is selected. Rows of their own, because a row has one
// click and it is already spent on showing the diff.
function selectionRows() {
    if (!state.selected) { return []; }
    var file = fileOf(state.selected);
    if (!file) {
        state.selected = null;
        return [];
    }
    var name = state.selected.split("/").pop();
    var rows = [];
    if (file.unstaged || file.untracked) {
        rows.push({ id: "stage:" + state.selected, title: "Stage " + name,
                    symbol: "plus.square" });
    }
    if (file.staged) {
        rows.push({ id: "unstage:" + state.selected, title: "Unstage " + name,
                    symbol: "minus.square" });
    }
    rows.push({ id: "open:" + state.selected, title: "Open " + name, symbol: "doc.text" });
    return rows;
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
    nodes.push({ type: "rows", rows: remoteRows() });

    if (state.outcome) {
        nodes.push({ type: "heading", text: state.outcome.ok ? "Done" : "git said" });
        nodes.push({ type: "text", text: state.outcome.text,
                     style: state.outcome.ok ? "secondary" : "primary" });
    }

    var repo = repository();
    var stagedFiles = repo.staged;
    var unstagedFiles = repo.unstaged;

    if (stagedFiles.length) {
        nodes.push({ type: "heading", text: "Staged · " + stagedFiles.length });
        nodes.push({ type: "rows", rows: fileRows(stagedFiles, true) });
        nodes.push({ type: "rows", rows: [{ id: "action:unstageAll", title: "Unstage everything",
                                            symbol: "minus.square" }] });
    }

    if (unstagedFiles.length) {
        nodes.push({ type: "heading", text: "Changes · " + unstagedFiles.length });
        nodes.push({ type: "rows", rows: fileRows(unstagedFiles, false) });
        nodes.push({ type: "rows", rows: [{ id: "action:stageAll", title: "Stage everything",
                                            symbol: "plus.square" }] });
    }

    if (!stagedFiles.length && !unstagedFiles.length) {
        nodes.push({ type: "rows", rows: [{ id: "action:refresh", title: "Working tree clean",
                                            symbol: "checkmark.circle" }] });
    }

    var selection = selectionRows();
    if (selection.length) {
        nodes.push({ type: "heading", text: "Selected file" });
        nodes.push({ type: "rows", rows: selection });
    }

    // Only offered when it could work. A commit box on a plugin the user has not allowed to
    // write is a box that throws when you press the button.
    if (repo.canWrite) {
        nodes.push({ type: "heading", text: "Commit" });
        nodes.push({
            type: "field", id: "commit",
            placeholder: stagedFiles.length
                ? "Message for " + stagedFiles.length + " staged file"
                    + (stagedFiles.length === 1 ? "" : "s")
                : "Stage something first",
            value: state.message,
            multiline: true,
            submit: "Commit",
            enabled: stagedFiles.length > 0 && !state.busy
        });
    } else {
        nodes.push({ type: "heading", text: "Read-only" });
        nodes.push({ type: "text",
                     text: "Allow “Changes to git” for this plugin in Plugins ▸ Manage "
                         + "Plugins to stage, commit, pull and push from here." });
    }

    nodes = nodes.concat(branchNodes());
    nodes = nodes.concat(remoteInfoNodes());

    if (repo.commits.length) {
        nodes.push({ type: "heading", text: "History" });
        nodes.push({ type: "graph", commits: repo.commits });
    }
    return nodes;
}

function branchNodes() {
    var branches = repository().branches;
    if (branches.length < 1) { return []; }
    var nodes = [{ type: "heading", text: "Branches" }];
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
    linelark.openVirtual({
        key: "diff:" + (isStaged ? "staged:" : "worktree:") + path,
        name: path.split("/").pop() + ".diff",
        label: isStaged ? "staged" : "changes",
        text: diff,
        // The editor already knows how to colour a unified diff, so this costs one word.
        language: "diff"
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
    // Anything else is a path in the tree, which means open it.
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

function remoteInfoNodes() {
    var slug = githubSlug();
    if (!slug) { return []; }

    var nodes = [{ type: "heading", text: "github.com/" + slug.owner + "/" + slug.repo }];
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
