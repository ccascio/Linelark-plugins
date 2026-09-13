# Linelark plugins

Example plugins for [Linelark](https://linelark.com), written to be read and copied.

<https://github.com/ccascio/Linelark-plugins> — start from any of these. They are MIT
licensed and none of them is a special case: what they use is the same documented API any
plugin has, and the full guide is at <https://linelark.com/plugins/>.

A plugin is a folder, a `manifest.json`, and a JavaScript file. No build step, no
toolchain, no compiled binary — Linelark evaluates plugins with JavaScriptCore, the engine
already in macOS. Each plugin runs in its own context with its own globals, so two plugins
cannot see or overwrite each other's state.

These live outside the editor's own repository on purpose. They are not shipped with the
app and are not loaded from it: a plugin is something the user puts in place, and keeping
the examples here means they can be revised, versioned and installed without touching a
release of the editor.

## What is here

| Plugin | Shows |
| --- | --- |
| [`web-import`](web-import/) | Import rendered webpages or local HTML with selection, section filters, Markdown/HTML output, and source attribution (Studio, API 11) |
| [`sort-lines`](sort-lines/) | Editing: expand a selection to whole lines, compute the result, apply it as one undoable edit — and a panel that is a form, built out of rows because there is no checkbox node, and gated on nothing the panel cannot watch change |
| [`document-preview`](document-preview/) | Rendering: Markdown and HTML drawn in place of their source, two previews from one plugin, each block carrying the offset it came from so the switch keeps your place |
| [`format`](format/) | Scanning: formatters for JSON, XML, HTML, CSS and four code languages, each built around one rule about what must be copied through untouched — and the only plugin here that brings its own test runner, because there is no other way to know |
| [`github`](github/) | A git client: stage, commit, pull, push, diffs of what has changed, branches, and pull requests from the API. The one that asks for permissions, and the one to read for what a real panel looks like |
| [`scratch-notes`](scratch-notes/) | Keeping something: notes pinned to a line, saved as you type, and a panel that redraws when the caret moves — the one case `followsCaret` exists for |
| [`compare-files`](compare-files/) | Comparing and merging: a patience diff computed in JavaScript, drawn by `openDiff` with merge arrows down the middle, and a write back into either file |
| [`story-bible`](story-bible/) | Sections as tabs, several autosaving boxes at once, and what a plugin owes a box it rewrites while somebody is typing into it |
| [`launcher`](launcher/) | Running something: the applications a project is, each started in a terminal you can watch and stop — and the two things a plugin may not do quietly, a shell and a folder panel, each gated on a click |

Each folder holds a `README.md` and the `.linelarkplugin` bundle itself. The bundle is what
gets installed; the folder around it is where the plugin is documented.

## Installing one

Either use **Plugins ▸ Install Plugin…** in Linelark Studio and choose the
`.linelarkplugin` folder, or copy it into the plugins directory yourself:

```bash
cp -R "sort-lines/Sort Lines.linelarkplugin" \
      ~/Library/Application\ Support/Linelark/Plugins/
```

Then pick **Plugins ▸ Reload Plugins**. The sandboxed Mac App Store edition reads the same
folder inside its own container and has no Install Plugin… item, so it only ever runs
scripts placed there by hand.

If a plugin does not appear, open **Plugins ▸ Manage Plugins…** — anything that failed to
load is still listed, with the reason beside it, and each plugin's log holds everything it
printed with `linelark.log` or `console.log`.

## Writing your own

The full guide — the manifest format, the whole `linelark` API, panels, generated buffers,
timers and promises, and the limits worth knowing before designing around them — is at
**<https://linelark.com/plugins/developers/>**.

## Requirements

`apiVersion` 1 for most of these. `scratch-notes` and `story-bible` need 3 for the plugin
store and autosaving fields; `compare-files` needs 4 for merge callbacks in `openDiff`;
`github` needs 8 to say which project in a multi-root workspace its git actions are about;
`document-preview` needs 9 to draw a diagram it has laid out itself; `launcher` needs 10 to
run commands in the terminal panel. An older host refuses to load them and says so, and each
manifest carries the `minimumAppVersion` that turns its generation into a release a reader
can act on. Git is Studio-only: the sandbox blocks subprocesses, so the App Store edition
does not ship the git reader at all and `repoIsAvailable()` answers `false` there. A plugin
that uses it should check and explain itself rather than showing an empty panel.

Reading git needs no permission — it describes the folder you opened. *Changing* it does: a
plugin declares `"git": "write"` in its manifest and the user switches it on in Manage
Plugins. Nothing in the API can force-push, reset, discard or merge, and `repoPullAsync` is
fast-forward only, so the worst a granted plugin can do is make a commit you did not want —
which is in the reflog like any other.

Running commands is Studio-only as well — there is no terminal panel in the sandbox — and
asked for the same way: `"terminal": "run"` in the manifest, switched on in Manage Plugins.
It is the widest permission here, since a command can do anything you can do, so it has a
switch of its own rather than riding on either of the others. Two things keep it answerable:
it works only from something you clicked, never from a timer, and what it runs is typed into
a shell you can see, read and stop rather than a process you were never shown.

## Licence

MIT — see [LICENSE](LICENSE). Copy from these freely.

`document-preview` also contains [marked](https://github.com/markedjs/marked) v15.0.7,
copyright (c) 2011-2025 Christopher Jeffrey, likewise MIT. Its HTML parser is our own.
