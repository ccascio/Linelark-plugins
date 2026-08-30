# Scratch Notes

A scratchpad that belongs to the file you are looking at. Notes are pinned to a line, save
themselves as you type, and come back when you return — to the file, and to the part of it
they were written about.

Appears in the **right dock** — open it with **View ▸ Show Right Dock** (⌥⌘B).

Four commands appear under **Plugins**, which is also how they get keyboard shortcuts:
macOS binds any menu item under **System Settings ▸ Keyboard ▸ Keyboard Shortcuts ▸ App
Shortcuts**, and a menu item is the only thing a plugin can offer to be bound.

- **New Scratch Note Here**
- **Note the Selection** — a new note, pre-filled with what you had selected
- **Copy the Nearest Scratch Note**
- **Export Notes for This File**

## What it does

Every note belongs to one file and one line in it. The box in the panel always edits the
note **nearest the caret**, so moving through a long document brings the note about *that*
part to the top, and clicking a note in the list moves the caret to its line. Those are the
same mechanism seen from both ends, which is why the panel is never showing one note while
pointing at another.

Typing saves itself about half a second after you stop. There is no Save button doing the
work — the one beside the box only says "now" — and nothing is lost by quitting.

## What it shows

**A panel can now be redrawn by the caret, and almost none should be.** `followsCaret: true`
is what makes this panel follow you. It is opt-in because moving the caret is the most
frequent thing anybody does in an editor: the signal is coalesced to five times a second,
but a panel that shells out to `git status` must not take it at all. This one is the case
the flag exists for — its content *is* a function of where you are.

**The box's id is the note's id.** `onChange` is delivered on a debounce, so it can arrive
after the panel has moved on to a different note; and when the plugin swaps `value`, the
host *flushes* the pending call rather than dropping it, because losing the last half-second
of typing would be the worse bug. Both together mean the identity has to travel with the
call, so the field is `note:ab12` rather than `note`. Without that, switching notes with a
save in flight writes one note's text into another.

**`value` is the note as stored, and never the live text.** The view adopts a differing
`value` by replacing what is in the box, so echoing back what was just typed would move the
cursor to the end on every keystroke that settles. The stored text is safe for the same
reason it is useful: while somebody types it does not change, so the box is left alone, and
when a save lands it is equal to what the box already holds. It is also what makes the box
survive being rebuilt — switching panels in the dock throws the field away — holding what
was actually saved rather than what the note said when the panel opened.

**A line number is a guess; the anchor is the check.** Nothing tells a plugin the document
was edited, so a note pinned to line 40 is pointing at whatever line 40 has become. Each
note also keeps the text of the line it was made on and re-finds it within 250 lines when
the two disagree, searching outwards so the nearer of two identical lines wins. Anchors
under four characters are not searched for at all — `}` matches everywhere.

**A refused write is drawn, not swallowed.** `storeSet` returns the reason rather than
throwing, and a full store is also the reason the panel looks empty: the note was never
stored, so the next draw cannot find it. That message sits above everything else.

## API used

`addPanel` (with `side`, `followsCaret`, `render`, `onSelect`, `onSubmit`, `onChange`),
`addCommand`, `refreshPanels`, `storeGet`, `storeSet`, `storeRemove`, `storeKeys`,
`copyToClipboard`, `exportFile`, `fileName`, `filePath`, `isReadOnly`, `lineCount`, `line`,
`caretLine`, `selection`, `setSelection`, `insert`, `log`.

Node types: `heading`, `text`, `rows`, `field`, `button`, `actions`, `section` — and the
store, the clipboard, `exportFile`, `caretLine`, `onChange` and `followsCaret` are all
`apiVersion` 3.

## Known limits

**Notes are keyed by file path.** Renaming or moving a file outside the editor leaves its
notes behind under the old path; they are still there, listed under **Other files**, but
they no longer follow the file. An unsaved buffer is keyed by its name, so two untitled
tabs called the same thing share a scratchpad.

**Anchors re-find text, not meaning.** A note survives lines being added above it, and
survives its line being moved within 250 lines. Delete the line it was written about and
the note stays at the number, now pointing at whatever moved into that position.

**Nothing is shared between windows.** The store is written on a debounce and read on each
draw, so two windows open on the same file will each keep their own idea of a note until one
of them redraws after the other has saved.
