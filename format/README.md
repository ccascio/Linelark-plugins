# Format

Formats JSON, XML, HTML, CSS, Swift, Java, JavaScript and TypeScript, and reindents or
tidies whitespace in everything else.

Five commands under **Plugins**, a **Format** panel in the right dock
(**View ▸ Show Right Dock**, ⌥⌘B), and **Format Document** on a tab's context menu for the
file types that have a real formatter.

- **Format Document** — JSON, XML, HTML, CSS/SCSS/LESS, Swift, Java, JavaScript, TypeScript
- **Minify Document** — JSON and XML
- **Reindent Document** — brace languages, and Python
- **Tidy Whitespace** — every language

## What it will not do, and why

**Nothing here decides where a line breaks.** That is the whole of the difference between
this and `black`, `swift-format`, `gofmt` and Prettier: they reflow a document to a print
width, which means holding a syntax tree and a layout algorithm, and they are separate
programs for good reason. The plugin API has no call that runs one, and the App Store
edition is sandboxed, so a "run a formatter" call would have nowhere to lead in half the
builds this plugin has to work in.

So every operation here is defined on the whitespace and on nothing else, and each is named
for exactly what it does:

**Reindent** rewrites the leading whitespace of each line. For a brace language it comes
from the bracket structure, the way Notepad++'s re-indent and Xcode's ⌃I work. For Python
it comes from the file's own indent stack, because there is nothing else it could honestly
come from. It never wraps and never reorders.

**Spacing** rewrites the whitespace *between two tokens on a line* — `f(a ,b)` into
`f(a, b)`, `x=1` into `x = 1`. It never breaks a line, never joins two, and never moves a
token past another.

**Format Document** for Swift, Java, JavaScript and TypeScript is those two, in that order.
For JSON, XML, HTML and CSS it is the structural formatters below, which do rewrap, because
their grammars are small enough to reformat *exactly*.

**Tidy** removes whitespace that does nothing — trailing spaces, runs of blank lines, a
missing final newline. It only ever *removes*, which is why it is safe on any file the
editor can open, including one whose language it has never heard of.

Calling any of this "Format Python" or "a Swift formatter" would be a lie about what it
does, so none of it is called that. What it *is* is the half of formatting that can be done
exactly, offered under its own name.

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

**Code — the spacing of a pair of tokens is settled by the pair, or it is left alone.** Two
lists say which pairs settle it. Everything outside them keeps whatever the file already
had, which is why `a<b` comes back as `a<b` while `a=b` comes back as `a = b`. Four rules do
the deciding, and each of them exists because getting it wrong costs something:

- **An operator is spaced only where it is infix.** Swift is why. `a - b` and `-b` are both
  Swift; `a -b` is not, because an operator with whitespace on one side only is read as a
  prefix one. So spacing every `-` would turn `let y = -x` into something that does not
  compile. An operator is infix when a value has just ended — an identifier, a number, a
  string, a `)`, a `]`, a `}` — and prefix otherwise. That same question decides whether `/`
  divides or opens a pattern, which is how `str.replace(/}/g, "")` is read correctly, and
  it rests on a per-language keyword list: after `return`, `case` or `as` no value has
  ended. Per language, because a shared list is wrong in both directions at once — `new`,
  `delete` and `repeat` are ordinary names in Swift, and `of` is load-bearing in
  JavaScript's `for (x of ys)`.
- **Nothing beginning with `<` or `>` is ever spaced.** `<` opens a generic parameter list
  as readily as it compares, and `Map<String, List<String>> m` has three of them and no
  comparison at all. Telling those apart needs a type checker, so `<`, `>`, `<=`, `>=`, `<<`
  and `>>` are left exactly as written — and `Array<number>= []`, which reads as `>=` to a
  scanner, is left alone rather than rewritten into something that means `>=`.
- **`:` is three tokens wearing one character.** A type annotation, an object key, a `case`
  label and a ternary's second half are all `:`, and the first three want no space in front
  and one behind while the ternary wants one on each side. They are told apart by counting:
  a `?` that opens a ternary is remembered against its bracket depth and the next `:` at
  that depth answers it. Adjacency settles the rest, the same way it settles `?.` — Swift's
  `x?(y)` and `values?[0]` are an optional call and an optional subscript, `flag ? (a) : (b)`
  is a ternary, and the difference is the space.
- **More than one space is alignment, and alignment is left alone.** What this pass decides
  is the choice between one space and none. A column somebody lined up — a table of
  settings, a run of trailing comments — was done on purpose, and collapsing it is the
  change a formatter is least forgiven for.

**Strings and comments are copied out exactly**, a multi-line one included: a template
literal and its interpolations, a `"""` block, a Swift `#"…"#` and the quote inside it. This
is the markup formatter's rule about an element's own text, for the same reason — the inside
of a string is not whitespace to be tidied, it is the value of something.

