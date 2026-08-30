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

## Publishing to linelark.com

The catalog lives in the website checkout, `../Notepad4MacOS-Website`, and every command
below is run **from there** — it reads this repository as its sibling. There is no public
upload endpoint: the harness is owner-only, and it packs, uploads and records; a human
approves.

```bash
cd ../Notepad4MacOS-Website

npm run plugins:check                          # every bundle here, packed and validated,
                                               # no network. Do this first, always.
npm run plugins:submit -- --plugin sort-lines  # zip → R2, and a D1 row for review
# …owner approves the release at /admin…
npm run plugins:publish -- --plugin sort-lines # only an approved release; regenerates
                                               # public/plugins/catalog.json
npm run build && npx wrangler deploy           # the feed is a static file: until the site
                                               # is deployed, nothing is public
```

The slug is the plugin's `name`, lowercased and hyphenated — "Sort Lines" is `sort-lines`,
and that is what `--plugin` wants. Omitting `--plugin` does every bundle at once, which is
almost never what is meant.

**A released version is immutable, and that is the rule everything else follows from.** The
archive is deterministic, its SHA-256 is recorded, and a resubmission whose bytes differ is
refused rather than merged. So *any* edit to a bundle that has been submitted — a fixed
typo, one reworded line of `description` — needs a version bump. Check what is already up
before editing a manifest:

```bash
npx wrangler d1 execute convertprivately-privacy-analytics --remote --json \
  --command "SELECT plugin_id, version, review_status FROM linelark_plugin_releases"
```

`review_status` runs `submitted → approved → published`, and `catalog_status` on the plugin
stays `draft` until the first publication. Submitting is safe to repeat and safe to
interrupt: the worst outcome is an unreferenced R2 object with the checksum it was going to
have anyway.

**The manifest's `description` is the plugin's entire public description.** It becomes
`summary` in the ledger and the one line under the name in the catalog and in **Get
Plugins…**, so it has to say what the plugin does without the README beside it.

**The folder's `README.md` is what the reviewer reads.** Submitting copies it into the
ledger's long `description` column, and the owner desk draws it under the plugin next to the
permissions its manifest asks for — `git: write`, each host, each credential — which is the
half of a review that decides anything. It is read from *beside* the bundle rather than
from inside it, so it is not covered by the archive checksum: rewording a README costs no
version, and re-publishing an unchanged bundle is how a corrected one gets in. Capped at
64 KB, and kept out of the public feed on purpose — it is written for plugin authors, and
nothing public renders it.

The harness refuses symlinks, unsafe `main` paths, non-semantic versions, a missing main
script, and bundles over 1,000 files or 20 MB uncompressed. `.DS_Store` is dropped for you.
`../Notepad4MacOS-Website/DEPLOYMENT.md` is the fuller account, including R2 keys and what
the app verifies before it installs anything.

## The manifest

`id` and `name` are required; everything else has a default. `main` defaults to `main.js`.

**`apiVersion` is load-bearing.** It is the generation of the host API the plugin was
written against, and a host that speaks an older one refuses to load it, saying so. That
matters because an unknown node type is *skipped* rather than fatal — which is right, but
means a plugin using a newer node on an older host silently loses whole sections of its
panel instead of failing. Generation 2 covers `section`, `actions` and `button` nodes,
`badgeTint`, `openDiff` and `repoDiscardAsync`. Generation 3 covers the store (`storeGet`,
`storeSet`, `storeRemove`, `storeKeys`), `copyToClipboard`, `exportFile`, `caretLine`, and a
panel's `onChange` and `followsCaret`; a plugin using any of them must say `3`. Generation 4
covers `openDiff`'s `onMerge` — arrows drawn down the middle of a diff — and must say `4`.
Generation 5 covers `addContextMenuItem`. Generation 6 covers remote management
(`repoAddRemoteAsync`, `repoSetRemoteURLAsync`, `repoRemoveRemoteAsync`) plus
`openPluginSettings` and `openURL`. Generation 7 covers `setSecret` and `clearSecret`.

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
Selection     selection() · selectionRange() · caretLine() · setSelection(loc, len)
Writing       replaceSelection(s) · replaceRange(loc, len, s) · setText(s) · insert(s)
Opening       openFile(path) · openVirtual({key, name, text, label, language})
              openDiff({key, name, patch, label}) · folderRoot()
