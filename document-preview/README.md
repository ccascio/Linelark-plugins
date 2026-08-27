# Document Preview

Renders the Markdown or HTML file you are looking at, in place of its source.

Open a `.md` or `.html` file and press **Preview** in the toolbar (⇧⌘V, also View ▸ Preview).
The pane swaps to the rendering; press it again and the source comes back, at the line you
were reading. The button is dim for anything this plugin does not claim.

## What it shows

This is the shape of a plugin that *renders*, and it is worth reading for four things.

**A preview is a description, not a document.** Linelark draws blocks — headings, prose with
inline marks, code, quotes, lists, tables, rules — and the plugin's whole job is to produce
them. That is what keeps a preview on the editor's theme, and it is why a preview cannot run
script or pull a remote stylesheet: there is no HTML anywhere in this, not even in the HTML
preview.

**Two previews, one plugin.** `addPreview` is called twice, so a `.md` file offers "Preview
as Markdown" and a `.html` file "Preview as HTML" — the title is what the button says. They
share the entity decoder, the span helpers and the size limit; only the parser differs.

**Every block says where it came from.** `source` is the offset in the file the block was
built from, and it is what keeps your place across the switch. In HTML that is exact at
every depth, because the parser keeps each element's `<`. In Markdown it takes a little
care: marked normalises line endings before it lexes, so `raw` lengths count `\n` where the
file on disk has `\r\n`, and a cursor walks the *original* text in step — without that,
every offset in a CRLF document drifts a character further behind per line. Blocks nested
inside a Markdown blockquote or list item say `-1`, because they were lexed from text whose
markers had been stripped and their offsets measure nothing; the host reads that as "never
scroll here" rather than as the top of the document.

**There is no watchdog.** A plugin that does not return takes the editor with it, and
JavaScriptCore *interprets* both parsers. On a 33 KB document, marked takes about 72 ms; the
HTML parser here takes about 1.7 ms. Both refuse past 256 KB and say so in the preview
rather than stalling on every edit.

## Markdown

[marked][] is used through its **lexer** — `marked.lexer(text)` — rather than through
`marked.parse`, because the tokens are the structure a preview needs and the HTML would only
have to be taken apart again to get it back.

## HTML

The HTML parser is written here rather than vendored. parse5 is 100 KB of JavaScript that
JavaScriptCore would interpret, and the subset of HTML that maps onto preview nodes at all
is small. It is deliberately tolerant — real files have unclosed `<p>`s and `<li>`s, stray
`</div>`s, unquoted attributes and `<` in prose — and it never throws: an unparseable
document should come out as less structure, not as an error where the document was.

It renders a document's **structure**, not a web page:

- `<h1>`–`<h6>`, `<p>`, `<pre>`/`<code>` (with `class="language-x"`), `<blockquote>`,
  `<ul>`/`<ol>` including `start` and `<input type=checkbox>` task items, `<table>` with
  `<thead>`, `<dl>`, `<hr>`, and the inline set — `<strong>`, `<em>`, `<del>`, `<code>`,
  `<a href>`, `<br>`, `<img alt>`.
- `<div>` and friends are boxes: their children are spliced in where they stood. So is any
  element this version has never heard of, because losing the content would be the one
  unrecoverable mistake.
- `<head>`, `<script>`, `<style>`, `<svg>`, `<iframe>` and the other unrenderable elements
  are dropped whole.

**No CSS, no images, no script, no layout.** Your stylesheet is ignored and everything comes
out on the editor's theme, in source order. For documentation-shaped HTML — a converted
README, an article, generated API docs — that is what you want. For a styled page it is not
a browser and does not pretend to be one.

A useful check on all of this: run a Markdown file through `marked.parse` and preview the
HTML that comes out. The editor's own README gives 80 blocks either way, with the same prose
in the same order.

## What neither does

- **No images.** An image is drawn as its alt text. A preview node describes text, and
  fetching a remote one would be a request the plugin never asked to make.
- **No syntax highlighting inside code blocks.** They are drawn in the editor's monospaced
  font on the theme's inset background.
- **Raw HTML inside Markdown is shown as code**, not rendered — except comments, which are
  dropped. A preview that silently swallowed content would be worse than one that admits
  what it did not render.
- **Heading anchors go nowhere.** A `#fragment` link is drawn as plain text rather than as a
  link that does nothing.

## Vendored code

`main.js` contains [marked][] v15.0.7 (MIT), unmodified, followed by the shared helpers and
the two converters. A plugin is a single script with no module loader, so it is inlined
rather than imported.

[marked]: https://github.com/markedjs/marked

## API used

`addPreview`, twice. The preview nodes it returns: `heading`, `paragraph`, `code`, `quote`,
`list` (ordered, unordered and task items, with nested children), `table`, `rule`.
