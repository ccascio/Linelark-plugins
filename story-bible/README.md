# Story Bible

The notes a long piece of writing needs beside it: characters, plot, places, and whatever
else you decide to keep. They belong to the **whole story** rather than to any one chapter
of it, they save themselves as you type, and they come back when you open the folder again.

Appears in the **right dock** — open it with **View ▸ Show Right Dock** (⌥⌘B).

Three commands appear under **Plugins**, which is also how they get keyboard shortcuts:
macOS binds any menu item under **System Settings ▸ Keyboard ▸ Keyboard Shortcuts ▸ App
Shortcuts**, and a menu item is the only thing a plugin can offer to be bound.

- **Add the Selection to the Story Bible** — the fastest way in: highlight a line in the
  manuscript and it is appended to the pane you were last writing in
- **Copy the Story Bible**
- **Export the Story Bible**

## What it does

A bible is a handful of named panes. A new one starts with Characters, Plot, Places and
Notes; rename them, delete them, add your own. Each pane is a box you type into, and typing
saves itself about half a second after you stop.

Each pane has five actions:

| | |
| --- | --- |
| **Add the selected text** | appends what is highlighted in the document to this pane |
| **Insert into the document** | the other direction: the pane's text, at the caret |
| **Copy** | this pane |
| **Rename** | opens a box under the pane |
| **Delete** | twice — a plugin cannot put a question on the screen, and this text is the only copy of itself |

Above them, **Copy the whole bible** and **Export the whole bible as Markdown** — one file,
one `##` heading per pane.

## Why it is not the scratchpad

[`scratch-notes`](../scratch-notes/) keeps notes *about* a file, pinned to a line in it and
following the caret. This keeps notes about the *story*, and the difference is not a matter
of degree:

- **A character list must not be per file.** Kept the way scratch notes are, Mira would be
  a different Mira in every chapter. So a bible is keyed on `folderRoot()` — the folder is
  the story — and only falls back to the file when nothing is open around it.
- **`followsCaret` is fixed at load.** A scratchpad has to have it; a bible must not, or it
  would redraw itself on every arrow key while somebody is typing into it. One panel cannot
  be both, which is why these were always going to be two.
- **Panes are named and permanent.** A scratch note's identity is a line number and it is
  meant to be thrown away. Characters is Characters until you rename it.

## What it shows

**A `section` is a tab bar that lets you keep two things open.** The panes are sections, and
a section remembers whether it is open — the plugin says how it *starts* and the view owns
it after that, which is why `id` has to survive a rename. So you get the one-at-a-time
reading a tab bar gives without the thing a tab bar takes away: Characters can stay open
while you write into Plot.

**`value` is the pane as stored, never the text being typed.** Handing back the live text
would move the cursor to the end on every autosave. Handing back the *stored* text is safe
for the same reason: while somebody types it does not change, so the view sees the value it
already adopted and leaves the box alone, and when a save lands it is equal to what the box
already holds. It is also the only thing that makes a box survive being thrown away and
rebuilt — switching panels in the dock does exactly that — holding what was actually saved
rather than whatever it said when the panel opened.

**A node's identity is its position, so the node list must not change shape as it saves.**
A box's typing belongs to the fifth node, not to the field's id. A node that comes and goes
would slide every box below it onto another pane's contents. Hence one status line that is
always drawn and only ever changes its words — which is also what makes it safe to redraw
while somebody is typing, and so to keep the word counts live.

**A plugin that rewrites a box has to expect the old text back.** Adding the selection to a
pane changes text somebody may be in the middle of typing, and the host answers a changed
`value` by *delivering* the pending save rather than dropping it — losing half a second of
typing is the worse bug, so it is not the one the host chose. That leaves this one: the
delivered save describes the text as it was before the append, and taking it at face value
would undo it. So the field's id carries a revision, the addition is parked against the
revision it was made at, and the late save is merged with it instead of replacing it.

**One key per pane, not one per story.** A pane's text cannot push the others past the
256 KB limit on a single value, and the list of panes is the store's own key list rather
than an index that has to be kept in step with it.

## API used

`addPanel({side: "right", onChange, onSubmit, onSelect})` · `addCommand` · `refreshPanels` ·
`log` · `folderRoot` · `filePath` · `fileName` · `isReadOnly` · `selection` · `insert` ·
`openFile` · `storeGet` · `storeSet` · `storeRemove` · `storeKeys` · `copyToClipboard` ·
`exportFile` · `setTimeout`

Nodes: `heading` · `text` · `rows` · `field` · `actions` · `button` · `section`.

Needs **`apiVersion` 3** — the store, the clipboard, `exportFile` and a panel's `onChange`
all arrived there. No network, no git, no permissions to grant.

## Known limits

- **Another story cannot be opened from the list.** There is no call to open a *folder*, so
  a folder-scoped bible in the "Other stories" list says what to do rather than doing it.
  One that is a single file opens.
- **The word counts are a draw behind while you type**, by half a second — they are counted
  from what is stored, which is the point at which they are true.
- **Renaming a pane does not rename anything in the export** beyond its own heading.
- **A story is its folder.** Move the folder and its bible does not follow; it is still in
  the store under the old path, listed under "Other stories".
