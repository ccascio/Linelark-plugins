// The code formatter, fuzzed against the four things it promises.
//
//   **Nothing is lost or invented.** Strip every whitespace character from the input and
//   from the output and the two are the same string — which is exactly what it means to
//   rewrite whitespace and only whitespace. This is the markup fuzzer's invariant, and it
//   is the one that catches a scanner reading a string as code or a token as two.
//
//   **No line is added or removed.** The spacing pass works between tokens on a line; a
//   pass that moved one would be a different operation with a different name.
//
//   **Formatting twice equals formatting once.** Which is what a user checks by pressing
//   the button again.
//
//   **The two scanners agree.** §5b tokenizes the document to decide spacing and to check
//   the brackets; §5's `scanLines` tokenizes it again, more cheaply, to decide indentation.
//   They are separate on purpose — one has to be exact and one has to be fast enough for
//   Tidy on any file — and nothing but this keeps them in step. So the spacing pass
//   accepting a document and `scanLines` ending it balanced and out of every string have to
//   be the *same* answer, in both directions: one of them reading a string as code is a
//   Reindent about to act on it, and one of them refusing a file the other is happy with is
//   a Format the user cannot explain.
//
// What none of these can see is *which column* a line ends up in. There is no reference
// implementation to compare against, so the `switch`, chain and Python rules are pinned by
// the directed tests in `code.js` and `python.js` and not here.

var OPT = { unit: "    ", newline: "\n" };
var TRIPLE = '"""\nt\n"""';
var RAW_MULTI = '#"""\nm "" m\n"""#';
var ESCAPED = '"q \\" q"';

var shared = ['a', 'b', 'f', 'x1', '0', '1.5', '0x1f', '"s"', '"a b"', ' ', '  ', '\n',
              '\n  ', '(', ')', '[', ']', '{', '}', ',', ';', ':', '?', '.', '=', '==',
              '+', '-', '*', '/', '%', '&', '|', '&&', '||', '<', '>', '<=', '>=', '->',
              '!', '++', '...', '// c\n', '/* c */', '"br { br"', ESCAPED,
              'if', 'else', 'return', 'case', 'default', 'switch', 'for', 'while', 'new',
              'class', 'let', 'var'];

var byLanguage = {
    "swift":         shared.concat(['func', 'guard', 'try?', 'as?', '..<', '`class`',
                                    '@main', 'some', 'View', '"\\(a)"', '?.', '??', 'self',
                                    TRIPLE, '#"r } r"#', '#"q \\" q"#', '#"br { br"#',
                                    '##"h "# h"##', RAW_MULTI]),
    "java":          shared.concat(['void', 'int', 'public', "'c'", "'{'", '::', 'Map<K,V>',
                                    '@Override', 'instanceof', 'this', TRIPLE]),
    "javascript.js": shared.concat(['function', '=>', '`t`', '`a ${b} c`', '/re/g', '?.',
                                    '??', 'const', 'async', 'await', '#p', 'this',
                                    '`br { br`', '`a ${ {b: 1} } c`', '/{[/]}/']),
    "typescript":    shared.concat(['function', '=>', '`t`', '`a ${b} c`', '/re/g', '?.',
                                    '??', 'const', 'number', 'string', 'Array<number>',
                                    'interface', 'this', '`br { br`', '/{[/]}/'])
};

var seed = 20260912;
function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }
function strip(s) { return s.replace(/\s+/g, ""); }
function lineCount(s) { return s.split("\n").length; }

// Where `scanLines` thinks the document ends up. The trailing newline gives it one last
// line to record the state and depth *after* everything else against.
function endsBalanced(text, id) {
    var lines = scanLines(text + "\n", syntaxFor(id));
    var last = lines.count - 1;
    return lines.depth[last] === 0 && lines.state[last] === S_CODE;
}

for (var id in byLanguage) {
    if (!Object.prototype.hasOwnProperty.call(byLanguage, id)) { continue; }
    var pieces = byLanguage[id];
    var lost = 0, moved = 0, unstable = 0, refused = 0, split = 0, shown = 0;

    for (var trial = 0; trial < 4000; trial++) {
        // Brackets are balanced on the way out, so that most trials reach the formatter
        // rather than its refusal. An unbalanced file is worth a few trials and no more:
        // there is one thing to check about it and `code.js` checks it.
        var parts = [];
        var open = [];
        var howMany = 1 + rnd(18);
        for (var k = 0; k < howMany; k++) {
            var piece = pieces[rnd(pieces.length)];
            if (piece === "(") { open[open.length] = ")"; }
            else if (piece === "[") { open[open.length] = "]"; }
            else if (piece === "{") { open[open.length] = "}"; }
            else if (piece === ")" || piece === "]" || piece === "}") {
                if (open.length === 0) { continue; }
                piece = open[open.length - 1];
                open.length = open.length - 1;
            }
            parts[parts.length] = piece;
        }
        while (open.length > 0) {
            parts[parts.length] = open[open.length - 1];
            open.length = open.length - 1;
        }
        var input = parts.join("");

        var balanced = endsBalanced(input, id);
        var spaced = null;
        try { spaced = respace(input, id); } catch (e) { refused++; }
        if ((spaced !== null) !== balanced) {
            split++;
            if (shown++ < 3) {
                print("  SCANNERS DISAGREE (" + (balanced ? "scanLines" : "respace")
                      + " alone is happy) " + JSON.stringify(input));
            }
        }
        if (spaced === null) { continue; }

        if (strip(input) !== strip(spaced)) {
            lost++;
            if (shown++ < 3) {
                print("  LOSS " + JSON.stringify(input));
                print("    -> " + JSON.stringify(spaced));
            }
        }
        if (lineCount(input) !== lineCount(spaced)) {
            moved++;
            if (shown++ < 4) {
                print("  LINES " + JSON.stringify(input));
                print("    -> " + JSON.stringify(spaced));
            }
        }
        var once, twice;
        try { once = formatCode(input, id, OPT); } catch (e2) { refused++; continue; }
        if (strip(input) !== strip(once)) {
            lost++;
            if (shown++ < 8) {
                print("  LOSS (whole) " + JSON.stringify(input));
                print("    -> " + JSON.stringify(once));
            }
        }
        try { twice = formatCode(once, id, OPT); } catch (e3) { twice = null; }
        if (twice !== once) {
            unstable++;
            if (shown < 11) {
                print("  UNSTABLE " + JSON.stringify(input));
                print("    once  -> " + JSON.stringify(once));
                print("    twice -> " + JSON.stringify(twice));
                shown += 3;
            }
        }
    }
    print(id + ": 4000 trials, " + lost + " lost, " + moved + " line counts changed, "
          + split + " scanner disagreements, " + unstable + " unstable, "
          + refused + " refused");
}
