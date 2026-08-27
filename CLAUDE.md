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
  "git": "write",
  "hosts": ["api.example.com"],
  "secrets": [
    { "name": "apiKey", "label": "API key", "header": "x-api-key",
      "prefix": "", "host": "api.example.com" }
  ]
}
```

Commands, panels and previews are **not** listed here — the script registers them, so there
is one source of truth. A credential that cannot be honoured **fails the manifest**: one naming an
undeclared host, two sharing a name, or two competing for the same (host, header).

`"git": "write"` asks to change the repository — stage, commit, fetch, pull, push, switch
branches. Like `hosts` it is a *request*: the user grants it separately in Manage Plugins,
against the manifest's capability fingerprint, so adding a host later revokes the git
permission too. Reading git needs no declaration.

## The API

```
Registration  addCommand(id, title, fn) · addPanel({…}) · addPreview({…}) · refreshPanels()
              log(msg) · apiVersion()
Document      fileName() · filePath() · language() · isReadOnly()
Reading       text() · length() · lineCount() · line(n) · getRange(loc, len)
Selection     selection() · selectionRange() · setSelection(loc, len)
Writing       replaceSelection(s) · replaceRange(loc, len, s) · setText(s) · insert(s)
Opening       openFile(path) · openVirtual({key, name, text, label, language}) · folderRoot()
Scheduling    setTimeout · setInterval · clearTimeout · clearInterval · queueMicrotask
Network       fetch({url, method, headers, body, timeout}) · canReachNetwork() · hasSecret(name)
Git read      repoIsAvailable() · repoRoot() · repoHead() · repoLog(n) · repoFiles() · repoShow(path)
 (Studio)     repoTracking() · repoBranches() · repoRemotes()
              repoLogAsync(n) · repoFilesAsync() · repoShowAsync(path)
              repoDiffAsync({path, staged, untracked})
Git write     repoCanWrite() · repoStageAsync(paths) · repoUnstageAsync(paths)
 (Studio,     repoCommitAsync(message) · repoFetchAsync() · repoPullAsync() · repoPushAsync()
  granted)    repoSwitchAsync(branch) · repoCreateBranchAsync(branch)
```

Panel descriptor: `{id, title, symbol, side, render, onSelect, onSubmit}`. `symbol` is an SF Symbol;
`side: "right"` puts it in the right dock. Node types:

```js
{ type: "heading", text }
{ type: "text",    text, style: "primary" }   // secondary unless you say otherwise
{ type: "rows",    rows:  [{ id, title, detail, symbol, badge }] }
{ type: "tree",    items: [{ path: "a/b/c.swift", badge }] }
{ type: "graph",   commits: [{ sha, parents, subject, author, date, refs }] }
{ type: "field",   id, label, placeholder, value, multiline, submit, enabled }
```

A `field` is the one node that sends something back: `onSubmit(id, value)`. The plugin
supplies the *initial* value and the view owns what is typed after that, so a redraw does not
take a half-written sentence away — set `value` to something different to change it (empty
after a successful commit, the same text back after a failed one).

Preview descriptor: `{id, title, extensions, languages, render}` — a rendered view of a
document, swapped in from the toolbar's Preview button (⇧⌘V) for files the `extensions` or
`languages` claim. One naming neither is refused at load. `render(text)` gets the whole
document and returns block nodes; spans are `{text, bold, italic, code, strike, link}` and
their marks combine.

```js
{ type: "heading",   level, spans, source }
{ type: "paragraph", spans, source }
{ type: "code",      text, language, source }
{ type: "quote",     children: [nodes], source }
{ type: "list",      ordered, start, items: [{ spans, checked, children }], source }
{ type: "table",     headers: [spans], rows: [[spans]], source }
{ type: "rule",      source }
```

A `repoFiles()` entry is `{path, state, index, worktree, staged, unstaged, untracked}`:
`state` is the merged badge, `index` and `worktree` are the two porcelain columns, which is
what tells a staged change from an unstaged one. `repoTracking()` is `{upstream, ahead,
behind}` or `null` for a branch that tracks nothing. Every write resolves to `{ok, output}`,
where `output` is git's own words — that is the half worth showing.

`source` is the document offset the block came from, and it is what keeps the reader's place
across the switch. `-1` means "could not place this", and such a block is never scrolled to
— which is what nested blocks use, since a blockquote's children are lexed from text its
markers were stripped out of.

`fetch` resolves to `{status, ok, headers, body, isText}`.

## Rules that bite

- **`render()` is never async.** For a panel *or* a preview: returning a promise is reported
  as that mistake rather than drawn. Await in a command, a click or a timer, keep the result,
  call `refreshPanels()`.
- **A preview costs what your parser costs.** It is re-rendered whole when the text settles,
  and JavaScriptCore interprets it — marked measures ~2 ms per KB here against ~0.06 ms per
  KB in a JIT-ing engine. Refuse documents past a size you have measured; there is no
  watchdog to save you (below).
- **Preview state belongs to the pane, and the plugin is not told about it.** There is no
  call to open, close or ask about a preview: the user presses the button, and the same file
  can be source in one split and rendered in the other.
- **One plugin may register several previews**, and should when the titles differ — the title
  is what the toolbar button says, so `document-preview` offers "Preview as Markdown" on a
  `.md` and "Preview as HTML" on a `.html` rather than one button that means both. First
  match wins if two plugins claim the same extension.
- **A failure after an `await` cannot reach the user as a failed command** — the call already
  returned. It goes to the plugin log. Catch what you can act on.
- **Make one edit, not many.** Compute the whole replacement, apply it with a single
  `replaceRange`. A loop of small edits is a stack of undo steps, and every write invalidates
  offsets taken before it. Offsets are UTF-16 code units.
- **A missing JS property reads back as the string `"undefined"`**, not as nothing. Leave a
  descriptor field out entirely rather than setting it to `undefined`.
- **No watchdog.** A script that never yields hangs the editor. Timers are clamped to 4 ms
  and capped at 64 per plugin.
- **Studio-only:** git and network. `repoIsAvailable()`, `repoCanWrite()` and
  `canReachNetwork()` answer `false` in the sandboxed App Store edition — check and explain,
  or the panel reads as broken.
- **Nothing can force, reset, discard or merge.** Not "do not do this" — there is no call for
  it. `repoPullAsync` is `--ff-only` and a diverged push is rejected by git. Report what
  `output` says and leave the rest to the terminal.
- **A write is refused, not queued, when permission is missing.** Both gates are checked at
  the moment of the call, so a permission taken away stops the next commit. The rejection is
  a `catch`, with a message naming what to switch on.
- **Do not cache git across draws.** One read per draw is worth it — the same file list is
  wanted five times — but anything longer shows the tree as it was before the last save, and
  a permission the user just granted as still missing.
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

Third-party code is **vendored inline and unmodified**, under a banner naming the library,
its version and its licence — `document-preview` carries marked that way. There is no module
loader in a plugin context: a plugin is one script, so a dependency is either inlined or not
used. Say what the library is used *for* in the banner, since a minified blob explains
nothing about why it is there.
