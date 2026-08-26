# Scratch Notes

Lists the `TODO`, `FIXME`, `HACK` and `XXX` comments in the file you are looking at.
Clicking one selects that line.

Appears in the **right dock** — open it with **View ▸ Show Right Dock** (⌥⌘B).

## What it shows

**The right dock is the same API, on the other edge.** Declaring `side: "right"` is the
only difference from a left-hand panel. Everything else — the descriptor, `render()`,
`onSelect`, the node types — is identical, and the dock has its own switcher showing one
icon per panel.

The two edges are for different things. The side panel describes the *project*: a file
tree, a repository, search results. The right dock is for what sits *beside the work*: an
outline, test results, an assistant. This plugin belongs on the right because it describes
the file in front of you, not the folder.

**A panel reads the front document.** `render()` is called when the panel appears, when the
open folder or front tab changes, and whenever the plugin calls `refreshPanels()` — not on
every frame — so it can walk the buffer line by line without that costing anything during
scrolling.

**`onSelect` need not open a file.** Here it moves the caret with `setSelection`, which also
scrolls the line into view and focuses the editor. A panel with no `onSelect` at all still
opens the paths in its tree; supplying one takes first refusal on the click.

## API used

`addPanel` (with `side` and `onSelect`), `fileName`, `lineCount`, `line`, `setSelection`.

## Known limits

The scan is a plain substring match over every line, so a marker inside a string literal
counts too. Distinguishing them would mean knowing the language's comment syntax, which a
plugin cannot ask for.
