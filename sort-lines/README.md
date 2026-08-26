# Sort Lines

Sorts the lines the selection touches, and drops duplicates on request.

Two commands appear under **Plugins**:

- **Sort Selected Lines**
- **Sort Selected Lines and Remove Duplicates**

## What it shows

This is the shape of a plugin that *edits*, and it is three steps:

1. **Expand the selection to whole lines.** Selecting half of the first line and half of
   the last should still sort both of them, rather than cutting either in two — so the
   plugin walks outwards from the selection to the surrounding line breaks before it reads
   anything.
2. **Compute the whole replacement.** Split, sort, optionally de-duplicate, join.
3. **Apply it as a single `replaceRange`.**

Step 3 is the one worth copying. A loop of small edits produces a stack of undo steps the
user has to unwind one at a time, and every edit invalidates the offsets computed before
it. One replacement lands as one undoable edit, named after the command that made it, and
reaches every pane showing that buffer.

## API used

`addCommand`, `selectionRange`, `text`, `getRange`, `replaceRange`, `log`.
