# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this is

Example plugins for [Linelark](https://linelark.com), a macOS editor whose source is a
sibling checkout at `../Notepad4MacOS`. They are **not shipped with the app** and are not
loaded from its source tree.

**Nothing here verifies them.** There is no build, no test suite, and the editor's own tests
no longer load these — so an API change made in `../Notepad4MacOS` can break a plugin here
silently. Check by hand (below) after touching either side.

## Layout

One folder per plugin. The `.linelarkplugin` bundle is what gets installed; the folder
around it is where the plugin is documented.

```
sort-lines/
  README.md                       what it demonstrates, and the API it uses
  Sort Lines.linelarkplugin/
    manifest.json
    main.js
```

Keep each README's "API used" list true — it is the only index of what these cover.

## Checking a change

There is no way to unit-test a plugin. Install it and drive it:

```bash
cp -R "sort-lines/Sort Lines.linelarkplugin" \
      ~/Library/Application\ Support/Linelark/Plugins/
```

Then **Plugins ▸ Reload Plugins**. **Plugins ▸ Manage Plugins…** lists what failed to load
with the reason, and holds each plugin's log — everything from `linelark.log`, `console.log`,
and any error that escaped, including one thrown after an `await`.

## The manifest

`id` and `name` are required; everything else has a default. `main` defaults to `main.js`.

```json
{
  "id": "com.example.thing",
  "name": "Thing",
  "version": "1.0.0",
  "apiVersion": 1,
  "hosts": ["api.example.com"],
  "secrets": [
    { "name": "apiKey", "label": "API key", "header": "x-api-key",
      "prefix": "", "host": "api.example.com" }
  ]
}
```

Commands and panels are **not** listed here — the script registers them, so there is one
source of truth. A credential that cannot be honoured **fails the manifest**: one naming an
undeclared host, two sharing a name, or two competing for the same (host, header).

## The API

```
Registration  addCommand(id, title, fn) · addPanel({…}) · refreshPanels() · log(msg) · apiVersion()
Document      fileName() · filePath() · language() · isReadOnly()
Reading       text() · length() · lineCount() · line(n) · getRange(loc, len)
Selection     selection() · selectionRange() · setSelection(loc, len)
Writing       replaceSelection(s) · replaceRange(loc, len, s) · setText(s) · insert(s)
Opening       openFile(path) · openVirtual({key, name, text, label, language}) · folderRoot()
Scheduling    setTimeout · setInterval · clearTimeout · clearInterval · queueMicrotask
Network       fetch({url, method, headers, body, timeout}) · canReachNetwork() · hasSecret(name)
Git (Studio)  repoIsAvailable() · repoRoot() · repoHead() · repoLog(n) · repoFiles() · repoShow(path)
              repoLogAsync(n) · repoFilesAsync() · repoShowAsync(path)
```

Panel descriptor: `{id, title, symbol, side, render, onSelect}`. `symbol` is an SF Symbol;
`side: "right"` puts it in the right dock. Node types:

```js
{ type: "heading", text }
{ type: "text",    text, style: "primary" }   // secondary unless you say otherwise
{ type: "rows",    rows:  [{ id, title, detail, symbol, badge }] }
{ type: "tree",    items: [{ path: "a/b/c.swift", badge }] }
{ type: "graph",   commits: [{ sha, parents, subject, author, date, refs }] }
```

`fetch` resolves to `{status, ok, headers, body, isText}`.

## Rules that bite

- **`render()` is never async.** Returning a promise is reported as that mistake rather than
  drawn. Await in a command, a click or a timer, keep the result, call `refreshPanels()`.
- **A failure after an `await` cannot reach the user as a failed command** — the call already
  returned. It goes to the plugin log. Catch what you can act on.
- **Make one edit, not many.** Compute the whole replacement, apply it with a single
  `replaceRange`. A loop of small edits is a stack of undo steps, and every write invalidates
  offsets taken before it. Offsets are UTF-16 code units.
- **A missing JS property reads back as the string `"undefined"`**, not as nothing. Leave a
  descriptor field out entirely rather than setting it to `undefined`.
- **No watchdog.** A script that never yields hangs the editor. Timers are clamped to 4 ms
  and capped at 64 per plugin.
- **Studio-only:** git and network. `repoIsAvailable()` and `canReachNetwork()` answer
  `false` in the sandboxed App Store edition — check and explain, or the panel reads as broken.
- **A secret is never readable.** `hasSecret(name)` returns a boolean and nothing else; the
  host attaches the value to requests bound for the host the manifest tied it to. No request
  signing, no secret in a body.
- **Changing what you ask for revokes consent.** Adding a host, or moving a credential to
  another header, makes the user grant network access again and orphans the stored key — a
  version bump alone does not. Check `hasSecret` rather than assuming it survived.
- Network is https only, hosts are matched exactly (no wildcards), redirects are not
  followed, responses are text and capped at 5 MB.

## Conventions

Plain ES5-style JavaScript with `var` and `function`, except where `async`/`await` is the
point. Comments explain *why*, in the voice of the existing files. Full guide:
<https://linelark.com/plugins/>.
