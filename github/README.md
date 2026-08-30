# GitHub

A git client in the side panel. Stage, commit, fetch, pull and push; add, edit and remove
remotes; read the diff of anything that has changed; switch and create branches — and sign
in to GitHub for private repositories, pull requests and checks.

Adds an icon to the side panel's switcher and eight commands under **Plugins ▸ GitHub**:
*Refresh Repository Panel*, *Compare This File With HEAD*, *Stage This File*, *Pull*,
*Push*, *Sign In to GitHub…*, *GitHub Account…* and *Open Repository on GitHub*.

## Before it can do anything

Two switches in **Plugins ▸ Manage Plugins…**, both off until you turn them on:

- **Allow changes to git** — everything that writes. Without it the panel still shows the
  branch, the changes and the diffs; it just cannot alter them, and says so.
- **Allow network access** — only for the github.com section at the bottom. Everything above
  it works offline.

The **GitHub account** section in the panel says whether API requests are anonymous or
signed in. Without a credential, pull requests and checks work for public repositories at
the anonymous rate limit (60 requests an hour); signing in lifts that and reaches private
ones.

**Sign in with your browser** runs GitHub's OAuth *device flow*, in two clicks. The first
asks GitHub for an eight-character code, which the panel shows and copies to your clipboard.
The button then becomes **Open github.com/login/device**; pressing it opens that page with
the code still on the clipboard, and you paste it there and approve. The plugin has been
polling GitHub since the code arrived, so the panel says *Signed in to GitHub.* a few seconds
later by itself.

Two clicks rather than one on purpose. Opening the browser first is a tab asking for a code
that has not been displayed yet — the code would be arriving in an editor behind it.
**Cancel sign-in** stops the polling, and a code that goes unapproved expires by itself after
fifteen minutes.

There is no redirect back into Linelark, and that is the reason this uses the device flow
rather than the usual OAuth one: the editor registers no URL scheme and a plugin cannot
listen on a socket, so a callback has nowhere to land. The device flow is the grant designed
for programs in exactly that position. The scope asked for is `repo`, which is the narrowest
OAuth scope that covers a private repository's pull requests and check runs.

**Paste a token instead** opens this plugin's own settings with the **GitHub token** field
selected, and **Create a token on GitHub** opens GitHub's fine-grained-token page — a
fine-grained token with read access to the repository does the same job without signing an
OAuth app in. **Sign out** removes whichever of the two is stored.

Either way the plugin never sees the value. It hands the token it obtained straight to the
host, which keeps it in the Keychain and attaches it only to requests bound for
`api.github.com`; there is no call that reads one back, so the plugin is left holding a
boolean. A credential is never written to the plugin's own store, which is an ordinary file
in Application Support.

This signs in the GitHub API half of the panel. Git fetch, pull and push continue to use the
normal git credential helper, so an existing SSH key, Keychain credential or `gh` login keeps
working exactly as it does in the terminal.

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

**Remotes are visible and editable.** Expand **Remotes**, select one to change its URL or
remove it, or enter a name and URL to add another. Names and URLs are validated by the host,
all changes require **Allow changes to git**, and Linelark itself confirms removal. Removing
a remote does not delete local files, branches or commits.

**GitHub links open where they belong.** A pull-request row opens the pull request in the
default browser, and the account section can open the repository, the device-flow page or
GitHub's token page. `openURL` is honoured only while the click that asked for it is still
running, which is why opening the device page is a button of its own rather than something
that happens at the end of the sign-in click. The device page's URL comes from GitHub's own
reply and is opened only if it is a `github.com` one.
Only absolute `http` and `https` links can cross that host API.

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
handling, no commit amending, no per-hunk staging, and no clone or repository-initialization
flow. Sign-in reaches the API half only — it cannot authenticate a push, which belongs to
git and its credential helper.

## Studio only

Git needs subprocesses and the sandbox blocks them, so the Mac App Store edition ships
without the git reader entirely. `repoIsAvailable()` answers `false` there and the panel says
so rather than coming up empty, which reads as broken.

## Checking a change

`node test.mjs` drives the panel against a stubbed host: the whole device flow is scripted
reply by reply — pending, `slow_down`, approved, expired, cancelled — because a polling loop
driven by what a server says is the part of this that cannot be checked by reading it.

## Known limits

Nothing watches the filesystem. The panel redraws when it appears, when the open folder or
front tab changes, after anything it did itself, and on request — so a commit made in a
terminal underneath needs the refresh row or **Refresh Repository Panel**.

The history graph is capped at 120 commits, and the check-run roll-up describes the commit at
`HEAD`, not the pull request's own head — they are usually the same and occasionally are not.

## API used

`addPanel` (with `onSelect` and `onSubmit`), `addCommand`, `refreshPanels`, `openFile`,
`openURL`, `openPluginSettings`, `log`, `filePath`, `folderRoot`, `fetch`,
`canReachNetwork`, `hasSecret`, `setSecret`, `clearSecret`, `copyToClipboard`,
`repoIsAvailable`, `repoRoot`, `repoHead`, `repoFiles`, `repoLog`, `repoTracking`,
`repoBranches`, `repoRemotes`, `repoDiffAsync`, `repoCanWrite`, `repoStageAsync`,
`repoUnstageAsync`, `repoCommitAsync`, `repoFetchAsync`, `repoPullAsync`, `repoPushAsync`,
`repoSwitchAsync`, `repoCreateBranchAsync`, `repoAddRemoteAsync`,
`repoSetRemoteURLAsync`, `repoRemoveRemoteAsync`.

Panel nodes: `rows`, `tree`, `section`, `actions`, `button`, `heading`, `text`, `graph`, `field`.
Opening: `openFile`, `openDiff` — a clicked file's patch is drawn side by side.
Git write: adds `repoDiscardAsync`, which the host confirms before running.
