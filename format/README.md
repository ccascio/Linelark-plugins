# Format

Formats JSON, XML, HTML and CSS, and reindents or tidies whitespace in everything else.

Five commands under **Plugins**, a **Format** panel in the right dock
(**View ▸ Show Right Dock**, ⌥⌘B), and **Format Document** on a tab's context menu for the
file types that have a real formatter.

- **Format Document** — JSON, XML, HTML, CSS/SCSS/LESS
- **Minify Document** — JSON and XML
- **Reindent Document** — brace languages
- **Tidy Whitespace** — every language

## What it will not do, and why

**There is no Format for Python, Swift, Go, Rust or C, and there cannot be one here.**
Formatting those languages means `black`, `swift-format`, `gofmt` and `rustfmt`. They decide
where a line wraps, which is a program rather than a function, and the plugin API has no call
that runs one — the whole surface is document access, panels, the store, network and git.
Nor could it get one: the App Store edition is sandboxed, so a "run a formatter" call would
have nowhere to lead in half the builds this plugin has to work in.

What those languages get instead is two operations named for exactly what they do:

**Reindent** rewrites the leading whitespace of each line from its bracket depth — Notepad++'s
re-indent, Xcode's ⌃I. It never wraps, never reorders, and never touches a character that is
not leading whitespace. Python is refused: its indentation *is* its block structure, so
recomputing it from brackets would not reformat the file, it would rewrite what the program
does.

**Tidy** removes whitespace that does nothing — trailing spaces, runs of blank lines, a
missing final newline. It only ever *removes*, which is why it is safe on any file the editor
can open, including one whose language it has never heard of.

Calling either of them "Format Python" would have been a lie, so neither is called that.

## The rule each formatter is built around

**JSON — values are copied, never reparsed.** This is a token scanner, not
`JSON.parse` followed by `JSON.stringify`. That round trip is where every naive JSON
formatter loses data, silently. Measured, in the same engine the plugin runs in:

| input | after a `parse`/`stringify` round trip | here |
|---|---|---|
| `{"a":1.0}` | `{"a":1}` | `{"a": 1.0}` |
| `{"a":1e3}` | `{"a":1000}` | `{"a": 1e3}` |
| `{"a":12345678901234567890}` | `{"a":12345678901234567000}` | unchanged |
| `{"2":"a","b":"c","1":"d"}` | reordered to `1`, `2`, `b` | order kept |
| `{"a":1,"a":2}` | `{"a":2}` | both kept |

Only the whitespace between tokens is rewritten. Comments are kept — `tsconfig.json` and
every hand-maintained settings file has them, and dropping them deletes the only explanation
of what a setting is for. A trailing comma is tolerated on the way in and dropped on the way
out.

**XML and HTML — an element holding text of its own is copied out exactly.** Not trimmed, not
re-wrapped: the source slice, byte for byte. `<name> Ada </name>` and `<name>Ada</name>` are
different documents, and mixed content (`<p>Hello <b>world</b>!</p>`) cannot be broken across
lines without inventing whitespace inside a sentence. What gets reformatted is the whitespace
*between* elements. Held out of even that: `xml:space="preserve"`, `<pre>`, `<textarea>`,
`<script>`, `<style>`, and — in HTML — a run of **inline** elements written with no whitespace
between them, because `<span>a</span><span>b</span>` renders without a space and the same pair
on two lines renders with one. Block-level elements have no such problem, which is what makes
formatting HTML useful at all rather than a no-op.

**CSS — a run of whitespace collapses to a single space, and nothing else moves.** The obvious
convenience is a trap: tidying `color : red` into `color: red` by deleting the space before
the colon will, on the next line, turn the selector `a :hover` into `a:hover`, and those
select different elements. The descendant combinator is a space, so in a selector whitespace
is a token. The one exception is a colon in something already known to be a declaration, which
is settled by whether the statement closed with `;` or with `{` — by then there is nothing
left to guess.

**Minify is offered for JSON and XML only.** Minifying CSS or HTML means deciding which
whitespace is removable, and in both it sometimes is not. Refusing outright is more use than
a minifier that is right most of the time.

## The panel

It has two states, and the second one is the point.

For a file with a formatter, the panel is the controls: **Format Document**, a strip of
Minify / Reindent / Tidy, and the indentation and tidying settings.

For a file without one it says **No formatter for this file**, names what *does* apply, and
lists the types that format — and shows nothing else. Drawing the full panel with its buttons
greyed out was the first version, and a disabled button is a question the user cannot answer:
nothing about a dim **Format Document** says what would make it available. Worse, the sentence
standing in for that answer was only half true. It read "Reindent and Tidy still apply", but
Reindent needs brackets, so on Python and Markdown — the files most likely to be in front of
someone reading it — Reindent is refused. The panel now names Reindent only where Reindent
works.

The list of types is read back out of the same table the dispatch uses, so it cannot drift
from what actually formats.

## Performance

No third-party code is vendored, and that is a performance decision before it is a taste one.
`document-preview` already measured the trade: its hand-written HTML parser does a 33 KB file
in ~1.7 ms where vendored marked takes ~72 ms on the same document. Prettier is a much heavier
parser than marked, so a vendored formatter would have needed a size cap low enough to refuse
most real files. These are scanners instead.

