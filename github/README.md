# GitHub

A repository panel for the open folder: the branch, a file tree with changed files marked,
and a commit graph. Clicking a changed file opens its committed version beside the working
copy, ready to compare in a split.

Adds an icon to the side panel's switcher, and a **Refresh Repository Panel** command.

## What it shows

**A panel is a description, not a drawing.** `render()` returns an array of nodes —
headings, rows, a tree, a graph — and Linelark draws every pixel with the same SwiftUI the
built-in panels use. That is the bargain: a plugin gets a real native panel in the right
theme in both appearances, and cannot paint arbitrary pixels or wedge the sidebar. The
tree is handed **flat `/`-separated paths**; the folder structure is built for you, so a
plugin listing a repository never nests anything by hand. The graph is handed commits with
their parents; the lane routing is not your problem.

**No network, and no token.** A file tree and a commit graph are facts about the repository
already on disk. Asking github.com for them would add a credential, a permission prompt and
an offline failure mode to something that works without any of them. Pull requests, issues
and Actions are the part that would genuinely need the API.

**The click is asynchronous.** Reading a revision out of git is the one read here that can
take long enough to see, so `onSelect` awaits `repoShowAsync` rather than calling the
synchronous `repoShow`, which would hold the whole window until git returned. Note that
`linelark.language()` is read *after* the await, because that is when the buffer is opened.

**The revision opens as a generated buffer.** `openVirtual` gives it highlighting, the find
bar and split panes for free, because it is the same kind of object every other tab is. Its
`key` is identity rather than a path, so clicking through the tree replaces one buffer's
text instead of stacking up a tab per click.

## Studio only

Read-only git needs subprocesses, which the sandbox blocks. The Mac App Store edition does
not ship the git reader at all, so `repoIsAvailable()` answers `false` there — the panel
checks it and explains itself rather than coming up empty, which reads as broken.

## API used

`addPanel` (with `onSelect`), `addCommand`, `refreshPanels`, `repoIsAvailable`, `repoHead`,
`repoRoot`, `repoFiles`, `repoLog`, `repoShowAsync`, `openFile`, `openVirtual`,
`folderRoot`, `language`.

## Known limits

Nothing watches the filesystem. The panel redraws when it appears, when the open folder or
front tab changes, and on request — so a commit made in a terminal underneath needs the
panel's refresh button or the command.