**Minify is offered for JSON and XML only.** Minifying CSS or HTML means deciding which
whitespace is removable, and in both it sometimes is not. Taking the line breaks out of a
program is a different job again, and not one anything here does. Refusing outright is more
use than a minifier that is right most of the time.

## Indentation, and the three things bracket depth does not know

Reindent counts brackets, and on its own that is wrong in three places common enough that
getting them right is most of what makes it usable.

**Brackets opened on one line are one level, not one each.** `defineConfig({` opens two and
means one. Every editor indents its body a single level, and counting both brings a
two-space file back at eight — which is the shape of nearly every JavaScript config file
and every `test('…', () => {` there is. So a bracket opened on a line that already has one
open takes that one's level, and a line *starting* with a closer takes the level of the line
its bracket was opened on.

**A `switch` body is indented by convention, not by brackets**, and the two conventions
differ by which half of the pair moves. Swift and Xcode leave the body where the brackets
put it and pull the labels out to the `switch`; C, Java, JavaScript and TypeScript leave the
labels one level in and push the body past them. Both are "one level between a label and its
statements", written from opposite ends. A `switch` is tracked as a kind of brace frame so
that Swift's `enum E { case a }` is not mistaken for one.

**A line beginning with an operator is the rest of the line above it.** A SwiftUI modifier,
a stream, a promise chain, the second half of a wrapped condition, the `: otherwise` of a
ternary — the brackets say nothing about any of them, because none of them opened one. Such
a line goes one level in from whatever began the run and stays there for the rest of it; a
run hanging off a closing bracket keeps that bracket's level, which is what `}` followed by
`.padding()` wants. A comment in the middle is passed over rather than treated as what the
chain hangs off, because `}`, four lines saying why, and then `.overlay(…)` is ordinary
SwiftUI and stepping every modifier under it one level in is not. `&` and `|` count only
doubled and `-` only as `->`, because a line may legitimately start with Swift's inout
marker or with C++'s `*p = 1;`.

## Python

Its indentation *is* its block structure, so there is nothing to recompute it from — which
is why this is a different algorithm rather than a flag on the one above. What it can do is
restate the structure the file already has in the unit that was asked for: read the indent
stack the way Python reads it, and re-emit each statement at the depth that stack puts it
on. Three spaces become four, tabs become spaces, an over-indented block comes back in line,
and **no statement changes which block it is in**.

