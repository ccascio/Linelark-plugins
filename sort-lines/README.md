# Sort Lines

Sorts lines, and gives the sort a panel to be configured in: which lines, which part of
each line to compare, and in what order.

Three commands appear under **Plugins**:

- **Sort Selected Lines**
- **Sort Selected Lines and Remove Duplicates**
- **Reverse Selected Lines**

And a **Sort** panel in the right dock — **View ▸ Show Right Dock** (⌥⌘B).

## The settings

**Which lines.** The selection, the whole file, or a typed range: `10-40`, `10-` for line
10 to the end, `-40` for the start down to line 40, `12` for one line.

**Sort by.** The whole line, or a key cut out of it — from a column for a number of
characters, or from just after a piece of text for a number of characters. A character
count of `0` means the rest of the line. Columns are 1-based, and count UTF-16 code units,
which is what the editor's own offsets count in.

A line the marker is not on has no key at all rather than its whole self, so those lines
land together at one end where they can be seen. That is the answer to "why is that line in
the wrong place", and the panel shows it: the **What will be compared** list under the key
draws the first few lines with the key each one yields.

**How.** Ascending or descending; ignore case; compare numbers as numbers (`item2` before
`item10`); ignore leading blanks; remove duplicates.

The commands honour all of that except the range, which their own titles already state. On
a fresh launch the settings are their defaults, so the two original commands do exactly
what they always did.

## What it shows

**Editing is three steps, and the third is the one worth copying.** Expand the selection to
whole lines, compute the whole replacement, apply it with a single `replaceRange`. A loop
of small edits produces a stack of undo steps the user has to unwind one at a time, and
every edit invalidates the offsets computed before it. One replacement lands as one
undoable edit, named after the command that made it, and reaches every pane showing that
buffer.

**A panel is never told the caret moved.** `render()` runs when the panel appears, when the
front tab or the folder changes, and when the plugin calls `refreshPanels()` — not when the
selection changes. So nothing here is *gated* on the selection: Sort is never greyed out for
want of one, and it reads the selection at the moment it is pressed, which is the only
moment that answer is certainly current.

That is the rule the panel is built around. A control disabled for a reason the panel cannot
notice going away is a trap — the user selects the lines it asked for, no redraw happens,
and the button stays grey with no way to find out why. The two things Sort *is* disabled for
— a read-only tab and a line range that does not parse — are both things a redraw follows.

**Drawing a panel should not read the document.** A redraw happens on every tab change and
every save, and there is no watchdog. So the panel asks for line counts and at most six
lines; the document is walked only when Sort is actually pressed.

**A setting is kept as the text that was typed.** A field cannot be submitted empty — the
host disables its own button — so a value parsed on the way in could never be taken back
out. Parsing at the point of use instead lets the panel say what is wrong with `10..x`
while leaving it on screen to be corrected.

**`rows` is what a checkbox and a radio button are made of.** There is no toggle node: a row
is a title, a detail and a symbol, and `checkmark.square.fill` against `square` is what says
a row is behaving as a box to tick. Direction is two rows rather than a "Descending" box,
because it is a choice between two answers and not a flag — a box that has to be *unticked*
to get the ordinary behaviour reads as an option rather than as half of a pair.

## API used

`addCommand`, `addPanel` (with `side`, `render`, `onSelect`, `onSubmit`), `refreshPanels`,
`fileName`, `isReadOnly`, `text`, `length`, `lineCount`, `line`, `getRange`,
`selectionRange`, `setSelection`, `replaceRange`, `log`.

Node types: `heading`, `text`, `rows`, `field`, `button`, `actions`, `section` — which is
`apiVersion` 2.

## Known limits

**The settings do not survive a restart.** There is no key-value store in the plugin API.
"Sort by column 5" is the setting for the job in hand, which is the right lifetime for it,
and it is also why the menu commands start every session behaving as they always did.

**Duplicates are whole lines, never keys.** Two lines sharing a key are not the same line,
and removing one of them would be deleting text the user can see is different. Sorting by
column 3 and keeping one row per value is a real thing to want; it is not this.

**Only the first occurrence of the marker.** The key starts after the first `,`, so sorting
a CSV by its third column is not expressible here.

**Blank lines sort to one end** along with every other line whose key is empty, rather than
staying where they are.

**Line endings are `\n`.** A file with CRLF endings keeps its `\r` characters — nothing is
lost — but they sit at the end of every key and count in the comparison.
