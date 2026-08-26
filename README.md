# Linelark plugins

Example plugins for [Linelark](https://linelark.com), written to be read and copied.

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
| [`sort-lines`](sort-lines/) | Editing: expand a selection to whole lines, compute the result, apply it as one undoable edit |
| [`github`](github/) | A side panel — file tree and commit graph from local git — and an asynchronous click that opens a revision beside the working copy |
| [`scratch-notes`](scratch-notes/) | A right-dock panel that reads the front file and moves the caret when a row is clicked |

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
**<https://linelark.com/plugins/>**.

## Requirements

`apiVersion` 1. Read-only git (`repoIsAvailable`, `repoLog`, `repoFiles`, `repoShow` and
their `*Async` forms) is Studio-only: the sandbox blocks subprocesses, so the App Store
edition does not ship the git reader and `repoIsAvailable()` answers `false` there. A
plugin that uses it should check and explain itself rather than showing an empty panel.

## Licence

MIT. Copy from these freely.
