# Compare Files

Compares two open files side by side and merges individual differences in either direction,
using a native view modelled on WinMerge.

## Using it

1. Right-click a file in the folder sidebar or an editor tab and choose
   **Compare Files ▸ Use as Left**. The Plugins menu still offers
   **Use Current File as Left** for the active tab.
2. Right-click the other file and choose **Compare Files ▸ Use as Right and Compare**.
3. Move through differences with the up/down buttons. Use **Take right** / **Take left**, or
   the arrows between the columns, to merge the current difference.

The **Compare** panel in the right dock offers the same workflow plus **Swap**, **Refresh**,
**Clear**, whitespace modes, and case-insensitive comparison. Clicking either source row
opens its editor tab.

A merge changes the target editor buffer as one undoable edit and immediately redraws the
comparison. It does **not** save the file. This matches a desktop merge tool: inspect several
merges, undo any you do not want, then save normally. If a source changed after the diff was
drawn, the plugin refuses the merge and asks for a refresh instead of overwriting newer work.

## How it works

The plugin computes a patience diff in JavaScript. Lines unique to both sides form stable
anchors; Myers diff handles the regions between them. Very large anchorless repeated regions
become one replacement block, avoiding quadratic trace memory while preserving a correct
merge.

The generated unified patch contains the whole file, so unchanged lines stay visible like
they do in WinMerge. `openDiff` draws aligned columns, line numbers, the current-difference
highlight, navigation, and merge arrows. Each arrow calls `onMerge(block, direction)`, where
the block number indexes the plugin's change list. After a merge the plugin recomputes the
patch and reopens the same keyed diff tab, so resolved differences disappear without piling
up tabs.

Whitespace has three modes: exact; collapse runs and ignore leading/trailing spaces; or
ignore spaces and tabs entirely. **Ignore letter case** can be combined with any mode. These
settings survive a restart; the selected files and their snapshots intentionally do not.

## API used

`addCommand`, `addContextMenuItem`, `addPanel` (with `side`, `render`, `onSelect`), `refreshPanels`, `fileName`,
`filePath`, `isReadOnly`, `text`, `setText`, `openFile`, `openDiff` (with `onMerge`),
`storeGet`, `storeSet`, `log`.

Node types: `text`, `rows`, `actions`, `button`, `section` — and `apiVersion` 4 for mergeable
diffs. Context-menu handlers receive the exact clicked file, with live unsaved text when
that file is already open.

## Deliberate limits

- It compares files already open in Linelark. This keeps unsaved editor text in scope and
  makes each merge a normal undoable edit rather than an invisible disk write.
- The final-newline state follows the source only when an EOF difference is merged. A final
  newline by itself is not shown as a separate difference.
- The native diff view caps rendering at 20,000 rows. The algorithm can compare larger files,
  but the view intentionally limits what it materialises.