Scheduling    setTimeout · setInterval · clearTimeout · clearInterval · queueMicrotask
Keeping       storeGet(key) · storeSet(key, value) · storeRemove(key) · storeKeys()
Handing out   copyToClipboard(text) · exportFile({name, text})
Network       fetch({url, method, headers, body, timeout}) · canReachNetwork() · hasSecret(name)
Signing in    setSecret(name, value) · clearSecret(name)
Git read      repoIsAvailable() · repoRoot() · repoHead() · repoLog(n) · repoFiles() · repoShow(path)
 (Studio)     repoTracking() · repoBranches() · repoRemotes()
              repoLogAsync(n) · repoFilesAsync() · repoShowAsync(path)
              repoDiffAsync({path, staged, untracked})
Git write     repoCanWrite() · repoStageAsync(paths) · repoUnstageAsync(paths)
 (asks first) repoDiscardAsync(paths)
 (Studio,     repoCommitAsync(message) · repoFetchAsync() · repoPullAsync() · repoPushAsync()
  granted)    repoSwitchAsync(branch) · repoCreateBranchAsync(branch)
```

Panel descriptor: `{id, title, symbol, side, followsCaret, render, onSelect, onSubmit, onChange}`.
`symbol` is an SF Symbol; `side: "right"` puts it in the right dock. Node types:

```js
{ type: "heading", text }
{ type: "text",    text, style: "primary" }   // secondary unless you say otherwise
{ type: "rows",    rows:  [{ id, title, detail, symbol, badge, badgeTint }] }
{ type: "tree",    items: [{ path: "a/b/c.swift", badge, badgeTint }] }
{ type: "actions", actions: [{ id, title, symbol, enabled, tint }] }
{ type: "button",  id, title, symbol, prominent, enabled }
{ type: "graph",   commits: [{ sha, parents, subject, author, date, refs }] }
{ type: "field",   id, label, placeholder, value, multiline, submit, enabled }
{ type: "section", id, title, collapsed, children: [nodes] }
```

`button` is a labelled button drawn as one, full width. `rows` looks like a list and
`actions` like a strip of icons, and neither reads as *press this* — which matters most
where one step gates another. A greyed-out Commit says nothing about the row above it that
would ungrey it, and a user who does not already know git's staging model cannot find that
out by looking. `prominent` fills it; use it for the single obvious next step and never for
two at once.

`actions` is a row of icons, each naming itself in a tooltip — a sidebar runs out of
vertical room long before it runs out of things to offer, and four stacked rows reading
Fetch, Pull, Push and Refresh are four lines that could be four icons on one. `title` is not
optional: it is the tooltip *and* what VoiceOver reads, so an action without one is refused,
as is one with no `symbol`.

`badgeTint` and an action's `tint` name a *meaning* — `neutral`, `positive`, `warning`,
`negative`, `info` — never a colour. The theme owns the palette; a plugin that could name a
colour would eventually name one nobody can see against their background. A tint this build
does not recognise reads as none at all rather than failing the node.

A `section` is the one node that contains others, and the only way to give a long panel
structure a reader can close. Like `field`, the plugin supplies the *opening* position and
the view owns it afterwards — `collapsed` is how the section starts, not what it is, so a
redraw does not reopen one somebody just shut. That makes `id` load-bearing: it is what the
panel remembers the state against, so it has to be stable across draws. Sections nest three
deep; a fourth is refused. An empty one is skipped, exactly as an empty `rows` is.

A `field` is the one node that sends something back: `onSubmit(id, value)` when the button is
pressed, and `onChange(id, value)` roughly 0.6 s after typing stops, for a panel that saves
rather than submits. The view owns what is typed, so a redraw does not take a half-written
sentence away; the plugin changes what is in the box by handing back a *different* `value`
(empty after a successful commit, the same text back after a failed one), and handing back
the same one it last handed costs nothing.

**Hand back what you have stored, never the live text.** Echoing what was just typed means
`value` differs on every keystroke and the box is rewritten under the cursor. The stored text
is the opposite: while somebody types it does not change, so the view leaves the box alone,
and the moment a save lands it is *equal* to what the box holds. A plugin that instead
freezes `value` at what the box said when it opened has a bug that only shows later — the
field view is thrown away and rebuilt whenever the dock switches panels, and it comes back
holding that frozen text rather than what was saved. So: `value: note.text`, every draw.

**`onChange` arrives late, by construction.** It can land after the panel has moved on to
something else, and changing `value` *flushes* the pending call rather than dropping it —
losing the last half-second of typing every time the box was swapped would be the worse bug.
Both together mean a plugin editing several things through one box must put the identity in
the field's `id` (`note:ab12`, not `note`), because the delivered id is the one the call was
scheduled with. And a plugin that *rewrites* a box — appending to it from elsewhere — gets
the pre-rewrite text delivered a moment later: taking it at face value undoes the rewrite, so
carry a revision in the id too and merge rather than replace (`story-bible` does this).

**Redraw as soon as a save lands.** `onChange` should end in `refreshPanels()`. Otherwise
whatever redraws the panel next hands the box `value` as it was *before* the save, and the
text just typed appears to vanish. This is only safe if the node list does not change shape
when it saves — see below.

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

`openDiff` takes a unified diff — git's own output, as `repoDiffAsync` returns it — and
draws it as the two files it describes, side by side. A patch rather than two texts because
that is what a plugin can get: comparing a *staged* change means comparing against the
index, and no call here returns that blob. The tab is read-only, and it shows the hunks and
their context rather than the whole file, with a gap row marking each stretch git did not
send. It is otherwise a virtual buffer — same key-based tab reuse, same lifetime — so a
`key` already used by `openVirtual` opens a second tab rather than replacing the first.

**`openDiff` can be a merge tool, not only a view.** Given `onMerge`, the diff draws a pair
of arrows in the strip between its two halves at every difference, tracks which one is
current, scrolls to it, and puts ⌃/⌄ and Take-left/Take-right in a header bar. The handler is
called as `onMerge(block, direction)`: `block` counts differences from the top of the patch —
one unbroken run of changed rows is one difference — and `direction` is `"left"` or `"right"`,
naming the file about to change. A plugin that generated the patch from its own list of
differences, in order, can use `block` as an index straight into it.

That numbering is the whole contract, and it is worth a test rather than an assumption: the
view counts runs in the text it was given, the plugin counts hunks in the arrays it diffed,
and nothing checks that those agree. `compare-files` fuzzes it — 600 random pairs, the view's
count against the plugin's — because an arrow that moves the wrong lines is the one bug a
merge tool must not have.

The handler is registered per `key` and *re-*registered on every `openDiff`, so reopening
with a fresh patch never leaves the old closure behind. Answering an arrow means recomputing
and calling `openDiff` again with the same key, which replaces the tab's text; the view keeps
its place, and the difference just taken is gone, so the number that was current now names
the one after it.

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
- **A node's identity is its position in the list.** A box's typed text, and a section's
  open-or-shut, belong to the *nth* node rather than to the id written on it. So a panel
  with a field in it must not change shape while somebody is typing: a status line that
  appears once there is something to say slides every box below it onto another record's
  contents. Draw the line always and change its words.
- **`render()` must not change the document.** It is called from the view's own update, so
  a `setText` or `replaceRange` inside one is editing the thing being drawn while it is
  being drawn. A panel that reacts to the front tab arriving — `compare-files` opens a file
  so it can write into it — should hand the work to `setTimeout(fn, 0)` and let the draw
  finish first.
- **A missing JS property reads back as the string `"undefined"`**, not as nothing. Leave a
  descriptor field out entirely rather than setting it to `undefined`.
- **No watchdog.** A script that never yields hangs the editor. Timers are clamped to 4 ms
  and capped at 64 per plugin.
- **The store is strings, per plugin, and capped.** `storeGet`/`storeSet` keep a plugin's
  own data in Application Support between launches — one JSON file per plugin id, so there
  is no path to name and nothing to traverse out of. Values are strings: use
  `JSON.stringify`. `storeSet` *returns* the refusal rather than throwing (256 KB a value,
  4 MB and 2,000 keys a plugin), and a panel that ignores it is a panel that looks like it
  is saving and is not. Writes are debounced ~0.75 s and flushed when the app quits.
- **`followsCaret` is the only way a panel is redrawn by something the user does
  constantly.** It is opt-in for that reason: the signal is coalesced to 200 ms, but a
  panel that reads git or walks the buffer must not take it. `caretLine()` is the answer it
  exists for — working the line out from `selectionRange()` means scanning the document on
  every keystroke.
- **`exportFile({name, text})` is the only way a plugin writes to disk, and it cannot do so
  quietly.** The save panel *is* the consent, so there is no path argument: a plugin offers
  a name and the text, and where it goes belongs to the user. `false` is usually just a
  cancelled panel, which is not an error.
- **Studio-only:** git and network. `repoIsAvailable()`, `repoCanWrite()` and
  `canReachNetwork()` answer `false` in the sandboxed App Store edition — check and explain,
  or the panel reads as broken.
- **Nothing can force, reset or merge.** Not "do not do this" — there is no call for it.
  `repoPullAsync` is `--ff-only` and a diverged push is rejected by git. Report what
  `output` says and leave the rest to the terminal.
- **`repoDiscardAsync` is the one call that can lose work, and the only one that asks.**
  It restores the named files from the index, so a change deliberately staged survives and
  only the edits on top of it go. Untracked files are refused: git restores *from* the
  index, and a file it has never seen has nothing there — discarding one would mean
  deleting it, which is `clean` by another name and still absent. The host puts the
  question on screen itself, in front of the call, because a plugin cannot show a dialog
  and a plugin that could would be the wrong thing to trust with this one. A refusal comes
  back as an ordinary `{ok: false, output: "Cancelled."}` rather than a rejection: the user
  declining is not an error for a plugin to report as one.
- **A write is refused, not queued, when permission is missing.** Both gates are checked at
  the moment of the call, so a permission taken away stops the next commit. The rejection is
  a `catch`, with a message naming what to switch on.
- **Do not cache git across draws.** One read per draw is worth it — the same file list is
  wanted five times — but anything longer shows the tree as it was before the last save, and
  a permission the user just granted as still missing.
- **A secret is never readable.** `hasSecret(name)` returns a boolean and nothing else; the
  host attaches the value to requests bound for the host the manifest tied it to. No request
  signing, no secret in a body.
- **A plugin may write a credential it obtained itself, never read one.** `setSecret(name,
  value)` files a token in the Keychain slot the manifest declares — it exists for a browser
  sign-in, where the token arrives in the plugin's hands and the only alternative is the
  plugin store, which is a plaintext file. Handing back a value already held teaches the
  plugin nothing, so the rule above is untouched. It needs the declaration *and* network
  consent, caps the value at 4 KB, and returns a refusal string or nothing, as `storeSet`
  does — a sign-in that failed to save looks exactly like one that worked until the next
  request, so check it. `clearSecret(name)` is signing out and needs only the declaration.
- **A browser login means the device flow, not a redirect.** There is no URL scheme to
  redirect back to and no socket a plugin can listen on, so the OAuth flow that ends in a
  callback cannot be completed from here. GitHub's device flow can: ask for a code, show it,
  poll until it is approved. `openURL` is honoured only while the click that asked for it is
  still on the stack — an `await` ends that — so the click that fetches the code cannot also
  open the page. Opening it is a *second* button, which is a second user action: show the
  code first, then let it be pressed. Opening the browser first instead is a tab asking for
  a code the user has not been shown, arriving in the window behind it. `github` does this.
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
