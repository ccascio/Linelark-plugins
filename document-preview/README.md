# Document Preview

Renders the Markdown or HTML file you are looking at, in place of its source, and draws the
Mermaid, PlantUML and draw.io diagrams in it.

Open a `.md`, `.html`, `.mmd`, `.puml` or `.drawio` file and press **Preview** in the toolbar (⇧⌘V, also
View ▸ Preview). The pane swaps to the rendering; press it again and the source comes back,
at the line you were reading. The button is dim for anything this plugin does not claim.

## What it shows

This is the shape of a plugin that *renders*, and it is worth reading for four things.

**A preview is a description, not a document.** Linelark draws blocks — headings, prose with
inline marks, code, quotes, lists, tables, rules — and the plugin's whole job is to produce
them. That is what keeps a preview on the editor's theme, and it is why a preview cannot run
script or pull a remote stylesheet: there is no HTML anywhere in this, not even in the HTML
preview.

**Five previews, one plugin.** `addPreview` is called five times, so a `.md` file offers
"Preview as Markdown", a `.html` file "Preview as HTML", and a `.mmd`, `.puml` or `.drawio`
file "Preview as Diagram" — the title is what the button says. They share the entity decoder,
the span helpers, the size limit and, between the three diagram readers, the whole figure
toolkit; only the parser differs.

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

## Diagrams

A ```` ```mermaid ```` or ```` ```plantuml ```` fence in a Markdown file is drawn rather than
shown as source, and a `.mmd` or `.puml` file is drawn as a whole.

**Mermaid**: `flowchart` / `graph`, `classDiagram`, `stateDiagram-v2`, `sequenceDiagram`.

**draw.io**: a `.drawio` file, every page of it. This one is not like the other two, and the
difference is worth stating: Mermaid and PlantUML say what connects to what and leave the
placing to the plugin, while a `.drawio` file says where every box *is*, because somebody
dragged it there. So there is no layout step at all — the geometry is read and painted, and
the arrangement that survives is the author's own, waypoints and all.

Draw.io previews preserve the file's RGB fill, stroke and font colors on its saved page
background (white by default). Other preview formats continue to use the editor theme.
Connector arrowheads use the same stroke color as their shafts. Container backgrounds are
painted before connectors, so opaque regions do not hide arrows; nodes are painted afterward.
Shapes it does not know — draw.io ships hundreds of stencils —
are drawn as labelled rectangles rather than skipped, because a box in the right place still
says what is connected to what, and skipping it would lose the edges into it too.

**PlantUML**: class, sequence and state diagrams, between `@startuml` and `@enduml`.
PlantUML does not announce which kind it is — Mermaid's first word does — so it is worked out
from the statements: a `class` declaration or a UML relation end settles it, then a message
with a colon after an arrow, then `[*]` or `state`. What is left, if it has arrows at all, is
drawn as a graph, so an activity diagram written without either marker still reads as boxes
joined by lines. Direction hints (`-up->`, `---->`) are opinions about layout rather than
about meaning, so they are normalised away and the operators that remain are Mermaid's
exactly — one table of relation ends serves both languages.

**Linelark does not know what any of it means.** The editor draws boxes, ellipses,
polylines, closed polygons and labels in a coordinate space this plugin chooses — there is
no `class`, no `lifeline` and no `association` on its side of the API. Parsing *and layout*
are here, which is what makes a diagram language a plugin release rather than an editor
release, and it is the only shape the feature could take: previews have no WebView to hand
an SVG to and fetch no images, in either edition.

**Layout needs a font, so the host lends one.** `linelark.measureText(text, {size, bold,
mono})` answers with the same `NSFont` the editor will paint with. Guessing a box's size
from a character count is wrong for every proportional font and wrong by a different amount
per string — and it fails by putting a label just outside the box it names, which reads as a
bug in the editor rather than in the plugin.

**Colour is a role, never a colour.** A shape asks for `surface`, `border`, `foreground`,
`accent`, `background` and so on, and the editor's theme decides what those are, so one
diagram is two drawings in a light and a dark theme. `background` is the one opaque light
role and it is what knocks the edge out from under a label and fills a hollow UML arrowhead;
`surface` is a translucent overlay and would let the line show through both.

What it does **not** do, and each is where a diagram will look plainer than Mermaid's own:

- **No subgraphs, packages, or `alt`/`loop`/`opt` frames.** Their contents are drawn, the box
  around them is not, so a diagram that uses them still reads rather than disappearing.
- **PlantUML's other diagram kinds** — deployment, component, timing, mind map, JSON — come
  out as their own source. So does `skinparam`, along with every other styling directive.
- **No styling.** `style`, `classDef`, `linkStyle` and `click` are ignored: the editor's
  theme decides colours, and a click target in a preview would be a link the plugin invented.
- **No cardinalities on class relations**, and no `<<interface>>` stereotypes.
- **Layered layout only**, with two barycentre sweeps to keep the edges of an ordinary tree
  from crossing. Edges route as one elbow; a self-edge in a flowchart is dropped rather than
  drawn as a dot, though a self-*message* in a sequence diagram is drawn properly.
- **Capped** at 240 nodes, 480 edges and 1200 lines. Past any of them the fence is shown as
  source, because unrendered and readable beats half-rendered and wrong. The same is true of
  a header this version has never heard of — a diagram written for a newer Mermaid comes out
  as its own text rather than as an empty box.

## What draw.io does not get

- **Compressed pages are not drawn.** draw.io can deflate a page into base64 instead of
  writing its XML, and this reads XML. The preview says which switch turns it off — File ▸
  Properties ▸ Compressed — rather than showing an empty page. Files written by current
  draw.io are uncompressed; none of the 90 real files this was built against was compressed.
- **Colors use RGB hex values.** Theme palette names remain available to other preview formats.
- **Stencils are rectangles.** Cylinders, actors, lifelines, notes, documents, hexagons,
  rhombuses, processes and swimlanes are drawn as themselves; a network switch from a stencil
  library is a labelled box.
- **Connector routing is an approximation.** Explicit entry/exit points, waypoints,
  orthogonal routing and rounded elbows are supported. This is not draw.io's full obstacle
  router. Block, classic, open, diamond and oval markers support size and fill settings;
  arrowheads have a larger minimum size for readability.
- **Labels use saved alignment and spacing.** Vertex labels wrap to their available width
  and reduce their font size when necessary to fit their height. Edge labels retain their
  saved along-path position, perpendicular distance, offset and font size.
- **Rich text inside a label is flattened.** `<b>`, `<i>` and the rest are stripped; `<br>`
  and `</div>` become line breaks. A box's *style* can still say bold or italic, and that is
  honoured — it is markup inside the words that is lost.
- **Capped** at 900 cells and 12 pages.

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

`addPreview`, five times — Markdown, HTML, Mermaid, PlantUML and draw.io — and
`linelark.measureText` for diagram layout. The preview nodes it returns: `heading`, `paragraph`, `code`, `quote`,
`list` (ordered, unordered and task items, with nested children), `table`, `rule`, and
`figure` with `box`, `ellipse`, `line` (open, closed and filled) and `label` shapes.

Needs API generation 9, which is where `figure` and `measureText` arrive.

### Layout regression checks

Run `node document-preview/label-layout.test.cjs [path/to/example.drawio]` from this
repository to check label anchors, connector ports, routing and marker shapes. On macOS,
run `swift document-preview/native-label-layout.test.swift
"document-preview/Document Preview.linelarkplugin/main.js" path/to/example.drawio`
to check vertex label containment with JavaScriptCore and native font measurements.