Measured with the JIT off, which is what the editor's `JSContext` gives a plugin
(`./run.sh bench`):

| | ms/KB | so |
|---|---|---|
| JSON | 0.038 | 5.4 MB in 205 ms |
| XML | 0.045 | 2.5 MB in 114 ms |
| CSS | 0.090 | 1.8 MB in 161 ms |
| Reindent | 0.081 | 2.2 MB in 182 ms |
| Tidy | 0.079 | 2.2 MB in 178 ms |

marked, for scale, is ~2 ms/KB in the same conditions. **There is no size cap** anywhere in
this plugin, because none is needed — and there is no watchdog to save a plugin that takes
too long, so that had to be true rather than hoped for.

Four rules get it there, and every scanner obeys them:

- **Scan with `charCodeAt`.** No regular expression runs per character, and no character is
  read as `text[i]` — that allocates a one-character string each time round the loop.
- **Emit slices, never characters.** Output is an array of chunks joined once, and a chunk is
  `text.slice(from, to)` — a whole string, a whole number, a whole tag. The chunk count is
  proportional to *tokens*, not to length, so a file with long string values costs barely more
  than a small one.
- **Intern the whitespace.** `Indents` caches newline-plus-indent per depth, so the one string
  a pretty-printer would otherwise rebuild for every line in the document is built once per
  level.
- **No object per token.** The markup scanner fills parallel arrays; the tag reader returns
  through variables. A document with 200,000 tags would otherwise allocate 200,000 records for
  three fields each.

## Refuse rather than mangle

Every formatter validates the structure it walks as it walks it, and reports a line and column
when it cannot continue — `A key with no value. (line 1, column 6)`. Nothing is written when a
formatter refuses. A formatter that guesses at broken input is one that silently rewrites the
file into something else, and undo is not an answer to a thing you did not notice.

Nothing is written when the result equals the current text, either. That is not tidiness: an
edit marks the document dirty, drops the line index and re-highlights the buffer in every pane
showing it, so a no-op write costs a full repaint and a save nobody needed to make.

## Tests

The repository has no test runner, so this plugin brings one:

```sh
./run.sh          # the suites
./run.sh bench    # the benchmarks, JIT off
```

209 assertions and 14,000 fuzz trials, run in **JavaScriptCore** through the `jsc` binary
inside the system framework — not node. A plugin runs in a `JSContext`, and a test that passes
under V8 says nothing about the engine the plugin will actually meet. `tests/harness.js` stubs
`linelark` enough to load the file; `tests/harness-host.js` adds a document the tests can drive
commands against, so `tests/commands.js` exercises the same entry points the menu does.

The fuzzers earn their place. The markup one checks that **stripping all whitespace from the
input and the output gives the same string** — it found a real bug where a stray `</b>` between
`<a>` and `</a>` was skipped by the empty-element shortcut and deleted. It also checks that
formatting twice equals formatting once, which found a second: text outside any properly closed
element was given a line of its own, and the newline was read back as part of the text on the
next run.

One thing the tests cannot check is the SF Symbols the panel names, since a mistyped one draws
nothing at all rather than failing. `tests/commands.js` prints the list it uses; resolving them
means `NSImage(systemSymbolName:)`, the way `ToolbarTests` does it in the editor.

## API used

`addCommand`, `addContextMenuItem`, `addPanel` (with `side`, `render`, `onSelect`, `onSubmit`),
`refreshPanels`, `language`, `filePath`, `isReadOnly`, `text`, `length`, `caretLine`,
`setSelection`, `replaceRange`, `storeGet`, `storeSet`, `log`.

Node types: `text`, `button`, `actions`, `rows`, `field`, `section`. `addContextMenuItem` is
`apiVersion` 5; the store is 3.

No `hosts`, no `git`, no `secrets`. There is nothing here for a user to grant.

## Known limits

**No format on save.** There is no save hook in the plugin API, so this cannot be automatic.
That is an editor-side gap rather than something a plugin can work around.

**No Format Selection.** Formatting a fragment means knowing what it is a fragment *of*, and
`{"a": 1,` is not JSON. Reindent and Tidy are whole-document for the same reason — they are
cheap enough that it does not matter.

**Rust raw strings spanning lines are not understood.** `r#"..."#` reads as an ordinary
string, which ends at the line break, so a `}` on a later line of a multi-line one is counted
as structure. A single-line raw string is handled, because the closing quote is found on the
same line.

**JavaScript regex literals are not recognised.** A brace inside one is counted as
structure, so `str.replace(/}/g, "")` leaves Reindent one level out for the rest of the file.
Telling a regex from a division needs the previous significant token, which is a lexer this
plugin does not otherwise need. Template literals, including nested ones and interpolations
holding object literals, *are* handled — `tests/reindent-tidy.js` pins both halves of that.

**Shell here-documents are not understood.** Tidy will strip trailing whitespace inside one.
Its other quoting is handled.

**HTML minified to a single line stays that way** wherever its elements are inline and abut,
which is the whitespace rule above doing its job rather than a gap. There is no way to expand
that markup without changing what the page renders.

**A `.json` opened as plain text formats; a `.txt` full of JSON does not.** The language id
decides, and the extension is consulted only when the editor could not place the file.