Two things are deliberately not rebuilt. A **continuation line** — inside brackets, or after
a `\` — is shifted by the same number of columns as the statement it belongs to, never
re-indented: its whitespace is usually alignment to a column, and rebuilding it from a depth
would destroy that. A **comment on its own line** is indented like the statement below it,
because that is the statement it is about, and it never moves the indent stack — a comment
is allowed at any column and must not be read as a dedent.

It refuses two files rather than guess at them. One that dedents to a column no enclosing
block is on is what Python itself calls an `IndentationError`. One whose indentation means
different things depending on whether a tab is one column or eight is a `TabError`, and
comparing under both readings is how CPython decides that too.

There is no Format Document for Python. Spacing inside a Python line is PEP 8, which is
`black`'s subject and not a token-pair question, and offering a button that did a third of
it would be the lie this plugin is written to avoid.

## The panel

It has two states, and the second one is the point.

For a file with a formatter, the panel is the controls: **Format Document**, a strip of
Minify / Reindent / Tidy, and the indentation and tidying settings. It names the language it
thinks the file is, because that is the one thing a reader wants confirmed before pressing
anything.

For a file without one it says **No formatter for this file**, names what *does* apply, and
lists the types that format — and shows nothing else. Drawing the full panel with its buttons
greyed out was the first version, and a disabled button is a question the user cannot answer:
nothing about a dim **Format Document** says what would make it available. Worse, the sentence
standing in for that answer was only half true. It read "Reindent and Tidy still apply", but
Reindent needs a structure to read indentation back out of, and on Markdown and YAML there is
not one. The panel now names Reindent only where Reindent works — which, since Python got
one, includes Python.

The list of types is read back out of the same tables the dispatch uses, so it cannot drift
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
| JSON | 0.036 | 5.4 MB in 198 ms |
| XML | 0.046 | 2.5 MB in 116 ms |
| CSS | 0.092 | 1.8 MB in 164 ms |
| Reindent | 0.109 | 2.2 MB in 244 ms |
| Tidy | 0.102 | 2.2 MB in 229 ms |
| Python reindent | 0.096 | 2.6 MB in 254 ms |
| Format Document, Swift | 0.206 | 3.5 MB in 716 ms |

marked, for scale, is ~2 ms/KB in the same conditions. **There is no size cap** anywhere in
this plugin, because none is needed — and there is no watchdog to save a plugin that takes
too long, so that had to be true rather than hoped for. Format Document is the dearest thing
here because it is two passes, and it is still ten times faster than a parser this plugin
declined to vendor.

Reindent and Tidy cost about a quarter more than they did before they knew about `switch`
bodies and regular expressions, which is what those two features are worth paying. The line
scanner is the pass Tidy runs on *every* file in the editor, so the cost was measured rather
than assumed: character classes are spelt out inline rather than called, each language's
facts are pulled into locals before the loop, and a word is read as a whole word because
skipping one is faster than stepping through it.

Four rules get the rest of it there, and every scanner obeys them:

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

For code that means **a file whose brackets do not balance is refused**, as is one with a
string, a comment or a template literal left open. Reindent is deliberately not held to this:
it is best-effort on anything and clamps a stray `}` to the left margin, because it is also
what a half-written file gets offered. Format is held to it, because respacing a document the
scanner cannot account for is the case where a quiet mistake spreads over the whole of it.

Nothing is written when the result equals the current text, either. That is not tidiness: an
edit marks the document dirty, drops the line index and re-highlights the buffer in every pane
showing it, so a no-op write costs a full repaint and a save nobody needed to make.

## Tests

The repository has no test runner, so this plugin brings one:

```sh
./run.sh          # the suites
./run.sh bench    # the benchmarks, JIT off
```

387 assertions and 30,000 fuzz trials, run in **JavaScriptCore** through the `jsc` binary
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

`tests/fuzz-code.js` checks those two and one more: **the two scanners agree.** The spacing
pass tokenizes a document exactly, to decide spacing and to check the brackets; the line
scanner tokenizes it again, more cheaply, to decide indentation. They are separate on purpose
— one has to be exact and one has to be fast enough for Tidy on any file — and nothing but
that check keeps them in step. So the spacing pass accepting a document and the line scanner
ending it balanced and out of every string have to be the same answer, both ways round.

**What no fuzzer here can see is a space in the wrong column.** There is no reference
implementation to compare against, so the `switch`, chain, bracket and Python rules are
pinned by directed tests — and the directed tests that matter most were written by running
the formatter over sixty files of the editor's own Swift and sixty of JavaScript and reading
every line it changed. That is where `init?(header:)`, `@escaping (T) -> U`, `token &+= 1`,
`URL?? = nil`, `case delete(old: Int)`, `.catch(fn)`, `import('./x.js')` and
`x -> Thing? in` came from: every one of them was a real line that came back wrong, and
every one of them is now a test. A formatter is worth exactly what it does to files that
already exist, and driving it over a corpus is the only way to find that out.

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

**JSX and TSX do not format.** `<div>` is not an operator and `</div>` is not a division:
JSX is a second grammar living in the same files, and nothing here reads it. A `.jsx` or
`.tsx` is therefore refused by Format Document by extension rather than mangled by it.
Reindent and Tidy are unaffected — neither of them looks at a `<` — and a `.js` or `.ts`
holding JSX is the one case this gets wrong, because the extension is all it goes on.

**A ternary onto a closure loses the space before its colon.** `flag ? { … } : x` and Swift's
`-> Thing? {` are the same two characters, and one token of lookahead cannot tell them apart.
The second is far the commoner — eight of them in sixty files of the editor's own source,
against two of the first — and `-> Any ? {` reads as broken where a ternary missing one space
only reads as untidy. `tests/code.js` pins the choice so that changing it is a deliberate act.

**A hand-aligned continuation is rebuilt.** A `guard let a = x,` whose second clause is
aligned under the first, or an argument list aligned to its opening bracket, comes back at
the level the brackets give it. That is Reindent doing exactly what it says; it is also the
largest single source of diff when Format Document is run over a file written by somebody
who aligns by hand.

**Rust raw strings spanning lines are not understood.** `r#"..."#` reads as an ordinary
string, which ends at the line break, so a `}` on a later line of a multi-line one is counted
as structure. A single-line raw string is handled, because the closing quote is found on the
same line. Swift's `#"…"#`, including the multi-line `#"""` form, *is* understood.

**Nested block comments are not.** Swift allows `/* /* */ */`; both scanners here end the
comment at the first `*/`.

**Shell here-documents are not understood.** Tidy will strip trailing whitespace inside one.
Its other quoting is handled.

**HTML minified to a single line stays that way** wherever its elements are inline and abut,
which is the whitespace rule above doing its job rather than a gap. There is no way to expand
that markup without changing what the page renders.

**A `.json` opened as plain text formats; a `.txt` full of JSON does not.** The language id
decides, and the extension is consulted only when the editor could not place the file — with
two exceptions, both of which the extension wins: a `.vue` is lexed as JavaScript and is
markup by construction, and a `.jsx` or `.tsx` holds the grammar above.
