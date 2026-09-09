# Launcher

The things a project runs, kept beside it: a name, a folder, and the lines that start it.
Click one and it runs in a terminal you can watch, answer and stop.

Appears in the **right dock** — open it with **View ▸ Show Right Dock** (⌥⌘B).

One command appears under **Plugins**, which is also how it gets a keyboard shortcut: macOS
binds any menu item under **System Settings ▸ Keyboard ▸ Keyboard Shortcuts ▸ App
Shortcuts**, and a menu item is the only thing a plugin can offer to be bound.

- **Run the Last Application** — whatever ran last, or the first one on the list

Needs **Linelark Studio** and the *Allow running commands* permission, which is off until
you switch it on in **Plugins ▸ Manage Plugins…**.

## What it does

Add an application, give it a name, say which folder it runs in and write the commands —
one per line:

```
npm ci && npm start
```

Clicking it in the list opens the terminal panel, starts a shell in that folder, and types
those lines into it. That shell belongs to that application: running it again goes back to
the same pane rather than starting a second one, and two applications in one project stay
two panes.

Leave **Folder** empty and it runs in the folder of the tab in front, which is usually what
a launcher for the project you are looking at should do. `~` works, and **Choose a folder…**
under the box opens a picker.

Everything saves as you type. There is no Save button, deliberately — see below.

## What it shows

**A plugin cannot start a process, and this is what it can do instead.** `runInTerminal`
types command lines at a shell in the terminal panel and shows it. Nothing comes back: no
exit status, no output, no promise. That is the trade the API makes on purpose — the output
belongs to the terminal, where it scrolls, where ⌃C stops it, where a password prompt can be
answered, and where ↑ runs it again after this panel is closed. A plugin that reported an
exit code would have had to be handed a hidden process to get one.

**It only runs from a click.** The host refuses `runInTerminal` from a timer, from `render`,
or from anything after an `await` — the gesture is checked at the moment of the call, and an
`await` ends it. A launcher that could start something while nobody was at the machine would
be a different and much worse thing than one that cannot.

**The permission is the boundary, not the folder box.** A command can do anything you can
do, so nothing is gained by policing where it runs; what is checked instead is that the
folder exists, before the shell sees it. A `cd` that fails scrolls past in a pane nobody is
watching, and then everything after it runs somewhere else — for a launcher that is the
difference between building this project and building another one.

**The lines are typed as one shell line, joined with `;`.** They are written one per line
and they run in that order, each whether or not the one before it worked — `npm ci && npm
start` on one line is how to say "only if that worked". What they are *not* is typed one
line at a time: a shell does not read the second line until the first command has finished,
so the rest sit in the terminal's input buffer where that command can read them instead.
`sudo` is where it shows — it prompts, takes the next command as the password, and that
command is not delayed but eaten. One line leaves nothing buffered to steal.

**There is no Save button on purpose.** A form that gathers what is typed and commits it on
a click loses whatever was typed in the last half-second before that click: `onChange` is
delivered on a debounce, so the click beats the keystrokes to the store. Saving each box as
it settles has no such window — and it is what lets every field hand back the *stored* value
on every draw, which is the only thing that does not rewrite a box under the cursor.

**Every field's id carries the application it belongs to.** `onChange` arrives late by
construction and can land after the panel has moved on. It comes back with the id it was
scheduled with, so `folder:ab12` says which record the text was for and a late save lands on
the application it was typed into rather than on whichever one is in front now.

**Browse is a panel, and a panel is the permission.** `chooseFolder` puts an open panel on
screen and hands back the one folder somebody picked — the mirror of `exportFile`, which is
why it needs no manifest declaration and no switch. A plugin still cannot name a directory
and be given it; it can only be given what a user chose, one folder at a time. Like running,
it must come straight from a click.

**Choosing rewrites a box somebody may be typing in, which is the one case that needs a
revision.** A save typed a moment before the panel opened is still in flight and arrives
holding the old text — and the host *flushes* that call rather than dropping it, because
losing the last half-second of typing is the worse bug in every other case. So the folder
field is `folder:ab12@3`, and a save from an era that has ended is discarded: the folder just
chosen wins over the typing it replaced.

**The submit button is the host's, not the plugin's.** A field is drawn with one whether or
not a plugin asks for a title for it, so a panel that handles only `onChange` has a button on
screen that does nothing when pressed. This one says *Save now* and means it — the debounce
has usually saved already, and it is delivered with what the box holds at that moment, so no
revision can make it stale the way a scheduled call can.

**A refused write is drawn, not swallowed.** `storeSet` returns the reason rather than
throwing, and so does every refusal from the host — a permission switched off since the
panel was drawn, a folder that has been moved. The panel says which, above everything else,
with a button to the switch when there is one to press.

## API used

`addPanel` (with `side`, `render`, `onSelect`, `onChange`, `onSubmit`), `addCommand`,
`refreshPanels`,
`canRunInTerminal`, `runInTerminal`, `chooseFolder`, `storeGet`, `storeSet`, `folderRoot`,
`copyToClipboard`, `openPluginSettings`, `log`.

Node types: `heading`, `text`, `rows`, `button`, `actions`, `section`, `field`.

`canRunInTerminal` and `runInTerminal` are `apiVersion` 10, and the manifest declares
`"terminal": "run"` to ask for them. `chooseFolder` is 10 as well and declares nothing. The
store and `onChange` are 3; `openPluginSettings` is 6.

## Known limits

**Nothing comes back from a run.** The panel cannot say whether an application started,
failed, or is still running — only that the lines were typed. What happened is in the
terminal.

**Studio only.** The sandboxed App Store edition has no terminal panel at all, so
`canRunInTerminal()` answers `false` there and the switch cannot be turned on. The panel
cannot tell that apart from a permission nobody has granted yet — one boolean is all it gets
— so it names both.

**A second run types into the same shell.** If the last one is still running — a server,
a watcher — the new lines go to *that program's* input, exactly as they would if you typed
them. Stop it with ⌃C first, or give the second one its own name.

**The list is per machine, not per project.** Applications are kept in this plugin's store,
which is one file for the plugin rather than one per folder, so the same list appears in
every window. Each entry names its own folder, which is what keeps them apart.
