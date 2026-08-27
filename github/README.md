# GitHub

A git client in the side panel. Stage, commit, fetch, pull and push; read the diff of
anything that has changed; switch and create branches — and, if you give it a token, see the
open pull requests and the state of the checks on your last commit.

Adds an icon to the side panel's switcher and five commands under **Plugins ▸ GitHub**:
*Refresh Repository Panel*, *Compare This File With HEAD*, *Stage This File*, *Pull* and
*Push*.

## Before it can do anything

Two switches in **Plugins ▸ Manage Plugins…**, both off until you turn them on:

- **Allow changes to git** — everything that writes. Without it the panel still shows the
  branch, the changes and the diffs; it just cannot alter them, and says so.
- **Allow network access** — only for the github.com section at the bottom. Everything above
  it works offline.

The **GitHub token** field is optional. Without one, pull requests and checks work for public
repositories at the anonymous rate limit (60 requests an hour); a fine-grained token with
read access to the repository lifts that and reaches private ones. The plugin never sees the
value: Linelark stores it and attaches it to requests bound for `api.github.com`.

## What it shows

**Comparing uncommitted with committed is git's own answer, not one computed here.** Clicking
a changed file opens `git diff` for it in a tab, highlighted as a diff, in the split you
already have. Files in **Changes** are compared against the index; files in **Staged** are
compared against `HEAD`; an untracked file is shown as a whole-file addition, because
`git diff` says nothing at all about a file it has never seen. A diff the plugin computed
itself would disagree with the command line the first time a rename or a whitespace option
came up.

**A row has one click, so a file gets one meaning.** Clicking a file shows its diff and
*selects* it; the things you can do to that file appear as their own rows underneath. Fitting
"open the diff" and "stage it" onto one row would mean guessing which was meant.

**The panel says what a button would do.** *Pull 2 behind* and *Push 3 ahead* rather than
*Pull* and *Push*, and *Push and set upstream* when the branch tracks nothing. While an
operation runs the row says so, and the result — git's own words, success or failure — stays
on screen until the next one.

**Every git answer is read once per draw.** The nodes below want the same file list five
times over, and each read is a subprocess. There is deliberately *no* cache across draws: one
was tried, and it made the panel show the working tree as it had been before the last save
and go on saying "read-only" for two seconds after permission was granted. Anything the user
can change out of band must not come from a cache.

## What it will not do

None of this is the plugin being careful. It is the API refusing, which is the only kind of
safety worth relying on:

- **No force push, ever.** A push that would overwrite somebody else's commits is rejected by
  git and reported.
- **No reset, no discard, no clean.** Nothing here can destroy uncommitted work. Unstaging
  returns a change to the working tree; it does not throw it away.
- **Pull is `--ff-only`.** A pull that would have to merge is refused rather than performed —
  a sidebar is the wrong place to be in a conflicted merge, and the terminal is right there.
- **No credential prompts.** Push and pull run with `GIT_TERMINAL_PROMPT=0`, so a repository
  that needs a password fails with git's own message rather than hanging the editor on a
  prompt no window is showing. Authenticate once in the terminal and the credential helper
  answers silently afterwards.

Also missing, deliberately or otherwise: no merge or rebase, no tags, no stash, no submodule
handling, no commit amending, no per-hunk staging, and no way to open a pull request in your
browser — a plugin cannot open a URL. A pull request opens as a Markdown tab instead, where
**Preview** (⇧⌘V) makes its links clickable.

## Studio only

Git needs subprocesses and the sandbox blocks them, so the Mac App Store edition ships
without the git reader entirely. `repoIsAvailable()` answers `false` there and the panel says
so rather than coming up empty, which reads as broken.

## Known limits

Nothing watches the filesystem. The panel redraws when it appears, when the open folder or
front tab changes, after anything it did itself, and on request — so a commit made in a
terminal underneath needs the refresh row or **Refresh Repository Panel**.

The history graph is capped at 120 commits, and the check-run roll-up describes the commit at
`HEAD`, not the pull request's own head — they are usually the same and occasionally are not.

## API used

`addPanel` (with `onSelect` and `onSubmit`), `addCommand`, `refreshPanels`, `openFile`,
`openVirtual`, `log`, `filePath`, `folderRoot`, `fetch`, `canReachNetwork`, `hasSecret`,
`repoIsAvailable`, `repoRoot`, `repoHead`, `repoFiles`, `repoLog`, `repoTracking`,
`repoBranches`, `repoRemotes`, `repoDiffAsync`, `repoCanWrite`, `repoStageAsync`,
`repoUnstageAsync`, `repoCommitAsync`, `repoFetchAsync`, `repoPullAsync`, `repoPushAsync`,
`repoSwitchAsync`, `repoCreateBranchAsync`.

Panel nodes: `rows`, `heading`, `text`, `graph`, `field`.
