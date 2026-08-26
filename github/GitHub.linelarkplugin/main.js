// A GitHub-style repository panel, built entirely from local git.
//
// There is no network call and no token here on purpose: a file tree and a commit graph
// are facts about the repository already on disk, so asking github.com for them would add
// a credential, a permission prompt and an offline failure mode to something that works
// without any of them. The remote-only half — pull requests, issues, Actions — is what
// would genuinely need the API.
//
// Read-only git is a Studio capability: the sandboxed Mac App Store edition cannot run
// subprocesses, so `linelark.repoIsAvailable()` answers false there and this panel
// explains itself instead of looking broken.

var COMMIT_LIMIT = 120;

function statusBadge(state) {
    if (!state) return null;
    if (state === "??") return "new";
    return state;
}

function changedFiles(files) {
    return files.filter(function (file) { return file.state !== ""; });
}

function overview() {
    var head = linelark.repoHead();
    var changed = changedFiles(linelark.repoFiles());

    return {
        type: "rows",
        rows: [
            {
                id: "branch",
                title: head || "detached",
                detail: linelark.repoRoot(),
                symbol: "arrow.triangle.branch"
            },
            {
                id: "changes",
                title: changed.length === 0
                    ? "Working tree clean"
                    : changed.length + (changed.length === 1 ? " file changed" : " files changed"),
                symbol: changed.length === 0 ? "checkmark.circle" : "pencil.circle",
                badge: changed.length ? String(changed.length) : null
            }
        ]
    };
}

linelark.addPanel({
    id: "repository",
    title: "Repository",
    symbol: "arrow.triangle.branch",

    render: function () {
        if (!linelark.repoIsAvailable()) {
            var reason = linelark.folderRoot()
                ? "The open folder is not inside a git repository."
                : "Open a folder to see its repository.";
            return [
                { type: "heading", text: "No repository" },
                { type: "text", text: reason }
            ];
        }

        var nodes = [overview()];

        var files = linelark.repoFiles();
        if (files.length) {
            nodes.push({ type: "heading", text: "Files" });
            nodes.push({
                type: "tree",
                items: files.map(function (file) {
                    return { path: file.path, badge: statusBadge(file.state) };
                })
            });
        }

        var commits = linelark.repoLog(COMMIT_LIMIT);
        if (commits.length) {
            nodes.push({ type: "heading", text: "History" });
            nodes.push({ type: "graph", commits: commits });
        }

        return nodes;
    },

    // Clicking a changed file opens the committed version beside the working copy, so the
    // two can be compared in a split. An unchanged file just opens — there is nothing to
    // compare it against, and a second identical tab would be noise.
    //
    // Asynchronous because reading a revision out of git is the one read here that can take
    // long enough to see. `repoShowAsync` runs it off the main thread and settles a promise,
    // so the editor keeps drawing and scrolling while a large file is fetched; the
    // synchronous `repoShow` would hold the whole window until git returned.
    onSelect: async function (id) {
        if (id === "branch" || id === "changes") {
            linelark.refreshPanels();
            return;
        }

        var state = null;
        linelark.repoFiles().forEach(function (file) {
            if (file.path === id) state = file.state;
        });

        if (!state || state === "??") {
            linelark.openFile(id);
            return;
        }

        var committed = await linelark.repoShowAsync(id);
        if (committed === null) {
            linelark.openFile(id);
            return;
        }

        // The working copy first, so the editor lands on the file being worked on; the
        // committed text opens beside it as a read-only buffer. Both happen after the await,
        // which is why the language is read here rather than before it.
        linelark.openFile(id);
        linelark.openVirtual({
            key: "HEAD:" + id,
            name: id.split("/").pop(),
            label: "HEAD",
            text: committed,
            language: linelark.language()
        });
    }
});

linelark.addCommand("refresh", "Refresh Repository Panel", function () {
    linelark.refreshPanels();
});
