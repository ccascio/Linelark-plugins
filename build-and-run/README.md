# Build and Run

Build, test and run an Xcode project from the side panel. Pick a scheme and a destination,
press one of three buttons, and the `xcodebuild` line is typed into the terminal panel where
you can read it, stop it with ⌃C and copy it.

Adds an icon to the side panel's switcher. No commands and no menu items: everything it does
is a button in the panel, because every one of them needs a scheme and a destination chosen
first.

## Before it can do anything

Two switches in **Plugins ▸ Manage Plugins…**, both off until you turn them on, and the
panel says which is missing rather than looking broken:

- **Allow reading command output** — how it finds out what the project contains. Without it
  there is nothing to choose from and the panel is a sentence explaining that.
- **Allow running commands** — how the build actually starts. Without it the lists work and
  the buttons refuse.

**Studio only.** The App Store edition is sandboxed and cannot run subprocesses at all, so
both switches are absent there and the panel says so.

## What it does

**Scan project** asks three things at once: `ls` for what kind of project this is,
`xcodebuild -list -json` for the schemes, and `xcrun simctl list -j devices available` for
the simulators. Nothing is built. What comes back is remembered per folder, so reopening the
project tomorrow does not mean scanning again.

What was remembered is checked once a session, on the first press in that folder, because a
remembered answer is only as true as the day it was stored. The check is a scan like any
other and usually changes nothing; the one press it is visible in is **Run**, **Build** or
**Test**, which say so and ask to be pressed again rather than building against an answer
that is one second from being replaced. Each stored answer also names the folder it is about
and is discarded when that is not the folder it was found under — one project's schemes
drawn as another's is the failure this is here to prevent.

Then **Scheme** and **Destination** are lists to pick from, and:

- **Run** — builds and launches. On a simulator that means booting it, opening Simulator,
  installing the `.app` and launching it by the bundle identifier read out of its
  `Info.plist`. On My Mac it means `open`ing the `.app` — or, when the scheme produced no
  bundle at all, running the binary it did produce, which is the ordinary shape of a SwiftPM
  executable product and is already at a terminal. When there is neither, the line says which
  directory it looked in rather than launching something. `open ""` is not an error: it hands
  the shell's working directory to the system Finder, so the failure used to look like a
  window of someone else's app opening on top of a build that reported success.
- **Build** — `xcodebuild build`, and nothing else.
- **Test** — `xcodebuild test`. The `-configuration` flag is deliberately *not* passed here:
  a scheme names its own configuration for testing, and overriding it would quietly run the
  tests in a way the project did not ask for.

Builds go to `$TMPDIR/linelark-build`, not into the project. A `-derivedDataPath` under the
folder being edited drops a large build directory into your repository, and the first you
would know of it is version control showing a thousand new files.

With both a `.xcodeproj` and a `.xcworkspace` in one folder, `xcodebuild` picks one without
being asked and without saying which. The **Project file** section names what it chose and
lets you override it — shut by default, because a question that has already been answered
should not look like one that has not.

## Why it is shaped like this

**Discovery is a query; doing anything is a shell.** `linelark.runQuery` runs a command out
of sight and hands back what it printed, which is the only way a panel can know that this
project has two schemes called what they are called. `linelark.runInTerminal` types a line at
a visible shell and tells the plugin nothing, which is right for a build: the output *is* the
thing you want, a failure is something to read rather than a boolean, and ⌃C has to reach it.
Using either one for the other's job would be worse in both directions.

**A click is the unit of permission, and an `await` ends it.** Both calls are refused unless
they are the direct result of pressing something. So every query the scan makes is issued
*synchronously*, together, with `Promise.all` — awaiting them one after another would have
the second refused, and rightly: a plugin that could go on asking after the click is a plugin
that runs commands when nobody is at the machine. Where an answer genuinely depends on an
earlier one, the panel asks *you* — which is why choosing the project file is a row you press
rather than something resolved behind the scenes.

**The panel never queries to draw itself.** `render()` reads only what a previous scan left
behind. A panel is redrawn whenever the workspace changes — a keystroke, a tab switch, a file
saved — and `xcodebuild -list` takes the better part of a second. It is also not a user
action, so it *could* not query even if it wanted to: this is why the session's check hangs
off the first press rather than off the panel opening, which is where one would first think
to put it.

**Nothing here knows what a scheme or a device is called.** There is no table of device names
and no guess at what the schemes might be. The vocabulary of an Xcode project changes with
every Xcode release, and a plugin that shipped a copy of it would be wrong by the following
autumn.

**Quoting is the plugin's job, and only in one direction.** `runQuery` takes an argument list
and has no shell at all, so nothing there needs quoting. `runInTerminal` types a line *at* a
shell, so a scheme called `My App (Beta)` is three words and a subshell unless it is quoted —
`sh()` is the four lines that do it, and it is checked against schemes containing an
apostrophe, a `;` and a `$( )`.

## API used

`addPanel` with `render` and `onSelect` · `runQuery` · `canRunQuery` · `runInTerminal` ·
`canRunInTerminal` · `workspaceFolders` · `folderRoot` · `storeGet` · `storeSet` ·
`refreshPanels` · `log`

Panel nodes: `heading`, `text`, `rows`, `button`, `actions`, `section`.

Generation 12 — `runQuery` and `canRunQuery`.
