// Format — structural formatters for JSON, XML, HTML and CSS, written by hand.
//
// Nothing here is vendored. That is a performance decision before it is a taste one:
// JavaScriptCore interprets a plugin, and `document-preview` already measured what that
// costs — its hand-written HTML parser does a 33 KB file in ~1.7 ms where vendored marked
// takes ~72 ms on the same document. Prettier is a much heavier parser than marked, so a
// vendored formatter would have needed a size cap low enough to refuse most real files.
// These are scanners instead, and they hold ~0.02–0.05 ms/KB with the JIT off.
//
// Four rules do all the work, and every formatter below obeys them.
//
// **Scan with `charCodeAt`.** No regular expression runs per character, and no character is
// ever read as `text[i]` — that allocates a one-character string each time round the loop.
//
// **Emit slices of the source, never characters.** The output is an array of chunks joined
// once at the end, and a chunk is `text.slice(from, to)` — a whole string, a whole number, a
// whole tag. So the number of chunks is proportional to the *tokens* in the document, not to
// its length, and a 5 MB file with long string values costs barely more than a small one.
//
// **Intern the whitespace.** Indentation is never built in the loop. `Indents` hands back a
// cached newline-plus-indent for a depth, so the one string that would otherwise be rebuilt
// millions of times is built once per depth level and reused.
//
// **Refuse rather than mangle.** Every formatter validates the structure it is walking as it
// walks it, and reports a line and column when it cannot. A formatter that guesses at broken
// input is a formatter that silently rewrites the file into something else, and undo is not
// an answer to a thing you did not notice.
//
// The scope is deliberate and stated plainly in the README: JSON, XML, HTML and CSS are
// formatted, because their grammars are small enough to reformat *exactly*. Python, Swift,
// Go and Rust are not — that is black, swift-format, gofmt and rustfmt, they are separate
// programs, and the plugin API has no call that runs one. What those languages get here is
// Reindent and Tidy, which are named for what they do and never move a token.

// ---------------------------------------------------------------------------------------
// §0  Settings
// ---------------------------------------------------------------------------------------
//
// Kept in the plugin store, so they survive a relaunch — a preference about indentation is
// not a setting for the job in hand. Held as the text that was typed, parsed at the point of
// use, for `sort-lines`' reason: a field cannot be submitted empty, so a value parsed on the
// way in could never be corrected once it was wrong.

var STORE_KEY = "settings";

var DEFAULTS = {
    indent: "4",            // as typed; spaces per level
    useTabs: false,
    maxBlankLines: "1",     // as typed; 0 removes every blank line
    finalNewline: true,
    trimTrailing: true,
    collapseBlanks: true
};

var settings = loadSettings();

function loadSettings() {
    var out = {};
    for (var name in DEFAULTS) {
        if (Object.prototype.hasOwnProperty.call(DEFAULTS, name)) { out[name] = DEFAULTS[name]; }
    }
    var stored = linelark.storeGet(STORE_KEY);
    if (!stored) { return out; }
    try {
        var parsed = JSON.parse(stored);
        for (var key in out) {
            if (Object.prototype.hasOwnProperty.call(parsed, key)) { out[key] = parsed[key]; }
        }
    } catch (error) {
        linelark.log("Settings could not be read, using the defaults: " + error);
    }
    return out;
}

// `storeSet` *returns* its refusal rather than throwing, and a panel that ignores it is a
// panel that looks like it is saving and is not.
function saveSettings() {
    var refusal = linelark.storeSet(STORE_KEY, JSON.stringify(settings));
    if (refusal) { linelark.log("Settings were not saved: " + refusal); }
}

// The one place the typed indent width becomes a string. Clamped rather than refused: a
// document indented 200 spaces a level is not what anyone meant by typing 200.
function indentUnit() {
    if (settings.useTabs) { return "\t"; }
    var width = parseInt(settings.indent, 10);
    if (!isFinite(width) || width < 1) { width = 4; }
    if (width > 16) { width = 16; }
    var unit = "";
    for (var i = 0; i < width; i++) { unit += " "; }
    return unit;
}

function blankLineLimit() {
    var limit = parseInt(settings.maxBlankLines, 10);
    if (!isFinite(limit) || limit < 0) { return 1; }
    return limit > 32 ? 32 : limit;
}

// ---------------------------------------------------------------------------------------
// §1  Shared scanning primitives
// ---------------------------------------------------------------------------------------

// Character codes, named once. Comparing `charCodeAt(i) === QUOTE` is the whole reason these
// scanners are fast; comparing `text[i] === '"'` allocates a string per character.
var TAB = 9, LF = 10, CR = 13, SPACE = 32;
var QUOTE = 34, HASH = 35, DOLLAR = 36, APOS = 39, STAR = 42, PLUS = 43, COMMA = 44;
var MINUS = 45, DOT = 46, SLASH = 47, COLON = 58, SEMI = 59, LT = 60, EQ = 61, GT = 62;
var QUESTION = 63, AT = 64, BACKSLASH = 92, BACKTICK = 96;
var PERCENT = 37, AMP = 38, CARET = 94, PIPE = 124;
var OPEN_BRACKET = 91, CLOSE_BRACKET = 93;
var OPEN_BRACE = 123, CLOSE_BRACE = 125;
var OPEN_PAREN = 40, CLOSE_PAREN = 41, BANG = 33;

function isSpaceCode(code) {
    return code === SPACE || code === TAB || code === LF || code === CR;
}

// An output buffer of chunks, joined once.
//
// `parts[n++] = s` rather than `parts.push(s)`: the push is a call through the prototype
// chain on every token, and with the JIT off that is not free. The array is trimmed to
// length before joining because assigning past the end leaves it sparse otherwise.
function Out() {
    this.parts = [];
    this.n = 0;
}

Out.prototype.add = function (chunk) {
    this.parts[this.n++] = chunk;
};

Out.prototype.done = function () {
    this.parts.length = this.n;
    return this.parts.join("");
};

// Newline-plus-indent, cached per depth.
//
// This is the one string a pretty-printer would otherwise rebuild for every line in the
// document. A file with 200,000 lines at eight distinct depths builds eight strings here
// and reuses them 200,000 times.
function Indents(unit, newline) {
    this.unit = unit;
    this.newline = newline;
    this.plain = [""];
    this.leading = [newline];
}

Indents.prototype.at = function (depth) {
    var cache = this.plain;
    for (var i = cache.length; i <= depth; i++) { cache[i] = cache[i - 1] + this.unit; }
    return cache[depth];
};

// What a formatter actually emits between two tokens: one chunk, not two.
Indents.prototype.line = function (depth) {
    var cache = this.leading;
    for (var i = cache.length; i <= depth; i++) { cache[i] = cache[i - 1] + this.unit; }
    return cache[depth];
};

// A refusal, carrying where it happened. Thrown rather than returned so a scanner can give
// up from anywhere in its loop without every caller having to check.
function FormatError(message, offset) {
    this.message = message;
    this.offset = offset === undefined ? -1 : offset;
}

function refuse(message, offset) {
    throw new FormatError(message, offset);
}

// Where an offset is, in the numbering the gutter uses. Walked only when something has
// already gone wrong, so its cost never lands on a successful format.
function placeOf(text, offset) {
    if (offset < 0) { return ""; }
    var line = 1;
    var lineStart = 0;
    for (var i = 0; i < offset && i < text.length; i++) {
        if (text.charCodeAt(i) === LF) { line++; lineStart = i + 1; }
    }
    return " (line " + line + ", column " + (offset - lineStart + 1) + ")";
}

// The line ending the document already uses, so formatting never converts one silently.
// The first `\r\n` decides; a file with no line breaks at all gets `\n`.
function newlineOf(text) {
    var limit = text.length;
    for (var i = 0; i < limit; i++) {
        var code = text.charCodeAt(i);
        if (code === CR) { return text.charCodeAt(i + 1) === LF ? "\r\n" : "\r"; }
        if (code === LF) { return "\n"; }
    }
    return "\n";
}

// A document that ends in a line break keeps ending in one, and a document that does not
// keeps not — unless the Tidy setting says otherwise, which is Tidy's business and not a
// formatter's. Formatting a file should not also change something nobody asked about.
function endedWithNewline(text) {
    var last = text.length - 1;
    return last >= 0 && (text.charCodeAt(last) === LF || text.charCodeAt(last) === CR);
}

// A leading byte-order mark is content as far as every scanner here is concerned, and none
// of them expect one. Split it off and put it back afterwards.
function bomOf(text) {
    return text.charCodeAt(0) === 0xFEFF ? "\uFEFF" : "";
}

function options() {
    return { unit: indentUnit(), newline: "\n" };
}

// ---------------------------------------------------------------------------------------
// §2  JSON
// ---------------------------------------------------------------------------------------
//
// **Not `JSON.parse` followed by `JSON.stringify`.** That round trip is where every naive
// JSON formatter loses data, and it loses it silently:
//
//   - `1.0` comes back `1`, and `1e3` comes back `1000`. The file said something specific
//     about the number it meant and the formatter overruled it.
//   - `12345678901234567890` comes back `12345678901234567000`. Anything past 2^53 is
//     rounded to whatever the nearest double is, and there is no warning.
//   - `{"2": a, "b": b, "1": c}` comes back with `"1"` and `"2"` first, because integer-like
//     keys are ordered ahead of the rest by the language itself. Reformatting a file is not
//     licence to reorder it.
//   - A duplicate key silently loses every copy but the last.
//
// So this walks tokens and rewrites *only the whitespace between them*. Every string, every
// number and every literal reaches the output as `text.slice(start, end)` — the same bytes
// that went in. What changes is the indentation, and nothing else can.

// Where the scanner is, in the grammar. Kept as small integers rather than strings because
// this is compared on every token.
var WANT_VALUE = 0;     // a value, or the close of the array we are in
var WANT_KEY = 1;       // a key string, or the close of the object we are in
var WANT_COLON = 2;
var WANT_COMMA = 3;     // a comma, or a close

// What was emitted last, which is what decides the whitespace before the next thing.
var P_NONE = 0, P_OPEN = 1, P_COMMA = 2, P_COLON = 3, P_VALUE = 4;
var P_LINE_COMMENT = 5, P_BLOCK_COMMENT = 6;

var IN_OBJECT = 1, IN_ARRAY = 2;

function formatJSON(text, opt, minify) {
    var len = text.length;
    var out = new Out();
    var ind = new Indents(opt.unit, opt.newline);

    var stack = [];             // IN_OBJECT / IN_ARRAY, innermost last
    var depth = 0;
    var expect = WANT_VALUE;
    var prev = P_NONE;
    var i = 0;

    // A comma is written when the thing after it turns up, never when it is read. That is
    // what removes a trailing comma without looking ahead for one: if what turns up is a
    // closing bracket, the comma is simply never emitted.
    var pendingComma = false;

    // The separator before a token. `closing` is true for `}` and `]`, which sit at the
    // indentation of the line that opened them rather than of their contents.
    function lead(closing) {
        if (pendingComma) {
            pendingComma = false;
            if (!closing) { out.add(","); prev = P_COMMA; }
        }
        // Minified output has no whitespace anywhere. A line comment would swallow
        // everything after it on a line that no longer has a break in it, which is why
        // comments are dropped rather than kept when minifying — they cannot reach here.
        if (minify) { return ""; }
        switch (prev) {
            case P_NONE: return "";
            case P_OPEN: return closing ? "" : ind.line(depth);
            case P_COLON: return " ";
            default: return ind.line(depth);
        }
    }

    while (i < len) {
        // The gap between tokens. Whether it contained a line break is what tells a comment
        // it belongs at the end of the previous line rather than on one of its own.
        var gapBroke = false;
        while (i < len) {
            var space = text.charCodeAt(i);
            if (space === SPACE || space === TAB) { i++; }
            else if (space === LF || space === CR) { gapBroke = true; i++; }
            else { break; }
        }
        if (i >= len) { break; }

        var start = i;
        var code = text.charCodeAt(i);

        // Comments. Not JSON, but `.jsonc`, `tsconfig.json` and every hand-maintained
        // settings file has them, and dropping them would be the formatter deleting the
        // only explanation of what a setting is for.
        if (code === SLASH) {
            var next = text.charCodeAt(i + 1);
            if (next !== SLASH && next !== STAR) {
                refuse("A stray \"/\" — JSON has no division, and a comment needs \"//\" "
                       + "or \"/*\".", i);
            }
            var end = next === SLASH ? endOfLineComment(text, i) : endOfBlockComment(text, i);
            if (!minify) {
                if (pendingComma) { pendingComma = false; out.add(","); prev = P_COMMA; }
                // A comment written beside a value is about that value, so it stays on its
                // line — moving it down loses which one it meant. What makes it trailing is
                // following a *value*, not merely sharing a line: a comment after the `{`
                // that opens a block belongs on its own line, with the block's contents.
                // Between a key's `:` and its value it is transparent, and the value stays
                // where it was rather than being pushed onto a line of its own.
                var afterColon = prev === P_COLON;
                var trailing = afterColon
                    || (!gapBroke && (prev === P_VALUE || prev === P_COMMA));
                if (prev === P_NONE) { /* the first thing in the file */ }
                else if (trailing) { out.add(" "); }
                else { out.add(ind.line(depth)); }
                out.add(text.slice(start, end));
                prev = (afterColon && next === STAR) ? P_COLON
                     : (next === SLASH ? P_LINE_COMMENT : P_BLOCK_COMMENT);
            }
            i = end;
            continue;
        }

        switch (code) {
        case OPEN_BRACE:
        case OPEN_BRACKET:
            if (stack.length === 0 && expect === WANT_COMMA) {
                refuse("A second value at the top level — a JSON document holds one.", i);
            }
            if (expect === WANT_KEY) { refuse("Expected a key here.", i); }
            if (expect === WANT_COLON) { refuse("Expected \":\" here.", i); }
            if (expect === WANT_COMMA) { refuse("Expected \",\" here.", i); }
            out.add(lead(false));
            out.add(code === OPEN_BRACE ? "{" : "[");
            stack[stack.length] = code === OPEN_BRACE ? IN_OBJECT : IN_ARRAY;
            depth++;
            expect = code === OPEN_BRACE ? WANT_KEY : WANT_VALUE;
            prev = P_OPEN;
            i++;
            break;

        case CLOSE_BRACE:
        case CLOSE_BRACKET: {
            var wantObject = code === CLOSE_BRACE;
            var open = stack.length === 0 ? 0 : stack[stack.length - 1];
            if (open === 0) {
                refuse("A closing \"" + (wantObject ? "}" : "]") + "\" with nothing open.", i);
            }
            if ((open === IN_OBJECT) !== wantObject) {
                refuse("Closed with \"" + (wantObject ? "}" : "]") + "\" what was opened "
                       + "with \"" + (open === IN_OBJECT ? "{" : "[") + "\".", i);
            }
            if (expect === WANT_COLON) { refuse("Expected \":\" here.", i); }
            if (open === IN_OBJECT && expect === WANT_VALUE) {
                refuse("A key with no value.", i);
            }
            stack.length = stack.length - 1;
            depth--;
            out.add(lead(true));
            out.add(wantObject ? "}" : "]");
            expect = WANT_COMMA;
            prev = P_VALUE;
            i++;
            break;
        }

        case COMMA:
            if (expect !== WANT_COMMA || stack.length === 0) {
                refuse("A \",\" where there is no value to separate.", i);
            }
            pendingComma = true;
            expect = stack[stack.length - 1] === IN_OBJECT ? WANT_KEY : WANT_VALUE;
            i++;
            break;

        case COLON:
            if (expect !== WANT_COLON) { refuse("A \":\" outside a key and value.", i); }
            out.add(":");
            expect = WANT_VALUE;
            prev = P_COLON;
            i++;
            break;

        default: {
            // Checked before `expect`, because at the top level "expected a comma" names
            // the wrong problem: there is no list here for a comma to belong to.
            if (stack.length === 0 && expect === WANT_COMMA) {
                refuse("A second value at the top level — a JSON document holds one.", i);
            }
            if (expect === WANT_COLON) { refuse("Expected \":\" after the key.", i); }
            if (expect === WANT_COMMA) { refuse("Expected \",\" between values.", i); }
            var stop = readValue(text, i, expect === WANT_KEY);
            out.add(lead(false));
            out.add(text.slice(start, stop));
            prev = P_VALUE;
            expect = expect === WANT_KEY ? WANT_COLON : WANT_COMMA;
            i = stop;
            break;
        }
        }
    }

    if (stack.length > 0) {
        refuse("The document ends with " + stack.length + " unclosed "
               + (stack.length === 1 ? "bracket" : "brackets") + ".", len);
    }
    if (prev === P_NONE) { refuse("Nothing to format — the document holds no JSON.", 0); }
    if (expect === WANT_COLON || prev === P_COLON) {
        refuse("The document ends part-way through a key and value.", len);
    }
    return out.done();
}

// A string, a number or one of the three literals, returned as the offset just past it.
// Nothing is copied here and nothing is interpreted — the caller slices the source.
function readValue(text, i, mustBeKey) {
    var code = text.charCodeAt(i);
    if (code === QUOTE) { return readJSONString(text, i); }
    if (mustBeKey) {
        if (code === APOS) {
            refuse("A key in single quotes — JSON keys use double quotes.", i);
        }
        refuse("A key that is not a quoted string.", i);
    }
    if (code === APOS) {
        refuse("A string in single quotes — JSON strings use double quotes.", i);
    }
    if (code === MINUS || (code >= 48 && code <= 57)) { return readJSONNumber(text, i); }
    if (text.startsWith("true", i)) { return i + 4; }
    if (text.startsWith("false", i)) { return i + 5; }
    if (text.startsWith("null", i)) { return i + 4; }
    if (text.startsWith("NaN", i) || text.startsWith("Infinity", i)
        || text.startsWith("-Infinity", i)) {
        refuse("JSON has no NaN or Infinity.", i);
    }
    refuse("Not a value: \"" + text.slice(i, Math.min(i + 12, text.length)) + "\".", i);
}

// Escapes are checked because an invalid one means the file is not what it claims to be,
// and reformatting it would put a valid-looking shape around broken content. A raw control
// character inside a string is *tolerated* — strictly it is invalid, real files contain
// literal tabs, and passing it through changes nothing about it.
function readJSONString(text, i) {
    var len = text.length;
    var start = i;
    i++;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code === QUOTE) { return i + 1; }
        if (code === BACKSLASH) {
            var escape = text.charCodeAt(i + 1);
            if (escape === 117) {                       // \u
                for (var digit = 2; digit < 6; digit++) {
                    var hex = text.charCodeAt(i + digit);
                    var isHex = (hex >= 48 && hex <= 57) || (hex >= 97 && hex <= 102)
                                || (hex >= 65 && hex <= 70);
                    if (!isHex) { refuse("A \\u escape without four hex digits.", i); }
                }
                i += 6;
                continue;
            }
            //  " \ / b f n r t
            if (escape !== QUOTE && escape !== BACKSLASH && escape !== SLASH && escape !== 98
                && escape !== 102 && escape !== 110 && escape !== 114 && escape !== 116) {
                refuse("An escape JSON does not have: \\"
                       + text.charAt(i + 1) + ".", i);
            }
            i += 2;
            continue;
        }
        if (code === LF || code === CR) {
            refuse("A string that runs off the end of its line.", start);
        }
        i++;
    }
    refuse("A string with no closing quote.", start);
}

function readJSONNumber(text, i) {
    var len = text.length;
    var start = i;
    if (text.charCodeAt(i) === MINUS) { i++; }
    var digitStart = i;
    var digits = 0;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code < 48 || code > 57) { break; }
        i++; digits++;
    }
    if (digits === 0) { refuse("A number with no digits.", start); }
    // A leading zero is only ever a whole number on its own: `007` is not JSON, and letting
    // it through would mean writing out a file that no parser will read back.
    if (digits > 1 && text.charCodeAt(digitStart) === 48) {
        refuse("A number with a leading zero.", start);
    }
    if (text.charCodeAt(i) === DOT) {
        i++;
        var fraction = 0;
        while (i < len) {
            var frac = text.charCodeAt(i);
            if (frac < 48 || frac > 57) { break; }
            i++; fraction++;
        }
        if (fraction === 0) { refuse("A number with nothing after its decimal point.", start); }
    }
    var exponent = text.charCodeAt(i);
    if (exponent === 101 || exponent === 69) {          // e E
        i++;
        var sign = text.charCodeAt(i);
        if (sign === PLUS || sign === MINUS) { i++; }
        var power = 0;
        while (i < len) {
            var digit = text.charCodeAt(i);
            if (digit < 48 || digit > 57) { break; }
            i++; power++;
        }
        if (power === 0) { refuse("A number with nothing after its exponent.", start); }
    }
    return i;
}

function endOfLineComment(text, i) {
    var len = text.length;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code === LF || code === CR) { return i; }
        i++;
    }
    return len;
}

function endOfBlockComment(text, i) {
    var end = text.indexOf("*/", i + 2);
    if (end < 0) { refuse("A block comment with no \"*/\".", i); }
    return end + 2;
}

// ---------------------------------------------------------------------------------------
// §3  XML and HTML
// ---------------------------------------------------------------------------------------
//
// The rule that decides everything here: **an element holding any text of its own is
// emitted exactly as it was found.** Not trimmed, not re-wrapped, not re-indented — the
// source slice, byte for byte.
//
// That is stricter than most pretty-printers and it is the only defensible line. Text is
// content. `<name> Ada </name>` and `<name>Ada</name>` are different documents, and mixed
// content — `<p>Hello <b>world</b>!</p>` — cannot be broken across lines at all without
// inventing whitespace inside a sentence. So a formatter that reflows text is a formatter
// that edits prose, and no amount of indentation is worth that.
//
// What is reformatted is the whitespace *between* elements, where there is nothing but
// whitespace to begin with. Three things are held out of even that:
//
//   - `xml:space="preserve"`, which is the document saying so in as many words.
//   - `<pre>` and `<textarea>`, where whitespace renders, and `<script>` and `<style>`,
//     whose content is not markup and is not tokenized as any.
//   - In HTML, a run of **inline** elements written with no whitespace between them.
//     `<span>a</span><span>b</span>` renders without a space and `<span>a</span>\n
//     <span>b</span>` renders with one, so breaking that line changes the page. Block-level
//     elements have no such problem — whitespace between block boxes does not render — so
//     those are indented freely, which is what makes formatting HTML useful at all.
//
// Two passes, one over the characters. Pass one tokenizes into parallel arrays and, with a
// stack, records for each opening tag where it closes and what kind of children it turned
// out to have. Pass two walks those arrays and emits. Deciding "does this element hold
// text" during pass one is what keeps the whole thing linear: asking the question at emit
// time means re-scanning an element's contents for every level it is nested inside.

var T_TEXT = 0, T_OPEN = 1, T_CLOSE = 2, T_SELF = 3;
var T_COMMENT = 4, T_CDATA = 5, T_PI = 6, T_DECL = 7;

var F_TEXT = 1;       // holds a non-whitespace text node of its own
var F_ELEMENT = 2;    // holds an element, comment or CDATA child
var F_PRESERVE = 4;   // xml:space="preserve", <pre>, <textarea>, <script>, <style>
var F_TIGHT = 8;      // its children abut, with no whitespace anywhere between them

// HTML elements that never have a closing tag.
var VOID_ELEMENTS = {
    area: 1, base: 1, br: 1, col: 1, embed: 1, hr: 1, img: 1, input: 1, keygen: 1,
    link: 1, meta: 1, param: 1, source: 1, track: 1, wbr: 1
};

// Content that is not markup. `<` inside these is not a tag, so the tokenizer runs straight
// to the closing tag rather than trying to read what it finds as one.
var RAW_TEXT_ELEMENTS = { script: 1, style: 1 };

// Markup, but whitespace inside it renders.
var PRESERVE_ELEMENTS = { pre: 1, textarea: 1 };

// Rendered in the line box rather than as a block, which is what makes the whitespace
// between two of them visible. The list is the HTML inline set plus the few form controls
// that behave the same way.
var INLINE_ELEMENTS = {
    a: 1, abbr: 1, b: 1, bdi: 1, bdo: 1, br: 1, button: 1, cite: 1, code: 1, data: 1,
    datalist: 1, del: 1, dfn: 1, em: 1, i: 1, img: 1, input: 1, ins: 1, kbd: 1, label: 1,
    map: 1, mark: 1, meter: 1, noscript: 1, object: 1, output: 1, picture: 1, progress: 1,
    q: 1, ruby: 1, s: 1, samp: 1, select: 1, slot: 1, small: 1, span: 1, strong: 1, sub: 1,
    sup: 1, svg: 1, template: 1, textarea: 1, time: 1, u: 1, tt: 1, "var": 1, wbr: 1
};

// HTML lets an element end because another one began. `<li>a<li>b` is two list items, not
// one nested in the other, and a formatter that reads it as nesting indents the whole rest
// of the list one level deeper for every item in it. Each entry lists what opening that tag
// closes, when that tag is what is currently open.
var IMPLIED_END = {
    li: { li: 1 },
    dt: { dt: 1, dd: 1 },
    dd: { dt: 1, dd: 1 },
    tr: { tr: 1, td: 1, th: 1 },
    td: { td: 1, th: 1 },
    th: { td: 1, th: 1 },
    option: { option: 1 },
    optgroup: { optgroup: 1, option: 1 },
    tbody: { thead: 1, tbody: 1, tr: 1, td: 1, th: 1 },
    tfoot: { thead: 1, tbody: 1, tr: 1, td: 1, th: 1 }
};

// A paragraph is closed by the next block-level thing, whatever it is. Kept separate from
// the table above because it is one rule about many tags rather than many about one.
var CLOSES_PARAGRAPH = {
    address: 1, article: 1, aside: 1, blockquote: 1, details: 1, div: 1, dl: 1,
    fieldset: 1, figcaption: 1, figure: 1, footer: 1, form: 1, h1: 1, h2: 1, h3: 1,
    h4: 1, h5: 1, h6: 1, header: 1, hgroup: 1, hr: 1, main: 1, menu: 1, nav: 1, ol: 1,
    p: 1, pre: 1, section: 1, table: 1, ul: 1
};

// Scratch for the tag reader. Returned through variables rather than in an object, because
// a document with 200,000 tags would otherwise allocate 200,000 of them for three fields.
var tagName = "";
var tagSelfClosing = false;
var tagPreserve = false;

// Reads from a `<` to just past the matching `>`, skipping quoted attribute values so a
// `>` inside one does not end the tag early. Returns the offset after the tag.
function readTag(text, i) {
    var len = text.length;
    var start = i;
    i++;                                                    // past "<"
    var closing = text.charCodeAt(i) === SLASH;
    if (closing) { i++; }

    var nameStart = i;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (isSpaceCode(code) || code === GT || code === SLASH) { break; }
        i++;
    }
    tagName = text.slice(nameStart, i).toLowerCase();
    tagSelfClosing = false;
    tagPreserve = false;

    while (i < len) {
        var here = text.charCodeAt(i);
        if (here === GT) { i++; break; }
        if (here === SLASH && text.charCodeAt(i + 1) === GT) {
            tagSelfClosing = true;
            i += 2;
            break;
        }
        if (here === QUOTE || here === APOS) {
            var close = text.indexOf(here === QUOTE ? '"' : "'", i + 1);
            // An attribute value with no closing quote: treat the rest as the tag rather
            // than running to the end of the document looking for one.
            if (close < 0) { i = len; break; }
            i = close + 1;
            continue;
        }
        // `xml:space="preserve"` is the document asking to be left alone. Matched on the
        // attribute name so `title="xml:space"` does not trip it.
        if (here === 120 && text.startsWith("xml:space", i)) {          // x
            var after = i + 9;
            while (after < len && isSpaceCode(text.charCodeAt(after))) { after++; }
            if (text.charCodeAt(after) === EQ) {
                var valueAt = after + 1;
                while (valueAt < len && isSpaceCode(text.charCodeAt(valueAt))) { valueAt++; }
                var quote = text.charCodeAt(valueAt);
                if (quote === QUOTE || quote === APOS) { valueAt++; }
                if (text.startsWith("preserve", valueAt)) { tagPreserve = true; }
            }
            i += 9;
            continue;
        }
        i++;
    }
    if (i > len) { i = len; }
    if (start === i) { i = start + 1; }                     // never stand still
    return i;
}

// Pass one. Fills the parallel arrays and works out, for every opening tag, where it closes
// and what it holds.
function scanMarkup(text, isHTML) {
    var len = text.length;
    var type = [], from = [], to = [], match = [], flags = [], names = [];
    // Where an element ends, as a character offset and as a token index. Separate from
    // `match` because an element can end without a closing tag at all — `<li>` displaced by
    // the next `<li>`, or a `<p>` ended by the `<div>` after it.
    var endOff = [], endTok = [];
    var count = 0;
    var stack = [];                 // token indices of tags still open
    var i = 0;

    // Whether whitespace has ever separated two children of the element on top of the
    // stack. Kept alongside the stack so `F_TIGHT` costs one flag write per whitespace run
    // rather than a second walk of the document at emit time.
    var sawGap = [];

    function note(kind) {
        if (stack.length === 0) { return; }
        flags[stack[stack.length - 1]] |= kind;
    }

    while (i < len) {
        var start = i;
        var code = text.charCodeAt(i);

        if (code !== LT) {
            // Text, run to the next "<".
            var stop = text.indexOf("<", i);
            if (stop < 0) { stop = len; }
            var blank = true;
            for (var scan = i; scan < stop; scan++) {
                if (!isSpaceCode(text.charCodeAt(scan))) { blank = false; break; }
            }
            type[count] = T_TEXT; from[count] = i; to[count] = stop;
            match[count] = blank ? 1 : 0;               // reused: 1 means whitespace only
            flags[count] = 0; names[count] = ""; endOff[count] = -1; endTok[count] = -1;
            count++;
            if (blank) {
                if (stack.length > 0) { sawGap[stack.length - 1] = true; }
            } else {
                note(F_TEXT);
            }
            i = stop;
            continue;
        }

        var next = text.charCodeAt(i + 1);

        // <!-- -->, <![CDATA[ ]]>, <!DOCTYPE >
        if (next === BANG) {
            var kind, end;
            if (text.startsWith("<!--", i)) {
                kind = T_COMMENT;
                end = text.indexOf("-->", i + 4);
                end = end < 0 ? len : end + 3;
            } else if (text.startsWith("<![CDATA[", i)) {
                kind = T_CDATA;
                end = text.indexOf("]]>", i + 9);
                end = end < 0 ? len : end + 3;
            } else {
                kind = T_DECL;
                // A doctype may carry an internal subset in brackets, which can hold ">".
                var bracket = text.indexOf("[", i);
                var gt = text.indexOf(">", i);
                if (bracket >= 0 && gt >= 0 && bracket < gt) {
                    var shut = text.indexOf("]", bracket);
                    gt = shut < 0 ? -1 : text.indexOf(">", shut);
                }
                end = gt < 0 ? len : gt + 1;
            }
            type[count] = kind; from[count] = i; to[count] = end;
            match[count] = -1; flags[count] = 0; names[count] = "";
            endOff[count] = -1; endTok[count] = -1;
            count++;
            note(F_ELEMENT);
            i = end;
            continue;
        }

        // <? ... ?>
        if (next === QUESTION) {
            var pi = text.indexOf("?>", i + 2);
            var piEnd = pi < 0 ? len : pi + 2;
            type[count] = T_PI; from[count] = i; to[count] = piEnd;
            match[count] = -1; flags[count] = 0; names[count] = "";
            endOff[count] = -1; endTok[count] = -1;
            count++;
            note(F_ELEMENT);
            i = piEnd;
            continue;
        }

        // A bare "<" in text — `a < b` in prose, which real documents contain. It is not a
        // tag unless a name follows it.
        var isName = (next >= 97 && next <= 122) || (next >= 65 && next <= 90)
                     || next === SLASH || next === 95 || next === COLON;
        if (!isName) {
            type[count] = T_TEXT; from[count] = i; to[count] = i + 1;
            match[count] = 0; flags[count] = 0; names[count] = "";
            endOff[count] = -1; endTok[count] = -1;
            count++;
            note(F_TEXT);
            i++;
            continue;
        }

        var tagEnd = readTag(text, i);
        var name = tagName;
        var selfClosed = tagSelfClosing;
        var preserve = tagPreserve;
        var isClosing = text.charCodeAt(i + 1) === SLASH;

        if (isClosing) {
            type[count] = T_CLOSE; from[count] = i; to[count] = tagEnd;
            match[count] = -1; flags[count] = 0; names[count] = name;
            endOff[count] = -1; endTok[count] = -1;
            var closeIndex = count;
            count++;
            // Tolerant: close the nearest open tag of this name and treat everything above
            // it as implicitly closed, which is what `<li>` without `</li>` needs. A close
            // tag matching nothing open is a stray and is emitted where it stands.
            for (var up = stack.length - 1; up >= 0; up--) {
                if (names[stack[up]] === name) {
                    var opener = stack[up];
                    // Everything still open above the match is closed by this tag too —
                    // the `<li>` that runs to its `</ul>`. Each ends where the closing tag
                    // begins, less the whitespace in front of it.
                    for (var above = stack.length - 1; above > up; above--) {
                        var stranded = stack[above];
                        var edge = i;
                        while (edge > from[stranded]
                               && isSpaceCode(text.charCodeAt(edge - 1))) { edge--; }
                        endOff[stranded] = edge;
                        endTok[stranded] = closeIndex - 1;
                    }
                    match[opener] = closeIndex;
                    match[closeIndex] = opener;
                    // Settled here rather than at emit time: this is the moment the
                    // element's children are all known and the flag is still to hand.
                    endTok[opener] = closeIndex;
                    endOff[opener] = to[closeIndex];
                    if (!sawGap[up]) { flags[opener] |= F_TIGHT; }
                    stack.length = up;
                    sawGap.length = up;
                    break;
                }
            }
            i = tagEnd;
            continue;
        }

        // An element that HTML lets this tag displace ends here, just before it. The end is
        // walked back over trailing whitespace so the copied-out slice does not carry the
        // blank line that separated the two items.
        if (isHTML) {
            while (stack.length > 0) {
                var openName = names[stack[stack.length - 1]];
                var byTag = IMPLIED_END[name];
                var displaces = (byTag !== undefined && byTag[openName] === 1)
                                || (openName === "p" && CLOSES_PARAGRAPH[name] === 1);
                if (!displaces) { break; }
                var displaced = stack[stack.length - 1];
                var back = i;
                while (back > from[displaced] && isSpaceCode(text.charCodeAt(back - 1))) {
                    back--;
                }
                endOff[displaced] = back;
                endTok[displaced] = count - 1;
                stack.length = stack.length - 1;
                sawGap.length = stack.length;
            }
        }

        var isVoid = selfClosed || (isHTML && VOID_ELEMENTS[name] === 1);
        type[count] = isVoid ? T_SELF : T_OPEN;
        from[count] = i; to[count] = tagEnd;
        match[count] = -1; endOff[count] = -1; endTok[count] = -1;
        flags[count] = preserve ? F_PRESERVE : 0;
        if (isHTML && PRESERVE_ELEMENTS[name] === 1) { flags[count] |= F_PRESERVE; }
        names[count] = name;
        var openIndex = count;
        count++;
        note(F_ELEMENT);

        if (isVoid) { i = tagEnd; continue; }

        // <script> and <style> hold something that is not markup. Take the whole of it as
        // one text token so nothing inside is read as a tag.
        if (isHTML && RAW_TEXT_ELEMENTS[name] === 1) {
            var closer = indexOfClosingTag(text, name, tagEnd);
            if (closer < 0) { closer = len; }
            if (closer > tagEnd) {
                type[count] = T_TEXT; from[count] = tagEnd; to[count] = closer;
                match[count] = 0; flags[count] = 0; names[count] = "";
                endOff[count] = -1; endTok[count] = -1;
                count++;
                flags[openIndex] |= F_TEXT;
            }
            flags[openIndex] |= F_PRESERVE;
            if (closer < len) {
                var rawEnd = readTag(text, closer);
                type[count] = T_CLOSE; from[count] = closer; to[count] = rawEnd;
                match[count] = openIndex; flags[count] = 0; names[count] = name;
                endOff[count] = -1; endTok[count] = -1;
                endTok[openIndex] = count;
                endOff[openIndex] = rawEnd;
                count++;
                i = rawEnd;
            } else {
                i = len;
            }
            continue;
        }

        stack[stack.length] = openIndex;
        sawGap[stack.length - 1] = false;
        i = tagEnd;
    }

    // Whatever is still open never closed. `match` stays -1, which pass two reads as "this
    // element has no end to copy", so it is emitted as an ordinary indented tag.
    return { type: type, from: from, to: to, match: match, flags: flags, names: names,
             endOff: endOff, endTok: endTok, count: count };
}

// Finds `</name` from `i`, skipping any that turn up inside a string in script content.
// Cheap and good enough: the character after the name must end the tag.
function indexOfClosingTag(text, name, i) {
    var needle = "</" + name;
    var len = text.length;
    while (i < len) {
        var at = text.indexOf(needle, i);
        if (at < 0) { return -1; }
        var afterAt = at + needle.length;
        if (afterAt >= len) { return at; }
        var after = text.charCodeAt(afterAt);
        if (after === GT || after === SLASH || isSpaceCode(after)) { return at; }
        i = at + needle.length;
    }
    return -1;
}

// Pass two. Walks the tokens and emits, indenting only what may be indented.
function formatMarkup(text, opt, isHTML, minify) {
    var doc = scanMarkup(text, isHTML);
    var type = doc.type, from = doc.from, to = doc.to, match = doc.match;
    var flags = doc.flags, names = doc.names, count = doc.count;
    var endOff = doc.endOff, endTok = doc.endTok;

    var out = new Out();
    var ind = new Indents(opt.unit, opt.newline);
    var depth = 0;
    var wrote = false;
    var sawMarkup = false;

    // Set after text that carries content is copied out, to keep the *next* token from
    // being given a line of its own. See the T_TEXT branch for why.
    var holdLead = false;

    // Whether this element must be copied out exactly as it stands. The three reasons are
    // different but the answer is the same, and none of them is a judgement call.
    function verbatim(index) {
        var flag = flags[index];
        if (endTok[index] < 0) { return false; }            // never ended; nothing to copy
        if ((flag & F_PRESERVE) !== 0) { return true; }
        if ((flag & F_TEXT) !== 0) { return true; }         // holds text: content, not layout
        // A run of inline elements written with no whitespace between them renders without
        // one. Breaking the line would put a space into the page that the author did not.
        if (isHTML && (flag & F_TIGHT) !== 0 && (flag & F_ELEMENT) !== 0
            && allChildrenInline(index)) {
            return true;
        }
        return false;
    }

    // Only the *direct* children matter: a block element nested inside an inline one still
    // makes the outer run breakable, because the break can go beside the block.
    function allChildrenInline(index) {
        var end = endTok[index];
        var childDepth = 0;
        for (var t = index + 1; t < end; t++) {
            var kind = type[t];
            if (childDepth === 0 && (kind === T_OPEN || kind === T_SELF)) {
                if (INLINE_ELEMENTS[names[t]] !== 1) { return false; }
            }
            if (kind === T_OPEN) { childDepth++; }
            else if (kind === T_CLOSE) { childDepth--; }
        }
        return true;
    }

    function onlyWhitespaceBetween(open, close) {
        for (var t = open + 1; t < close; t++) {
            if (type[t] !== T_TEXT || match[t] !== 1) { return false; }
        }
        return true;
    }

    function lead() {
        if (holdLead) { holdLead = false; wrote = true; return ""; }
        // `wrote` is set before the minify test, not after it: it is what says anything was
        // emitted at all, and minified output would otherwise always look empty.
        if (!wrote) { wrote = true; return ""; }
        if (minify) { return ""; }
        return ind.line(depth);
    }

    for (var i = 0; i < count; i++) {
        var kind = type[i];

        if (kind === T_TEXT) {
            // `match` doubles as the whitespace-only flag for a text token. Whitespace
            // between elements is the one thing here that is layout rather than content,
            // so it is the one thing dropped and rewritten.
            if (match[i] === 1) { continue; }

            // Text that carries content only reaches this branch when it has no properly
            // closed element around it — an orphan, or a document whose tags never matched.
            // Everywhere else it is inside a slice being copied out whole, because holding
            // text is exactly what makes an element verbatim.
            //
            // So it is emitted with no line of its own, and the token after it gets none
            // either. Anything else *inserts whitespace into content*: a newline put in
            // front of the text is read back as part of the text on the next run, which
            // grows another newline, and formatting twice stops matching formatting once.
            // The fuzz test checks for exactly that.
            wrote = true;
            out.add(text.slice(from[i], to[i]));
            holdLead = true;
            continue;
        }

        sawMarkup = true;

        if (kind === T_CLOSE) {
            depth--;
            if (depth < 0) { depth = 0; }                   // a stray close tag
            out.add(lead());
            out.add(text.slice(from[i], to[i]));
            continue;
        }

        if (kind === T_OPEN) {
            var end = endTok[i];

            // An element with no children at all stays on its line. Splitting `<div></div>`
            // across two lines adds an empty line to every placeholder in the document and
            // says nothing that the one line did not.
            //
            // "No children" has to mean *nothing between the two tags but whitespace*, not
            // merely no children the flags recorded. A stray `</b>` sets no flag, and the
            // first draft of this jumped straight over one and deleted it — which the fuzz
            // test caught and is the reason it counts characters rather than eyeballing
            // shapes.
            if (end > i && type[end] === T_CLOSE
                && (flags[i] & (F_TEXT | F_ELEMENT)) === 0
                && onlyWhitespaceBetween(i, end)) {
                out.add(lead());
                out.add(text.slice(from[i], to[i]));
                out.add(text.slice(from[end], to[end]));
                i = end;
                continue;
            }

            if (verbatim(i)) {
                out.add(lead());
                out.add(text.slice(from[i], endOff[i]));
                i = end > i ? end : i;
                continue;
            }
            out.add(lead());
            out.add(text.slice(from[i], to[i]));
            depth++;
            continue;
        }

        // T_SELF, T_COMMENT, T_CDATA, T_PI, T_DECL — one line each, wherever they stand.
        out.add(lead());
        out.add(text.slice(from[i], to[i]));
    }

    if (!sawMarkup) { refuse("Nothing to format — the document holds no markup.", 0); }
    return out.done();
}

// ---------------------------------------------------------------------------------------
// §4  CSS, SCSS and LESS
// ---------------------------------------------------------------------------------------
//
// Structure is rebuilt — one declaration a line, braces where braces belong, a blank line
// kept where the author left one — and inside a statement, **a run of whitespace collapses
// to a single space and nothing else moves.**
//
// That second half is the part worth stating, because the obvious convenience is a trap.
// A formatter that tidies `color : red` into `color: red` by deleting the space before the
// colon will, on the very next line, turn the selector `a :hover` into `a:hover` — and
// those select different elements. The descendant combinator is a space, so in a selector
// whitespace *is* a token. The one exception made here is a colon in something already
// known to be a declaration, which is settled at the end of the statement by whether it
// closed with `;` or with `{`: by then there is no guessing left to do.
//
// Strings, comments and the inside of `url(...)` are copied out untouched.

function formatCSS(text, opt) {
    var len = text.length;
    var out = new Out();
    var ind = new Indents(opt.unit, opt.newline);
    var depth = 0;
    var wrote = false;

    // The statement being gathered — a selector, an at-rule, or a declaration — as chunks
    // with their internal whitespace already collapsed.
    var buf = [];
    var bufN = 0;
    var pendingSpace = false;
    var parens = 0;
    var blankBefore = false;

    function bufEmpty() { return bufN === 0; }

    function add(chunk) {
        if (pendingSpace && bufN > 0) { buf[bufN++] = " "; }
        pendingSpace = false;
        buf[bufN++] = chunk;
    }

    function takeBuf() {
        buf.length = bufN;
        var joined = buf.join("");
        buf = [];
        bufN = 0;
        pendingSpace = false;
        return joined;
    }

    function newLine(at) {
        if (!wrote) { wrote = true; return ""; }
        if (blankBefore) { blankBefore = false; return opt.newline + ind.line(at); }
        return ind.line(at);
    }

    // A declaration's first colon, and only a declaration's. `a:hover` inside a selector is
    // never reached, because a selector is flushed by `{` rather than by `;`.
    function spaceAfterColon(statement) {
        var nesting = 0;
        for (var i = 0; i < statement.length; i++) {
            var code = statement.charCodeAt(i);
            if (code === OPEN_PAREN) { nesting++; }
            else if (code === CLOSE_PAREN) { nesting--; }
            else if (code === QUOTE || code === APOS) {
                var shut = statement.indexOf(statement.charAt(i), i + 1);
                if (shut < 0) { return statement; }
                i = shut;
            } else if (code === COLON && nesting === 0) {
                var after = i + 1;
                var before = i;
                while (before > 0 && statement.charCodeAt(before - 1) === SPACE) { before--; }
                while (statement.charCodeAt(after) === SPACE) { after++; }
                return statement.slice(0, before) + ": " + statement.slice(after);
            }
        }
        return statement;
    }

    // Selectors in a list go one to a line. Whitespace around a top-level comma in a
    // selector list is insignificant, which is what makes this safe; the same is not true
    // inside `:is(...)` or `@media`, so neither is touched.
    function breakSelectors(prelude, at) {
        if (prelude.charCodeAt(0) === AT) { return prelude; }
        var nesting = 0;
        var pieces = null;
        var start = 0;
        for (var i = 0; i < prelude.length; i++) {
            var code = prelude.charCodeAt(i);
            if (code === OPEN_PAREN || code === OPEN_BRACKET) { nesting++; }
            else if (code === CLOSE_PAREN || code === CLOSE_BRACKET) { nesting--; }
            else if (code === QUOTE || code === APOS) {
                var shut = prelude.indexOf(prelude.charAt(i), i + 1);
                if (shut < 0) { break; }
                i = shut;
            } else if (code === COMMA && nesting === 0) {
                if (pieces === null) { pieces = []; }
                // The space on either side of the comma goes: it is the one place in a
                // selector where whitespace means nothing, which is what licenses the break.
                var cut = i;
                while (cut > start && prelude.charCodeAt(cut - 1) === SPACE) { cut--; }
                pieces.push(prelude.slice(start, cut) + ",");
                start = i + 1;
                while (prelude.charCodeAt(start) === SPACE) { start++; }
            }
        }
        if (pieces === null) { return prelude; }
        pieces.push(prelude.slice(start));
        return pieces.join(ind.line(at));
    }

    function flushDeclaration(terminator) {
        var statement = takeBuf();
        if (statement.length === 0) { return; }
        out.add(newLine(depth));
        out.add(spaceAfterColon(statement));
        out.add(terminator);
    }

    var i = 0;
    while (i < len) {
        var code = text.charCodeAt(i);

        if (code === SPACE || code === TAB || code === LF || code === CR) {
            var breaks = 0;
            while (i < len) {
                var ws = text.charCodeAt(i);
                if (ws === LF) { breaks++; }
                else if (ws !== SPACE && ws !== TAB && ws !== CR) { break; }
                i++;
            }
            if (bufEmpty()) {
                // Between statements. Two line breaks is the author separating two things,
                // and that is worth keeping; more than two is not worth keeping more of.
                if (breaks >= 2 && wrote) { blankBefore = true; }
            } else {
                pendingSpace = true;
            }
            continue;
        }

        // Comments are content. Copied out whole, and given their own line when they stand
        // between statements rather than inside one.
        if (code === SLASH && text.charCodeAt(i + 1) === STAR) {
            var end = text.indexOf("*/", i + 2);
            end = end < 0 ? len : end + 2;
            if (bufEmpty()) {
                out.add(newLine(depth));
                out.add(text.slice(i, end));
            } else {
                add(text.slice(i, end));
            }
            i = end;
            continue;
        }

        // SCSS and LESS line comments.
        if (code === SLASH && text.charCodeAt(i + 1) === SLASH) {
            var lineEnd = endOfLineComment(text, i);
            if (bufEmpty()) {
                out.add(newLine(depth));
                out.add(text.slice(i, lineEnd));
            } else {
                add(text.slice(i, lineEnd));
            }
            i = lineEnd;
            continue;
        }

        if (code === QUOTE || code === APOS) {
            var quote = text.indexOf(text.charAt(i), i + 1);
            // An unterminated string would otherwise swallow the rest of the stylesheet.
            while (quote > 0 && text.charCodeAt(quote - 1) === BACKSLASH) {
                quote = text.indexOf(text.charAt(i), quote + 1);
            }
            if (quote < 0) { refuse("A string with no closing quote.", i); }
            add(text.slice(i, quote + 1));
            i = quote + 1;
            continue;
        }

        if (code === OPEN_BRACE) {
            var prelude = takeBuf();
            if (prelude.length === 0) {
                refuse("A \"{\" with no selector in front of it.", i);
            }
            out.add(newLine(depth));
            out.add(breakSelectors(prelude, depth));
            out.add(" {");
            depth++;
            blankBefore = false;
            i++;
            continue;
        }

        if (code === CLOSE_BRACE) {
            // A block whose last declaration has no semicolon is legal; give it one.
            flushDeclaration(";");
            depth--;
            if (depth < 0) { refuse("A \"}\" with no block open.", i); }
            out.add(newLine(depth));
            out.add("}");
            blankBefore = false;
            i++;
            continue;
        }

        if (code === SEMI && parens === 0) {
            flushDeclaration(";");
            i++;
            continue;
        }

        // Everything else is one run of statement text, taken whole. `url(...)` and
        // `calc(...)` come through here, and the paren count is what stops a `;` or a `}`
        // inside one being read as structure.
        var start = i;
        while (i < len) {
            var here = text.charCodeAt(i);
            if (here === SPACE || here === TAB || here === LF || here === CR) { break; }
            if (here === QUOTE || here === APOS) { break; }
            if (here === SLASH && (text.charCodeAt(i + 1) === STAR
                                   || text.charCodeAt(i + 1) === SLASH)) { break; }
            if (here === OPEN_PAREN) { parens++; }
            else if (here === CLOSE_PAREN) { if (parens > 0) { parens--; } }
            else if (parens === 0
                     && (here === OPEN_BRACE || here === CLOSE_BRACE || here === SEMI)) {
                break;
            }
            i++;
        }
        if (i === start) { i++; }                       // never stand still
        add(text.slice(start, i));
    }

    // Anything still gathered ran off the end of the file without its semicolon.
    flushDeclaration("");
    if (depth > 0) {
        refuse("The stylesheet ends with " + depth + " unclosed "
               + (depth === 1 ? "block" : "blocks") + ".", len);
    }
    if (!wrote) { refuse("Nothing to format — the document holds no CSS.", 0); }
    return out.done();
}

// ---------------------------------------------------------------------------------------
// §5  Reindent and Tidy — the whitespace half, for every language
// ---------------------------------------------------------------------------------------
//
// There is still no Format here that decides where a line wraps. That is black,
// swift-format, gofmt and prettier: they are programs, the plugin API has no call that runs
// one, and the App Store edition is sandboxed, so there would be nowhere for such a call to
// lead. What this section and §5b build instead are operations that are exactly definable
// and never move a token across a line boundary, so their names promise what they do and no
// more:
//
//   **Reindent** rewrites the leading whitespace of each line. For a bracket language it
//   comes from the bracket depth, the way Notepad++'s re-indent and Xcode's ⌃I work; for
//   Python it comes from the file's own indent stack, because there is nothing else it
//   could honestly come from. It never wraps and never reorders.
//
//   **Tidy** removes whitespace that does nothing: trailing spaces, runs of blank lines, a
//   missing or repeated final newline. It only ever *removes* whitespace, which is what
//   makes it safe to offer for every language in the editor.
//
// Both rest on one scan that answers, for every line: what construct is open at the start of
// it, how deep the brackets are, whether it sits inside a `switch`, and what its first
// non-blank character is. A line whose start is inside a string or a block comment is left
// alone by both — its leading whitespace is content, and stripping the trailing spaces from
// a line of a here-doc or a `"""` block changes the value of a string.

// Word characters, by code. `$` is one in JavaScript and Swift; anything past ASCII is
// taken to be one because every language here allows non-ASCII identifiers and none of
// them mean anything else by such a character outside a string.
function isWordStart(code) {
    return (code >= 97 && code <= 122) || (code >= 65 && code <= 90)
        || code === 95 || code === DOLLAR || code > 127;
}

function isWordPart(code) {
    return isWordStart(code) || (code >= 48 && code <= 57);
}

function isDigit(code) { return code >= 48 && code <= 57; }

// Compares a slice against a literal without cutting one. The scanners below ask this of
// almost every identifier in the document, and `text.slice(from, to) === "switch"` would
// allocate a string for each one.
function wordIs(text, from, to, word) {
    var n = word.length;
    if (to - from !== n) { return false; }
    for (var k = 0; k < n; k++) {
        if (text.charCodeAt(from + k) !== word.charCodeAt(k)) { return false; }
    }
    return true;
}

// The words after which a value has *not* just ended, per language.
//
// Two questions need this and they are the same question. In JavaScript, `/` after a value
// divides and `/` anywhere else opens a regex — `return /x/` is a pattern and `a / x` is a
// quotient. In Swift, `-` after a value subtracts and `-` anywhere else is a prefix minus,
// and Swift cares: `a - b` and `-b` are both legal, `a - b` written as `a -b` is not. The
// same list then decides where `if (x)` keeps its space and `f(x)` loses it, because a
// keyword takes an expression and a name takes an argument list.
//
// **Per language, rather than one list for all four.** A shared superset looked tempting
// and is wrong in both directions at once: `delete`, `new` and `repeat` are ordinary names
// in Swift — `old[head] == new[head]` and `case delete(old: Int)` are real lines from the
// editor's own source — while `of` is load-bearing in JavaScript's `for (x of ys)`.
//
// Value keywords are deliberately absent from every list. `this`, `self`, `super`, `true`,
// `false`, `null` and `nil` end a value like any identifier, and listing them would read
// `this / 2` as a regular expression. So are the declaration words that take a parameter
// list rather than an expression — Swift's `init` and `subscript` — and the access
// modifiers, because Swift writes `private(set)`.
var KEYWORD_SETS = {
    "swift": "if else while for do repeat switch case default break continue return throw "
        + "throws rethrows try catch guard defer in is as where let var func class struct "
        + "enum protocol extension import typealias inout",
    "java": "if else while for do switch case default break continue return throw throws "
        + "try catch finally new instanceof synchronized assert class interface extends "
        + "implements import package",
    // `import` is absent from these two on purpose: JavaScript's dynamic
    // `import('./x.js')` is a call expression, and a keyword here would push it apart.
    "javascript.js": "if else while for do switch case default break continue return throw "
        + "try catch finally new delete typeof instanceof void yield await async in of "
        + "function class extends export const let var",
    "typescript": "if else while for do switch case default break continue return throw "
        + "try catch finally new delete typeof instanceof void yield await async in of "
        + "function class extends implements export const let var interface"
};

// The host's own tokenizer pre-digests its keyword table the same way (`LanguageLexicon`):
// a word can only be a keyword if it is short enough and starts with the right character,
// and checking that first means the great majority of identifiers are never cut out of the
// document at all.
function compileKeywords(words) {
    var table = { map: {}, first: {}, max: 0 };
    if (words === undefined) { return table; }
    var list = words.split(" ");
    for (var n = 0; n < list.length; n++) {
        var word = list[n];
        table.map[word] = 1;
        table.first[word.charCodeAt(0)] = 1;
        if (word.length > table.max) { table.max = word.length; }
    }
    return table;
}

function isKeywordAt(text, from, to, table) {
    if (to - from > table.max || table.first[text.charCodeAt(from)] !== 1) { return false; }
    return table.map[text.slice(from, to)] === 1;
}

var S_CODE = 0, S_BLOCK = 1, S_TRIPLE_D = 2, S_TRIPLE_S = 3, S_RAW = 4;

// What spans a line, per language. Only the constructs that can *cross* a newline matter to
// either operation; a string that cannot reach the next line needs no state.
var SYNTAX = {
    "c":             { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 1 },
    "cpp":           { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 1 },
    "cs":            { slash: 1, block: 1, hash: 0, quotes: 1, triple: 1, raw: 0, braces: 1 },
    "java":          { slash: 1, block: 1, hash: 0, quotes: 1, triple: 1, raw: 0, braces: 1 },
    "javascript.js": { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 1, braces: 1 },
    "typescript":    { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 1, braces: 1 },
    "swift":         { slash: 1, block: 1, hash: 0, quotes: 1, triple: 1, raw: 0, braces: 1 },
    "kotlin":        { slash: 1, block: 1, hash: 0, quotes: 1, triple: 1, raw: 0, braces: 1 },
    "go":            { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 1, braces: 1 },
    "rust":          { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 1 },
    "php":           { slash: 1, block: 1, hash: 1, quotes: 1, triple: 0, raw: 0, braces: 1 },
    "css":           { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 1 },
    "json":          { slash: 0, block: 0, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 1 },
    "python":        { slash: 0, block: 0, hash: 1, quotes: 1, triple: 1, raw: 0, braces: 1 },
    "ruby":          { slash: 0, block: 0, hash: 1, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "bash":          { slash: 0, block: 0, hash: 1, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "yaml":          { slash: 0, block: 0, hash: 1, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "sql":           { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "xml":           { slash: 0, block: 0, hash: 0, quotes: 0, triple: 0, raw: 0, braces: 0 },
    "html":          { slash: 0, block: 0, hash: 0, quotes: 0, triple: 0, raw: 0, braces: 0 }
};

// The second half of the same table, kept apart because it is about *code* rather than
// about what crosses a newline, and because only a handful of languages set any of it.
//
//   `words`      identifiers are read as words rather than character by character — which
//                is what makes the three facts below knowable, and is faster besides.
//   `regex`      `/` in a position where no value has just ended opens a pattern.
//   `rawHash`    Swift's `#"…"#`, where the delimiter is the quote plus its hashes.
//   `apos`       `'` opens a string. Swift is the exception: it has no such literal, so a
//                stray apostrophe there must not swallow the rest of the line.
//   `tick`       a backtick quotes an identifier (Swift's `` `default` ``) rather than
//                opening a template literal.
//   `caseStyle`  1 puts `case` at the `switch`'s own level, which is Swift and Xcode;
//                2 puts it one level in and its body one further, which is everyone else.
//   `chain`      a line starting with `.` continues the line above it.
var CODE_FACTS = {
    "c":             { words: 1, caseStyle: 2 },
    "cpp":           { words: 1, caseStyle: 2, chain: 1 },
    "cs":            { words: 1, caseStyle: 2, chain: 1 },
    "java":          { words: 1, caseStyle: 2, chain: 1 },
    "javascript.js": { words: 1, caseStyle: 2, chain: 1, regex: 1 },
    "typescript":    { words: 1, caseStyle: 2, chain: 1, regex: 1 },
    "swift":         { words: 1, caseStyle: 1, chain: 1, rawHash: 1, apos: 0, tick: 1 },
    "kotlin":        { words: 1, caseStyle: 0, chain: 1 },
    "go":            { words: 1, caseStyle: 2, chain: 1 },
    "rust":          { words: 1, caseStyle: 0, chain: 1 },
    "php":           { words: 1, caseStyle: 2, chain: 1 },
    "python":        { words: 1 }
};

// Every entry ends up the same shape, filled in once at load. A scanner that meets one
// hidden class for `syn` is the one that stays fast; an object that gained a property
// halfway through the table would not be that.
(function () {
    var extras = ["words", "regex", "rawHash", "caseStyle", "chain", "tick"];
    for (var id in SYNTAX) {
        if (!Object.prototype.hasOwnProperty.call(SYNTAX, id)) { continue; }
        var syn = SYNTAX[id];
        var facts = CODE_FACTS[id];
        for (var n = 0; n < extras.length; n++) {
            var name = extras[n];
            syn[name] = facts !== undefined && facts[name] !== undefined ? facts[name] : 0;
        }
        syn.apos = facts !== undefined && facts.apos !== undefined ? facts.apos : 1;
        syn.keywords = compileKeywords(KEYWORD_SETS[id]);
    }
}());

// A file the editor could not place. Nothing is assumed to span a line, which makes Tidy
// behave as a plain whitespace pass — the only safe reading when the grammar is unknown.
var SYNTAX_PLAIN = { slash: 0, block: 0, hash: 0, quotes: 0, triple: 0, raw: 0, braces: 0,
                     words: 0, regex: 0, rawHash: 0, caseStyle: 0, chain: 0, tick: 0,
                     apos: 1, keywords: compileKeywords() };

function syntaxFor(languageID) {
    var found = SYNTAX[languageID];
    return found === undefined ? SYNTAX_PLAIN : found;
}

// The end of a regular expression literal, or `-1` when it does not close on this line.
//
// A pattern cannot span a newline, so failing to close on the line is proof this `/` was
// not one — which is the backstop that keeps a mistaken guess from swallowing the rest of
// the file. `[` opens a character class, and `/` inside one is an ordinary character.
function endOfRegex(text, i, len) {
    i++;
    var inClass = false;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code === LF || code === CR) { return -1; }
        if (code === BACKSLASH) { i += 2; continue; }
        if (inClass) {
            if (code === CLOSE_BRACKET) { inClass = false; }
            i++;
            continue;
        }
        if (code === OPEN_BRACKET) { inClass = true; i++; continue; }
        if (code === SLASH) {
            i++;
            while (i < len && isWordPart(text.charCodeAt(i))) { i++; }   // the flags
            return i;
        }
        i++;
    }
    return -1;
}

// One pass. Per line: the offset it starts at, the offset its text ends at (before any CR
// or LF, so the file's own line endings survive untouched), what was open at its start, the
// bracket depth at its start, its first non-blank character, and — for a language with a
// `switch` worth indenting — how many `switch` bodies enclose it and whether the innermost
// brace is one.
//
// **Indentation is counted per line, not per bracket.** `defineConfig({` opens two and
// means one: every editor indents its body a single level, and a scan that counted both
// would bring a two-space file back at eight — which is the shape of nearly every
// JavaScript config file there is. So a bracket opened on a line that already has one open
// gives the same level as that one, and the level a line gets is the level of the bracket
// it sits inside. A line *starting* with a closer gets the level of the line its bracket
// was opened on, which is the same rule read from the other end and replaces the older
// "take one off for a leading `}`".
//
// This is the pass Tidy runs on every file in the editor, so it is written to be cheap
// rather than to be exact: the character classes are spelt out inline rather than called,
// the language's facts are pulled into locals before the loop, and a word is read as a word
// because skipping one is faster than stepping through it. What it does *not* do is decide
// what a token means — that is §5b's tokenizer, which costs more and is asked only by
// Format. The one thing it has to get right is what crosses a line, and `tests/fuzz-code.js`
// checks the two against each other.
function scanLines(text, syn) {
    var len = text.length;
    var start = [], stop = [], state = [], depth = [], first = [], level = [];
    var swInfo = syn.caseStyle > 0 ? [] : null;
    var lines = 0;
    var s = S_CODE;
    var d = 0;
    var h = 0;                  // the `#` count a Swift raw string must be closed with
    var i = 0;
    var frames = [];            // one entry per open `{`: 1 when a `switch` opened it
    var switches = 0;           // how many of those are switch frames
    var pendingSwitch = 0;      // a `switch` has been read; the next `{` is its body
    var value = 0;              // 1 when the token just read could end a value
    var wordFrom = 0, wordTo = 0;   // the last word, for the one question that needs it
    // One entry per open bracket of any kind: the level its contents take, the level its
    // closing line takes, and the line it was opened on.
    var bInner = [], bOuter = [], bLine = [];
    var bTop = -1;
    var lineLevel = 0;
    // The level *partway along* the line, which is not the level the line is drawn at once
    // a bracket has closed on it. `if (a\n && b) {` opens its body after the condition's
    // `)` has gone, so the body is one level from the `if` and not one from the condition.
    var current = 0;

    var slash = syn.slash, block = syn.block, hash = syn.hash, quotes = syn.quotes;
    var triple = syn.triple, raw = syn.raw, braces = syn.braces, words = syn.words;
    var regex = syn.regex, rawHash = syn.rawHash, apos = syn.apos, tick = syn.tick;
    var tracksSwitch = syn.caseStyle > 0;
    var keywords = syn.keywords;

    for (;;) {
        start[lines] = i;
        state[lines] = s;
        depth[lines] = d;
        if (swInfo !== null) {
            swInfo[lines] = switches * 2
                + (frames.length > 0 && frames[frames.length - 1] === 1 ? 1 : 0);
        }
        var firstCode = 0;
        lineLevel = bTop >= 0 ? bInner[bTop] : 0;
        current = lineLevel;

        while (i < len) {
            var code = text.charCodeAt(i);
            if (code === LF) { break; }

            if (firstCode === 0 && code !== SPACE && code !== TAB && code !== CR) {
                firstCode = code;
                if (bTop >= 0 && (code === CLOSE_BRACE || code === CLOSE_BRACKET
                                  || code === CLOSE_PAREN)) {
                    lineLevel = bOuter[bTop];
                    current = lineLevel;
                }
            }

            if (s === S_BLOCK) {
                if (code === STAR && text.charCodeAt(i + 1) === SLASH) { s = S_CODE; i += 2; }
                else { i++; }
                continue;
            }
            if (s === S_TRIPLE_D || s === S_TRIPLE_S) {
                var mark = s === S_TRIPLE_D ? QUOTE : APOS;
                if (code === BACKSLASH && h === 0) { i += 2; continue; }
                if (code === mark && text.charCodeAt(i + 1) === mark
                    && text.charCodeAt(i + 2) === mark && closingHashes(text, i + 3, h)) {
                    s = S_CODE; i += 3 + h; h = 0; value = 1;
                } else { i++; }
                continue;
            }
            if (s === S_RAW) {
                if (code === BACKSLASH) { i += 2; continue; }
                if (code === BACKTICK) { s = S_CODE; i++; value = 1; }
                else { i++; }
                continue;
            }

            // S_CODE. A word first, because in code most characters are one.
            if (words === 1 && ((code >= 97 && code <= 122) || (code >= 65 && code <= 90)
                                || code === 95 || code === DOLLAR || code > 127)) {
                wordFrom = i;
                i++;
                while (i < len) {
                    var wc = text.charCodeAt(i);
                    if ((wc >= 97 && wc <= 122) || (wc >= 65 && wc <= 90)
                        || (wc >= 48 && wc <= 57) || wc === 95 || wc === DOLLAR
                        || wc > 127) { i++; continue; }
                    break;
                }
                wordTo = i;
                if (tracksSwitch && code === 115 && wordIs(text, wordFrom, i, "switch")) {
                    pendingSwitch = 1;
                }
                value = 2;                  // a value, and the last token was a word
                continue;
            }
            if (slash === 1 && code === SLASH) {
                var after = text.charCodeAt(i + 1);
                if (after === SLASH) { break; }                 // rest of the line
                if (block === 1 && after === STAR) { s = S_BLOCK; i += 2; continue; }
                // The one question a keyword is asked, and the reason the word above was
                // remembered rather than classified: `return /x/` is a pattern and `a / x`
                // is a quotient, and patterns are rare enough that cutting every identifier
                // out of the document to find out would be paying for this everywhere.
                if (regex === 1 && (value === 0
                        || (value === 2 && isKeywordAt(text, wordFrom, wordTo, keywords)))) {
                    var closed = endOfRegex(text, i, len);
                    if (closed > 0) { i = closed; value = 1; continue; }
                }
                value = 0;
                i++;
                continue;
            }
            if (hash === 1 && code === HASH) { break; }         // rest of the line
            if (rawHash === 1 && code === HASH) {
                var opened = openingHashes(text, i);
                if (opened > 0) {
                    h = opened;
                    i += opened;
                    if (text.charCodeAt(i + 1) === QUOTE && text.charCodeAt(i + 2) === QUOTE) {
                        s = S_TRIPLE_D;
                        i += 3;
                    } else {
                        i = endOfSimpleString(text, i, len, QUOTE, h);
                        h = 0;
                        value = 1;
                    }
                    continue;
                }
                value = 0;
                i++;
                continue;
            }
            if (raw === 1 && code === BACKTICK) { s = S_RAW; i++; continue; }
            if (tick === 1 && code === BACKTICK) {
                i++;
                while (i < len && text.charCodeAt(i) !== BACKTICK
                       && text.charCodeAt(i) !== LF) { i++; }
                if (i < len && text.charCodeAt(i) === BACKTICK) { i++; }
                value = 1;
                continue;
            }
            if (quotes === 1 && (code === QUOTE || (code === APOS && apos === 1))) {
                if (triple === 1 && text.charCodeAt(i + 1) === code
                    && text.charCodeAt(i + 2) === code) {
                    s = code === QUOTE ? S_TRIPLE_D : S_TRIPLE_S;
                    h = 0;
                    i += 3;
                    continue;
                }
                // A string that cannot reach the next line. An unclosed one ends at the
                // line break, which is what an editor shows and what a compiler reports.
                i = endOfSimpleString(text, i, len, code, 0);
                value = 1;
                continue;
            }
            if (braces === 1) {
                if (code === OPEN_BRACE || code === OPEN_BRACKET || code === OPEN_PAREN) {
                    var sameLine = bTop >= 0 && bLine[bTop] === lines;
                    var inner = sameLine ? bInner[bTop] : current + 1;
                    var outer = sameLine ? bOuter[bTop] : current;
                    bTop++;
                    bInner[bTop] = inner;
                    bOuter[bTop] = outer;
                    bLine[bTop] = lines;
                    if (code === OPEN_BRACE) {
                        frames[frames.length] = pendingSwitch;
                        if (pendingSwitch === 1) { switches++; }
                        pendingSwitch = 0;
                    }
                    d++;
                    value = 0;
                    i++;
                    continue;
                }
                if (code === CLOSE_BRACE || code === CLOSE_BRACKET
                    || code === CLOSE_PAREN) {
                    if (bTop >= 0) { current = bOuter[bTop]; bTop--; }
                    if (code === CLOSE_BRACE && frames.length > 0) {
                        if (frames[frames.length - 1] === 1) { switches--; }
                        frames.length = frames.length - 1;
                    }
                    d--; if (d < 0) { d = 0; }
                    value = code === CLOSE_BRACE ? 0 : 1;
                    i++;
                    continue;
                }
            }
            if (code === SEMI) { pendingSwitch = 0; }
            // A digit is left to fall through: the only thing a number has to settle here
            // is that a value ended at it, and the rest of `0x1f` or `1.5e-3` is read as a
            // word and a dot and lands on the same answer.
            if (code >= 48 && code <= 57) { value = 1; }
            else if (code !== SPACE && code !== TAB && code !== CR) { value = 0; }
            i++;
        }

        // Past a line comment, if that is what stopped the inner loop, to the line's end.
        while (i < len && text.charCodeAt(i) !== LF) { i++; }

        var end = i;
        if (end > start[lines] && text.charCodeAt(end - 1) === CR) { end--; }
        stop[lines] = end;
        first[lines] = firstCode;
        level[lines] = lineLevel;
        lines++;

        if (i >= len) { break; }
        i++;                                                    // past the LF
    }

    return { start: start, stop: stop, state: state, depth: depth, first: first,
             level: level, swInfo: swInfo, count: lines };
}

// A Swift raw string opens with one or more `#` and a quote, and closes with the quote and
// exactly as many again — which is the whole point of it, since `"#` inside is then text.
function openingHashes(text, i) {
    var n = 0;
    while (text.charCodeAt(i + n) === HASH) { n++; }
    return n > 0 && text.charCodeAt(i + n) === QUOTE ? n : 0;
}

function closingHashes(text, i, want) {
    for (var n = 0; n < want; n++) {
        if (text.charCodeAt(i + n) !== HASH) { return false; }
    }
    return true;
}

// Past a one-line string. `want` is the raw string's hash count: zero for an ordinary
// literal, in which case a backslash escapes and the closing quote is the bare one.
//
// `strict` is the difference between the two callers. Reindent and Tidy take the line break
// as the end of an unclosed string, which is what the editor draws and what a compiler
// reports, and carry on scanning the file; Format refuses it, because a file with a string
// open at the end of a line is one whose tokens it cannot be sure of.
function endOfSimpleString(text, i, len, mark, want, strict) {
    var from = i;
    i++;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code === LF) { break; }
        if (code === BACKSLASH && want === 0) { i += 2; continue; }
        if (code === mark && closingHashes(text, i + 1, want)) { return i + 1 + want; }
        i++;
    }
    if (strict === true) { refuse("A string opened here is never closed.", from); }
    return i;
}

// Past a numeric literal, in any of the spellings these languages allow: `0x1F`, `1_000`,
// `1.5e-3`, `0b1010`, `10L`, `1.0f`. The dot is taken only when a digit follows it, so
// Swift's `0..<5` is a number, a range operator and a number rather than one long mistake.
function endOfCodeNumber(text, i, len) {
    i++;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (isWordPart(code)) {
            var isExponent = code === 101 || code === 69 || code === 112 || code === 80;
            i++;
            if (isExponent) {
                var sign = text.charCodeAt(i);
                if (sign === PLUS || sign === MINUS) { i++; }
            }
            continue;
        }
        if (code === DOT && isDigit(text.charCodeAt(i + 1))) { i += 2; continue; }
        break;
    }
    return i;
}

// Which languages have a bracket depth worth indenting from — plus Python, which is routed
// to a different algorithm entirely rather than to this one.
var REINDENTABLE = {
    "c": 1, "cpp": 1, "cs": 1, "java": 1, "javascript.js": 1, "typescript": 1, "swift": 1,
    "kotlin": 1, "go": 1, "rust": 1, "php": 1, "css": 1, "json": 1, "python": 1
};

// A `case` or `default` opening a line. Only asked inside a `switch` body, which is what
// keeps it away from Swift's `enum E { case a }` and from a variable that happens to be
// called `defaults`.
function isCaseLabel(text, from, to) {
    if (to - from >= 4 && wordIs(text, from, from + 4, "case")
        && !isWordPart(text.charCodeAt(from + 4))) {
        return true;
    }
    return to - from >= 7 && wordIs(text, from, from + 7, "default")
        && !isWordPart(text.charCodeAt(from + 7));
}

// Does this line begin with something that cannot begin a statement? `&` and `|` count
// only doubled, and `-` only as `->`: on their own they are Swift's inout marker and C++'s
// pointer arithmetic, and a line may legitimately start with either. `*` is left out for
// the same reason — `*p = 1;` is a statement.
function isContinuationHead(text, from, to) {
    var head = text.charCodeAt(from);
    if (head === QUESTION || head === COLON || head === COMMA || head === PLUS
        || head === EQ || head === PERCENT) { return true; }
    var next = from + 1 < to ? text.charCodeAt(from + 1) : 0;
    if (head === AMP || head === PIPE) { return next === head; }
    if (head === MINUS) { return next === GT; }
    return false;
}

function reindent(text, languageID, opt) {
    if (languageID === "python") { return reindentPython(text, opt); }
    if (REINDENTABLE[languageID] !== 1) {
        var unknown = SYNTAX[languageID];
        refuse("Reindent needs a language whose blocks are brackets. This one is "
               + (unknown === undefined ? "not one the editor knows" : "not written that way")
               + ".", -1);
    }

    var syn = syntaxFor(languageID);
    var lines = scanLines(text, syn);
    var ind = new Indents(opt.unit, opt.newline);
    var out = new Out();
    var prevLevel = 0;
    var prevHead = 0;
    var prevCarried = false;

    for (var n = 0; n < lines.count; n++) {
        var from = lines.start[n];
        var to = lines.stop[n];

        if (n > 0) {
            // The line's own ending, copied rather than chosen: a CRLF file stays a CRLF
            // file, and a last line with no ending gains none.
            out.add(text.slice(lines.stop[n - 1], from));
        }

        // Inside a string or a block comment this line's leading whitespace is content.
        if (lines.state[n] !== S_CODE) {
            out.add(text.slice(from, to));
            continue;
        }
        if (lines.first[n] === 0) { continue; }                 // blank; emit nothing

        var body = from;
        while (body < to) {
            var lead = text.charCodeAt(body);
            if (lead !== SPACE && lead !== TAB) { break; }
            body++;
        }

        var head = lines.first[n];
        var closer = head === CLOSE_BRACE || head === CLOSE_BRACKET || head === CLOSE_PAREN;
        var level = lines.level[n];

        // A `switch` body is the one place bracket depth is not the whole answer, and the
        // two conventions differ by which half of the pair moves. Swift and Xcode leave the
        // body where the brackets put it and pull the labels out to the `switch`; C, Java,
        // JavaScript and TypeScript leave the labels one level in and push the body past
        // them. Both are "one level between the label and its statements" — written from
        // opposite ends.
        if (syn.caseStyle > 0) {
            var info = lines.swInfo[n];
            var topIsSwitch = (info & 1) === 1;
            if (syn.caseStyle === 2) {
                level += info >> 1;                             // one per enclosing switch
                if (closer && head === CLOSE_BRACE && topIsSwitch) { level--; }
            }
            if (!closer && topIsSwitch && isCaseLabel(text, body, to)) { level--; }
        }
        if (level < 0) { level = 0; }

        // A line that starts with `.` — or with any other operator that cannot begin a
        // statement — is the rest of the line above it: a SwiftUI modifier, a stream, a
        // promise chain, the second half of a wrapped condition, the `: otherwise` of a
        // ternary. The brackets say nothing about any of them, because none of them opened
        // one. It goes one level in from whatever began the run and stays there for the
        // rest of it; a run hanging off a closing bracket keeps that bracket's level, which
        // is what `}` followed by `.padding()` wants.
        //
        // A comment in the middle of a chain is not a link in it and must not be read as
        // one — `}`, four lines saying why, and then `.overlay(...)` is ordinary SwiftUI,
        // and treating the comment as what the chain hangs off would step every modifier
        // under it one level in. So a comment line is passed over here, and takes the
        // chain's own level when there is a chain in progress to take.
        var comment = head === SLASH
            && (text.charCodeAt(body + 1) === SLASH || text.charCodeAt(body + 1) === STAR);
        var carries = head === DOT || isContinuationHead(text, body, to);
        if (syn.chain === 1 && (carries || comment) && prevHead !== 0) {
            var chain = prevCarried || prevHead === CLOSE_BRACE
                || prevHead === CLOSE_BRACKET || prevHead === CLOSE_PAREN
                ? prevLevel : prevLevel + 1;
            if (comment) { chain = prevCarried ? prevLevel : level; }
            if (chain > level) { level = chain; }
        }

        out.add(ind.at(level));
        out.add(text.slice(body, to));
        if (!comment) {
            prevLevel = level;
            prevHead = head;
            prevCarried = carries;
        }
    }
    return out.done();
}

// ---------------------------------------------------------------------------------------
//
// Python. Its indentation *is* its block structure, so there is nothing to recompute it
// from — which is why this is a different algorithm rather than a flag on the one above.
// What it can do is restate the structure the file already has in the unit that was asked
// for: read the indent stack the way Python reads it, and re-emit each statement at the
// depth that stack puts it on. Three spaces become four, tabs become spaces, an over-
// indented block comes back in line, and no statement changes which block it is in.
//
// Two things are deliberately not touched. A **continuation line** — inside brackets, or
// after a `\` — is shifted by the same number of columns as the statement it belongs to,
// never re-indented: its whitespace is usually alignment to a column, and rebuilding it
// from a depth would destroy that. A **comment on its own line** is put at the depth of the
// nearest enclosing block it fits in, without touching the stack, because a comment is
// allowed at any indentation and must not be read as a dedent.
//
// It refuses two files rather than guess at them. One that dedents to a column no
// enclosing block is on is what Python itself calls an IndentationError. One whose
// indentation means different things depending on whether a tab is one column or eight is
// a TabError, and comparing under both readings is how CPython decides that too.
function reindentPython(text, opt) {
    var lines = scanLines(text, syntaxFor("python"));
    var ind = new Indents(opt.unit, opt.newline);
    var out = new Out();
    var unitColumns = opt.unit === "\t" ? 8 : opt.unit.length;

    var stack1 = [0], stack8 = [0];
    var delta = 0;              // columns the statement in hand moved, for its continuations
    var continued = false;      // the line before ended with a backslash

    // A comment is held back until the statement below it has been placed, because that is
    // the statement it is about — and because the stack cannot answer for it yet. `# note`
    // sitting above the first line of a block is indented like that line, and the block it
    // opens has not been pushed at the moment the comment is read.
    var held = [];

    // The deepest block this column could belong to, for a comment that is indented past
    // the statement below it — a note at the end of a body, above the line that leaves it.
    function nearestFitting(width) {
        var at = stack8.length - 1;
        while (at > 0 && stack8[at] > width) { at--; }
        return at;
    }

    // `width` of -1 means there is no statement below: every held comment falls back to the
    // block it fits in.
    function release(depth, width) {
        for (var k = 0; k < held.length; k++) {
            var rec = held[k];
            out.add(rec.lead);
            if (rec.to === 0) { continue; }                     // a blank line
            out.add(ind.at(rec.width > width ? rec.nearest : depth));
            out.add(text.slice(rec.from, rec.to));
        }
        held.length = 0;
    }

    for (var n = 0; n < lines.count; n++) {
        var from = lines.start[n];
        var to = lines.stop[n];
        var lead = n > 0 ? text.slice(lines.stop[n - 1], from) : "";

        if (lines.state[n] !== S_CODE) {                        // inside a `"""` block
            release(-1, -1);
            out.add(lead);
            out.add(text.slice(from, to));
            continued = false;
            continue;
        }
        if (lines.first[n] === 0) {                             // blank; emit no body
            if (held.length > 0) {
                held[held.length] = { lead: lead, from: 0, to: 0, width: 0, nearest: 0 };
            } else {
                out.add(lead);
            }
            continue;
        }

        var body = from;
        var wide1 = 0, wide8 = 0;
        while (body < to) {
            var ch = text.charCodeAt(body);
            if (ch === SPACE) { wide1++; wide8++; }
            else if (ch === TAB) { wide1++; wide8 = (Math.floor(wide8 / 8) + 1) * 8; }
            else { break; }
            body++;
        }

        var isContinuation = lines.depth[n] > 0 || continued;
        continued = text.charCodeAt(to - 1) === BACKSLASH;

        if (isContinuation) {
            // Shifted with its statement, or left exactly as it was when the statement did
            // not move. Spaces, because the shift is a column count and a tab is only a
            // column count by convention.
            release(-1, -1);
            out.add(lead);
            if (delta === 0) {
                out.add(text.slice(from, to));
            } else {
                out.add(spaces(wide8 + delta > 0 ? wide8 + delta : 0));
                out.add(text.slice(body, to));
            }
            continue;
        }

        if (lines.first[n] === HASH) {
            held[held.length] = { lead: lead, from: body, to: to, width: wide8,
                                  nearest: nearestFitting(wide8) };
            continue;
        }

        var top = stack8.length - 1;
        if (wide8 > stack8[top]) {
            if (wide1 <= stack1[top]) {
                refuse("This line's indentation means one thing if a tab is one column and "
                       + "another if it is eight, so there is no safe way to read it.", body);
            }
            stack8[stack8.length] = wide8;
            stack1[stack1.length] = wide1;
        } else {
            while (stack8.length > 1 && wide8 < stack8[stack8.length - 1]) {
                stack8.length = stack8.length - 1;
                stack1.length = stack1.length - 1;
            }
            if (wide8 !== stack8[stack8.length - 1]) {
                refuse("This line is indented less than the block it is in, but not out to "
                       + "any block around it — Python reads that as an error too.", body);
            }
            if (wide1 !== stack1[stack1.length - 1]) {
                refuse("This line's indentation means one thing if a tab is one column and "
                       + "another if it is eight, so there is no safe way to read it.", body);
            }
        }

        var depth = stack8.length - 1;
        delta = depth * unitColumns - wide8;
        release(depth, wide8);
        out.add(lead);
        out.add(ind.at(depth));
        out.add(text.slice(body, to));
    }
    release(-1, -1);
    return out.done();
}

function spaces(n) {
    var out = "";
    for (var i = 0; i < n; i++) { out += " "; }
    return out;
}

// Tidy. Only ever removes whitespace — which is what lets it run on any file the editor can
// open, including one whose language it has never heard of.
//
// A kept line carries its own line ending and a dropped line takes its ending with it, so a
// CRLF file stays CRLF, a mixed file keeps whatever each surviving line had, and nothing
// here has to decide what a line ending ought to be.
function tidy(text, languageID) {
    var lines = scanLines(text, syntaxFor(languageID));
    var out = new Out();
    var limit = blankLineLimit();
    var isMarkdown = languageID === "markdown";

    function isBlank(n) { return lines.first[n] === 0 && lines.state[n] === S_CODE; }

    function endingAfter(n) {
        return n + 1 < lines.count ? text.slice(lines.stop[n], lines.start[n + 1]) : "";
    }

    // Safe to strip the end of this line only if the line is in ordinary code at both ends.
    // Starting in code is not enough: `var s = \`a   ` *opens* a template literal, so the
    // spaces before the line break are already inside the string. Stripping them there
    // changes the value of a variable, which is the one thing Tidy promises never to do.
    function trimmable(n) {
        if (lines.state[n] !== S_CODE) { return false; }
        return n + 1 >= lines.count || lines.state[n + 1] === S_CODE;
    }

    function bodyOf(n) {
        var from = lines.start[n];
        var to = lines.stop[n];
        if (!settings.trimTrailing || !trimmable(n)) {
            return text.slice(from, to);
        }
        var end = to;
        while (end > from) {
            var code = text.charCodeAt(end - 1);
            if (code !== SPACE && code !== TAB) { break; }
            end--;
        }
        if (end === to) { return text.slice(from, to); }
        // Two spaces ending a Markdown line is a hard line break — the one place trailing
        // whitespace is content. It is put back, at exactly two, on a line with something
        // on it; a blank line keeps nothing, because there is no break to make there.
        if (isMarkdown && end > from && (to - end) >= 2) {
            return text.slice(from, end) + "  ";
        }
        return text.slice(from, end);
    }

    // Where the content ends. Trailing blank lines go entirely rather than being collapsed:
    // one blank line at the end of a file is the final newline, which is settled below.
    var last = -1;
    for (var back = lines.count - 1; back >= 0; back--) {
        if (!isBlank(back)) { last = back; break; }
    }
    if (last < 0) { return ""; }

    var blanks = 0;
    for (var n = 0; n <= last; n++) {
        if (isBlank(n)) {
            blanks++;
            if (settings.collapseBlanks && blanks > limit) { continue; }
        } else {
            blanks = 0;
        }
        out.add(bodyOf(n));
        out.add(endingAfter(n));
    }

    var result = out.done();
    // A missing final newline is added when asked for. One that is there is never taken
    // away: removing an ending nobody asked about is a change Tidy did not advertise.
    if (settings.finalNewline && !endedWithNewline(result)) {
        result += newlineOf(text);
    }
    return result;
}

// ---------------------------------------------------------------------------------------
// §5b  Spacing, for Swift, Java, JavaScript and TypeScript
// ---------------------------------------------------------------------------------------
//
// **Format Document** for these four is Reindent plus this: the whitespace *between* two
// tokens on a line, rewritten from the pair itself. It never breaks a line, never joins
// two, never moves a token past another, and never reads a token as anything but the token
// it is. What it changes is `f(a ,b)` into `f(a, b)` and `x=1` into `x = 1`.
//
// The rule it is built around is the one the CSS formatter is built around, for the same
// reason: **a run of whitespace collapses to a single space, and nothing else moves —
// except where the two tokens either side settle the question between them.** Two lists
// settle it, and everything outside them is left as written. That is why `a<b` comes back
// as `a<b` while `a=b` comes back as `a = b`.
//
// **An operator is spaced only where it is infix.** Swift is why. `a - b` and `-b` are both
// Swift; `a -b` is not, because an operator with whitespace on one side only is read as a
// prefix or postfix one. So putting a space around every `-` would turn `let y = -x` into
// something that does not compile. An operator is infix when a value has just ended — an
// identifier, a number, a string, a `)` or a `]` — and prefix otherwise, which is also how
// the scanner tells `str.replace(/}/g, "")` from `a / b`. The two questions have one
// answer, and `KEYWORDS` in §5 is the list that makes it right: after `return`, `case` or
// `as` no value has ended, so the operator after one of them is never touched.
//
// **Nothing beginning with `<` or `>` is ever spaced.** `<` opens a generic parameter list
// as readily as it compares, and `Map<String, List<String>> m` has three of them and no
// comparison at all. Telling those apart needs a type checker, so `<`, `>`, `<=`, `>=`,
// `<<` and `>>` are left exactly as they were written — and `Array<number>= []`, which
// reads as `>=` to a scanner, is left alone rather than rewritten into `Array<number >= []`.
//
// **`:` is three tokens wearing one character**, so it is the other place a single wrong
// guess would be expensive: a type annotation, an object key, a `case` label and a
// ternary's second half are all `:`. The first three want no space in front of them and one
// behind; the ternary wants one on each side. They are told apart by counting: a `?` that
// opens a ternary is remembered against its bracket depth, and the next `:` at that depth
// answers it. A `?` is only counted when a value has just ended and what follows is not
// `)`, `,`, `:`, `=` or the end of the line — which is what keeps Swift's `Int?`, `x?.y`,
// `try?` and `as?` out of it. The count belongs to the depth it was opened at and is
// dropped by a `;` at that depth, so a ternary survives both `a ? f { x } : b` and a line
// break in the middle of itself without reaching across a statement.
//
// **Strings and comments are copied out exactly**, including a multi-line one — a template
// literal, a `"""` block, a Swift `#"…"#`. This is the markup formatter's rule about an
// element's own text, and the reason is the same: the inside of a string is not whitespace
// to be tidied, it is the value of something.
//
// **A file whose brackets do not balance is refused.** Reindent is best-effort on anything
// and clamps a stray `}` to the left margin; Format is not, because respacing a file the
// scanner cannot account for is the case where a quiet mistake spreads over the whole
// document.

var K_NONE = 0, K_WORD = 1, K_KEYWORD = 2, K_NUMBER = 3, K_STRING = 4, K_REGEX = 5;
var K_COMMENT = 6, K_OPEN = 7, K_CLOSE = 8, K_OP = 9;
var K_COMMA = 10, K_SEMI = 11, K_COLON = 12, K_DOT = 13, K_ATTRIBUTE = 14;

// Every operator these four languages spell with more than one character, so that `a=-b`
// is read as `=` and `-` rather than as one operator nobody wrote.
var OPERATORS = {
    ">>>=": 1,
    "===": 1, "!==": 1, "**=": 1, "&&=": 1, "||=": 1, "??=": 1, "<<=": 1, ">>=": 1,
    ">>>": 1, "...": 1, "..<": 1,
    "==": 1, "!=": 1, "<=": 1, ">=": 1, "&&": 1, "||": 1, "??": 1, "+=": 1, "-=": 1,
    "*=": 1, "/=": 1, "%=": 1, "&=": 1, "|=": 1, "^=": 1, "**": 1, "<<": 1, ">>": 1,
    "->": 1, "=>": 1, "?.": 1, "::": 1, "++": 1, "--": 1, "..": 1
};

// Swift's overflow operators, which wrap rather than trap. They matter here because `&+=`
// spelt as `&` and `+=` is two forced operators and comes back as `token & += 1` — which
// is not Swift. They are Swift's alone: in JavaScript `a &+b` is `a & (+b)`, so reading the
// two characters as one operator there would be the same mistake in the other direction.
var SWIFT_OPERATORS = { "&+": 1, "&-": 1, "&*": 1, "&+=": 1, "&-=": 1, "&*=": 1, "&<<": 1,
                        "&>>": 1, "~=": 1 };

// The operators that get one space on each side when they are infix. Anything absent is
// left as written — `<` and `>` and everything built from them because of generics, `!`
// and `~` and `++` because they are not infix at all, `?.` and `::` and `...` because they
// bind their two sides together rather than standing between them.
var FORCED = {
    "=": 1, "==": 1, "===": 1, "!=": 1, "!==": 1,
    "+": 1, "-": 1, "*": 1, "/": 1, "%": 1, "**": 1,
    "&": 1, "|": 1, "^": 1, "&&": 1, "||": 1, "??": 1,
    "+=": 1, "-=": 1, "*=": 1, "/=": 1, "%=": 1, "**=": 1,
    "&=": 1, "|=": 1, "^=": 1, "&&=": 1, "||=": 1, "??=": 1,
    "->": 1, "=>": 1
};

// One table per language, built once at load, so the lexer never asks which language it is
// in — it asks its own table.
function operatorTables(id) {
    var ops = {}, forced = {};
    var name;
    for (name in OPERATORS) {
        if (Object.prototype.hasOwnProperty.call(OPERATORS, name)) { ops[name] = 1; }
    }
    for (name in FORCED) {
        if (Object.prototype.hasOwnProperty.call(FORCED, name)) { forced[name] = 1; }
    }
    if (id === "swift") {
        for (name in SWIFT_OPERATORS) {
            if (!Object.prototype.hasOwnProperty.call(SWIFT_OPERATORS, name)) { continue; }
            ops[name] = 1;
            if (name !== "~=") { forced[name] = 1; }
        }
    }
    return { ops: ops, forced: forced };
}

(function () {
    for (var id in SYNTAX) {
        if (Object.prototype.hasOwnProperty.call(SYNTAX, id)) {
            SYNTAX[id].operators = operatorTables(id);
        }
    }
    SYNTAX_PLAIN.operators = operatorTables("");
}());

// The characters that can continue an operator. `,` and `;` are absent on purpose: they
// end a token rather than joining one, so `a,-b` can never be munched into `,-`.
function isOpTail(code) {
    return code === AMP || code === PLUS || code === MINUS || code === STAR || code === SLASH
        || code === PERCENT || code === EQ || code === BANG || code === LT || code === GT
        || code === AMP || code === PIPE || code === CARET || code === QUESTION
        || code === COLON || code === DOT;
}

// Has a value just ended? The question behind three decisions — whether an operator is
// infix, whether `/` opens a pattern, whether `?` opens a ternary — and `}` is the one
// token that answers it differently depending on which is being asked.
//
// For `/`, a `}` answers **no**: it much more often closes a block than an object literal,
// and `function f() {} /re/` is the case that matters. For everything else it answers
// **yes**, because `folders.contains { $0.url == x } ? a : b` is ordinary Swift and
// `refusal ? { error: refusal } : null` is ordinary JavaScript, and reading the `}` as the
// end of a block there loses the ternary. Nothing is at risk in the other direction: an
// operator that only *might* be infix is one this pass puts a space around, and a line
// beginning with a prefix operator immediately after a closing brace is not a thing anyone
// writes.
function valueBefore(kind, code) {
    if (kind === K_WORD || kind === K_ATTRIBUTE || kind === K_NUMBER || kind === K_STRING
        || kind === K_REGEX) {
        return true;
    }
    return kind === K_CLOSE && code !== CLOSE_BRACE;
}

function endsValue(kind, code) {
    return valueBefore(kind, code) || (kind === K_CLOSE && code === CLOSE_BRACE);
}

// The whole of the spacing policy, in the order the questions have to be asked.
function gapBetween(prevK, prevC, prevForced, curK, curC, curForced, hadSpace, ternary) {
    if (prevK === K_NONE) { return ""; }
    if (curK === K_COMMA || curK === K_SEMI) { return ""; }
    if (curK === K_CLOSE && curC !== CLOSE_BRACE) { return ""; }
    if (prevK === K_OPEN && prevC !== OPEN_BRACE) { return ""; }
    // `{` and `}` collapse and no more, including here: whether a one-line block reads
    // `{ f(); }` or `{f();}` is a house style, and both halves of it have to agree.
    if (curK === K_CLOSE || prevK === K_OPEN) { return hadSpace ? " " : ""; }
    if (prevK === K_COMMA || prevK === K_SEMI) { return " "; }
    if (curK === K_COLON) { return ternary ? " " : ""; }
    if (prevK === K_COLON) { return " "; }
    // `obj . prop` closes up; `flag ? .red : .blue` must not, because `?.` is a different
    // operator and writing it would change what the line means.
    if (curK === K_DOT) { return valueBefore(prevK, prevC) ? "" : (hadSpace ? " " : ""); }
    if (prevK === K_DOT) { return ""; }
    // Only what follows a comment collapses. What comes *before* one is handled by the
    // caller, which copies it through: a trailing comment is very often aligned into a
    // column with the ones above and below it, and a formatter that pulled every one of
    // them back to a single space would be rewriting something a person did on purpose.
    if (prevK === K_COMMENT || curK === K_COMMENT) { return hadSpace ? " " : ""; }
    // An attribute is the one word whose bracket cannot be settled from here. Swift writes
    // `@available(*, deprecated)` closed up, because those are the attribute's arguments,
    // and `@escaping (T) -> U` open, because that is the type it is attached to. Nothing
    // short of knowing the attribute tells them apart, so both are left as written.
    if (prevK === K_ATTRIBUTE && curK === K_OPEN) { return hadSpace ? " " : ""; }
    if (curK === K_OPEN && curC !== OPEN_BRACE) {
        // `if (x)` keeps its space and `f (x)` loses it: a keyword takes an expression,
        // a name takes an argument list. `private(set)` is why access modifiers are not
        // keywords here.
        if (prevK === K_KEYWORD) { return " "; }
        if (prevK === K_CLOSE || valueBefore(prevK, prevC)) { return ""; }
    }
    if (curK === K_OPEN && curC === OPEN_BRACE) {
        if (prevK === K_KEYWORD || prevK === K_WORD || prevK === K_CLOSE
            || prevK === K_NUMBER || prevK === K_STRING) { return " "; }
    }
    if (curForced || prevForced) { return " "; }
    return hadSpace ? " " : "";
}

// A line's leading whitespace, copied through untouched — Reindent owns it, and running
// this on its own should not quietly re-indent anything.
function copyLead(text, i, len, out) {
    var from = i;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code !== SPACE && code !== TAB) { break; }
        i++;
    }
    if (i > from) { out.add(text.slice(from, i)); }
    return i;
}

function endOfCodeBlockComment(text, i, len) {
    var from = i;
    i += 2;
    while (i < len) {
        if (text.charCodeAt(i) === STAR && text.charCodeAt(i + 1) === SLASH) { return i + 2; }
        i++;
    }
    refuse("A block comment opened here is never closed.", from);
}

function endOfTriple(text, i, len, mark, want) {
    var from = i;
    i += 3;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code === BACKSLASH && want === 0) { i += 2; continue; }
        if (code === mark && text.charCodeAt(i + 1) === mark
            && text.charCodeAt(i + 2) === mark && closingHashes(text, i + 3, want)) {
            return i + 3 + want;
        }
        i++;
    }
    refuse("A multi-line string opened here is never closed.", from);
}

// A template literal, and the code inside each `${…}` of it. The interpolation has to be
// walked rather than skipped, because a backtick inside one belongs to a *different*
// template and stopping at it would end this string in the middle of an expression.
function endOfTemplate(text, i, len, syn) {
    var from = i;
    i++;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code === BACKSLASH) { i += 2; continue; }
        if (code === BACKTICK) { return i + 1; }
        if (code === DOLLAR && text.charCodeAt(i + 1) === OPEN_BRACE) {
            i += 2;
            var nest = 1;
            while (i < len && nest > 0) {
                var inner = text.charCodeAt(i);
                if (inner === OPEN_BRACE) { nest++; i++; }
                else if (inner === CLOSE_BRACE) { nest--; i++; }
                else if (inner === QUOTE || inner === APOS || inner === BACKTICK) {
                    i = endOfCodeString(text, i, len, syn);
                } else if (inner === SLASH && text.charCodeAt(i + 1) === SLASH) {
                    while (i < len && text.charCodeAt(i) !== LF) { i++; }
                } else if (inner === SLASH && text.charCodeAt(i + 1) === STAR) {
                    i = endOfCodeBlockComment(text, i, len);
                } else { i++; }
            }
            continue;
        }
        i++;
    }
    refuse("A template literal opened here is never closed.", from);
}

function endOfCodeString(text, i, len, syn) {
    var code = text.charCodeAt(i);
    if (code === HASH) {
        var opened = openingHashes(text, i);
        i += opened;
        if (text.charCodeAt(i + 1) === QUOTE && text.charCodeAt(i + 2) === QUOTE) {
            return endOfTriple(text, i, len, QUOTE, opened);
        }
        return endOfSimpleString(text, i, len, QUOTE, opened, true);
    }
    if (code === BACKTICK) { return endOfTemplate(text, i, len, syn); }
    if (syn.triple === 1 && text.charCodeAt(i + 1) === code
        && text.charCodeAt(i + 2) === code) {
        return endOfTriple(text, i, len, code, 0);
    }
    return endOfSimpleString(text, i, len, code, 0, true);
}

function respace(text, languageID) {
    var syn = syntaxFor(languageID);
    var len = text.length;
    var out = new Out();

    // What came before, kept *across* the line break rather than reset at it. A line that
    // begins `? a : b` or `+ total` is the rest of the line above it, and every question
    // this pass asks — is this operator infix, does this `/` open a pattern, does this `?`
    // open a ternary — is about the token before it and not about the column it is in.
    // What the line break does end is the *gap*: `startOfLine` says the leading whitespace
    // has already been copied and belongs to Reindent.
    var prevK = K_NONE, prevC = 0, prevForced = false;
    var startOfLine = false;
    var pend = [];              // ternary `?` waiting for its `:`, counted per depth
    var depth = 0;
    var attrDepth = -1;         // the depth of an attribute's own argument list
    var openCode = [], openAt = [];
    var i = copyLead(text, 0, len, out);

    while (i < len) {
        // The whitespace before the next token, which this pass exists to replace. A line
        // ending is not whitespace of that kind: it is copied, exactly as it was written,
        // and the line after it starts over with nothing to its left.
        var hadSpace = false;
        var gapFrom = i;
        for (;;) {
            var g = text.charCodeAt(i);
            if (g === SPACE || g === TAB) { hadSpace = true; i++; continue; }
            if (g === LF || g === CR) {
                if (g === CR && text.charCodeAt(i + 1) === LF) { out.add("\r\n"); i += 2; }
                else { out.add(g === CR ? "\r" : "\n"); i++; }
                i = copyLead(text, i, len, out);
                startOfLine = true;
                hadSpace = false;
                gapFrom = i;
                continue;
            }
            break;
        }
        if (i >= len) { break; }

        var from = i;
        var code = text.charCodeAt(i);
        var kind = K_OP;
        var forced = false;
        var ternary = false;
        var opensLine = startOfLine;

        if (isWordStart(code)) {
            i++;
            while (i < len && isWordPart(text.charCodeAt(i))) { i++; }
            // A word after `.` is a member name whatever it is spelt like, so `.catch(fn)`
            // and `.default` are calls and properties rather than keywords with a space
            // owing to them.
            kind = prevK !== K_DOT && isKeywordAt(text, from, i, syn.keywords) ? K_KEYWORD
                : (prevK === K_OP && prevC === AT ? K_ATTRIBUTE : K_WORD);

        } else if (isDigit(code) || (code === DOT && isDigit(text.charCodeAt(i + 1)))) {
            i = endOfCodeNumber(text, i, len);
            kind = K_NUMBER;

        } else if (code === SLASH && syn.slash === 1 && text.charCodeAt(i + 1) === SLASH) {
            while (i < len && text.charCodeAt(i) !== LF && text.charCodeAt(i) !== CR) { i++; }
            kind = K_COMMENT;

        } else if (code === SLASH && syn.block === 1 && text.charCodeAt(i + 1) === STAR) {
            i = endOfCodeBlockComment(text, i, len);
            kind = K_COMMENT;

        } else if (code === HASH && from === 0 && text.charCodeAt(1) === BANG) {
            while (i < len && text.charCodeAt(i) !== LF && text.charCodeAt(i) !== CR) { i++; }
            kind = K_COMMENT;

        } else if (syn.rawHash === 1 && code === HASH && openingHashes(text, i) > 0) {
            i = endOfCodeString(text, i, len, syn);
            kind = K_STRING;

        } else if (code === QUOTE || (code === APOS && syn.apos === 1)
                   || (code === BACKTICK && syn.raw === 1)) {
            i = endOfCodeString(text, i, len, syn);
            kind = K_STRING;

        } else if (code === BACKTICK && syn.tick === 1) {
            // Swift's escaped identifier, `` `default` ``. A name, not a string.
            i++;
            while (i < len && text.charCodeAt(i) !== BACKTICK
                   && text.charCodeAt(i) !== LF) { i++; }
            if (i < len && text.charCodeAt(i) === BACKTICK) { i++; }
            kind = K_WORD;

        } else if (code === SLASH && syn.regex === 1 && !valueBefore(prevK, prevC)
                   && endOfRegex(text, i, len) > 0) {
            i = endOfRegex(text, i, len);
            kind = K_REGEX;

        } else if (code === OPEN_PAREN || code === OPEN_BRACKET || code === OPEN_BRACE) {
            openCode[openCode.length] = code;
            openAt[openAt.length] = i;
            // `@convention(block) (JSValue?) -> Void`: the bracket after an attribute's own
            // arguments is as unsettleable as the one after the attribute itself, so the
            // attribute is carried as far as its closing `)`.
            if (prevK === K_ATTRIBUTE && code === OPEN_PAREN && attrDepth < 0) {
                attrDepth = depth;
            }
            depth++;
            pend[depth] = 0;
            i++;
            kind = K_OPEN;

        } else if (code === CLOSE_PAREN || code === CLOSE_BRACKET || code === CLOSE_BRACE) {
            var want = code === CLOSE_PAREN ? OPEN_PAREN
                : code === CLOSE_BRACKET ? OPEN_BRACKET : OPEN_BRACE;
            if (openCode.length === 0) {
                refuse("This closes a bracket that was never opened.", i);
            }
            if (openCode[openCode.length - 1] !== want) {
                refuse("This closes the wrong kind of bracket.", i);
            }
            openCode.length = openCode.length - 1;
            openAt.length = openAt.length - 1;
            pend[depth] = 0;
            depth--;
            i++;
            kind = K_CLOSE;
            if (attrDepth === depth) { kind = K_ATTRIBUTE; attrDepth = -1; }

        } else {
            // An operator, taken as long as one these languages actually spell.
            var span = 1;
            if (isOpTail(text.charCodeAt(i + 1))) {
                var most = len - i;
                if (most > 4) { most = 4; }
                for (var n = most; n > 1; n--) {
                    if (syn.operators.ops[text.slice(i, i + n)] === 1) { span = n; break; }
                }
            }
            i += span;

            if (span === 1 && code === COMMA) { kind = K_COMMA; }
            else if (span === 1 && code === SEMI) { kind = K_SEMI; pend[depth] = 0; }
            else if (span === 1 && code === DOT) { kind = K_DOT; }
            else if (span === 1 && code === COLON) {
                kind = K_COLON;
                if (pend[depth] > 0) { pend[depth]--; ternary = true; }
            } else {
                kind = K_OP;
                var infix = endsValue(prevK, prevC);
                if (span === 1 && code === QUESTION && infix
                    && startsOperand(text, i, len, syn.keywords)) {
                    pend[depth] = (pend[depth] === undefined ? 0 : pend[depth]) + 1;
                    forced = true;
                } else if (infix) {
                    var op = text.slice(from, i);
                    // `URL?? = nil` is a double optional, not a nil-coalescing with nothing
                    // to coalesce. The same question as the ternary's, asked of `??`.
                    forced = syn.operators.forced[op] === 1
                        && (op !== "??" || startsOperand(text, i, len, syn.keywords));
                }
            }
        }

        // **More than one space is alignment, and alignment is left alone.** What this
        // pass decides is the choice between one space and none; a column somebody lined
        // up — a table of settings, a run of trailing comments, two `->` under each other —
        // was done on purpose, and collapsing it is the change a formatter is least
        // forgiven for. A single tab counts as alignment for the same reason.
        var gap;
        var wide = from - gapFrom;
        if (startOfLine || prevK === K_NONE) {
            gap = "";
        } else if (wide > 1 || (wide === 1 && text.charCodeAt(gapFrom) === TAB)) {
            gap = text.slice(gapFrom, from);
        } else {
            gap = gapBetween(prevK, prevC, prevForced, kind, code, forced, hadSpace, ternary);
        }
        if (gap !== "") { out.add(gap); }
        startOfLine = false;
        // A statement starting is where an unanswered `?` is given up on. Swift's
        // `var x: Int? { get }` looks exactly like a ternary opening onto a closure, and
        // only one of them ever produces the `:` that would settle it; without a boundary
        // the other would go on waiting and take the next annotation's colon instead. A
        // `;` is that boundary where there is one, and a line beginning with a keyword is
        // that boundary in the languages that do not use `;`.
        if (opensLine && kind === K_KEYWORD) { pend.length = 0; }
        out.add(text.slice(from, i));

        prevK = kind;
        prevC = code;
        prevForced = forced;
    }

    if (openCode.length > 0) {
        refuse("A bracket opened here is never closed.", openAt[openAt.length - 1]);
    }
    return out.done();
}

// Does an operand start here? Which is to say: is this `?` the start of a ternary, rather
// than an optional type or the tail of `try?`
// and `as?`? Those last two are already excluded by the caller, which asks only when a
// value has just ended, and `try` and `as` are keywords. Optional chaining never reaches
// here either: `x?.y` is spelt with the two characters adjacent, so it was read as the one
// operator `?.` — which is why a `.` *after a space* is a perfectly good ternary, and Swift
// writes `flag ? .red : .blue` all the time. What is left is settled by what comes next: a
// ternary always has something to return, and neither does `??` coalesce with nothing —
// `URL?? = nil` is a double optional, and the two are the same question.
//
// Adjacency decides the other two the same way it decides `?.`: `fullHeightDidChange?(x)`
// and `values?[0]` are an optional call and an optional subscript, written with nothing
// between the `?` and the bracket, while `flag ? (a) : (b)` is a ternary that happens to
// have parenthesised its halves. Reading the first as the second turns `init?(header:)`
// into `init ? (header:)`, which is not Swift at all.
function startsOperand(text, i, len, keywords) {
    var skipped = false;
    while (i < len) {
        var code = text.charCodeAt(i);
        if (code === SPACE || code === TAB) { skipped = true; i++; continue; }
        if (!skipped && (code === OPEN_PAREN || code === OPEN_BRACKET)) { return false; }
        // A ternary's first half is an expression, and an expression does not start with
        // `in`. Swift's `compactMap { x -> Thing? in` does, and reading its `?` as a
        // ternary puts a space between a type and its question mark.
        if (isWordStart(code)) {
            var to = i + 1;
            while (to < len && isWordPart(text.charCodeAt(to))) { to++; }
            if (isKeywordAt(text, i, to, keywords)) { return false; }
        }
        // `{` is counted out, and that is a choice rather than a fact. `cond ? { … } : x`
        // is a ternary onto a closure and `-> Thing? {` is an optional return type meeting
        // its body, and one token of lookahead cannot tell them apart. The second is far
        // the commoner in Swift — eight of them in sixty files of the editor's own source,
        // against two of the first — and `-> Any ? {` reads as broken where a ternary
        // missing one space before its colon only reads as untidy.
        return !(code === COMMA || code === COLON || code === QUESTION
                 || code === EQ || code === GT || code === SEMI
                 || code === CLOSE_PAREN || code === CLOSE_BRACKET || code === CLOSE_BRACE
                 || code === OPEN_BRACE || code === LF || code === CR);
    }
    return false;
}

// The languages Format Document reformats as code: what the panel calls each of them, and
// the files each one claims. `.jsx` and `.tsx` are deliberately absent from the second list
// — see `formatterFor`.
var CODE_LANGUAGES = {
    "swift":         { name: "Swift",      extensions: ["swift"] },
    "java":          { name: "Java",       extensions: ["java"] },
    "javascript.js": { name: "JavaScript", extensions: ["js", "mjs", "cjs"] },
    "typescript":    { name: "TypeScript", extensions: ["ts", "mts", "cts"] }
};

// JSX is a different grammar living in the same files, and nothing here reads it: `<div>`
// is not an operator and `</div>` is not a division. Reindent and Tidy are unaffected —
// neither of them looks at a `<` — so what these files lose is Format Document alone.
var JSX_EXTENSIONS = { jsx: 1, tsx: 1 };

function formatCode(text, languageID, opt) {
    return reindent(respace(text, languageID), languageID, opt);
}

// ---------------------------------------------------------------------------------------
// §6  Which formatter a document gets
// ---------------------------------------------------------------------------------------
//
// The language id decides, and the file extension is asked only when the editor could not
// place the file. Both are needed: `xml` covers `.svg` and `.plist` and `css` covers `.scss`
// and `.less`, so the id is the better answer where there is one — but a `.json` opened as
// plain text should still format.

var BY_EXTENSION = {
    json: "json", jsonc: "json", ipynb: "json", webmanifest: "json",
    xml: "xml", svg: "xml", plist: "xml", xsd: "xml", xsl: "xml", xslt: "xml",
    rss: "xml", atom: "xml", csproj: "xml", storyboard: "xml", xib: "xml",
    html: "html", htm: "html", xhtml: "html", vue: "html",
    css: "css", scss: "css", less: "css"
};

function extensionOf(path) {
    if (!path) { return ""; }
    var slash = path.lastIndexOf("/");
    var name = slash < 0 ? path : path.slice(slash + 1);
    var dot = name.lastIndexOf(".");
    return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

// One of "json", "xml", "html", "css", "code", or "" when nothing here formats this
// document.
function formatterFor(languageID, path) {
    if (languageID === "json") { return "json"; }
    if (languageID === "xml") { return "xml"; }
    if (languageID === "html") { return "html"; }
    if (languageID === "css") {
        // `css` covers SCSS and LESS in the editor's language database, and one formatter
        // covers all three, so the extension is not consulted here.
        return "css";
    }
    if (CODE_LANGUAGES[languageID] !== undefined) {
        var extension = extensionOf(path);
        // The one place the extension outranks the language id. A `.vue` file is lexed as
        // JavaScript by the editor and is markup by construction, so the table below has
        // the better answer for it — and a `.jsx` or `.tsx` holds a grammar §5b does not
        // read.
        var claimed = BY_EXTENSION[extension];
        if (claimed !== undefined) { return claimed; }
        return JSX_EXTENSIONS[extension] === 1 ? "" : "code";
    }
    var byExtension = BY_EXTENSION[extensionOf(path)];
    return byExtension === undefined ? "" : byExtension;
}

// The extensions a formatter claims, read back out of the same table the dispatch uses. A
// sentence listing them by hand would be wrong the first time a type was added, and the one
// place this list is shown is the one place a user is asking precisely that question.
function extensionsFor(kind, limit) {
    var list = [];
    for (var ext in BY_EXTENSION) {
        if (Object.prototype.hasOwnProperty.call(BY_EXTENSION, ext)
            && BY_EXTENSION[ext] === kind) {
            list[list.length] = "." + ext;
        }
    }
    if (limit > 0 && list.length > limit) {
        return list.slice(0, limit).join("  ") + "  +" + (list.length - limit) + " more";
    }
    return list.join("  ");
}

// What still works on a document nothing here formats — and only what still works. Reindent
// needs a structure to read the indentation back out of, which for Markdown, YAML and shell
// there is not, so for those it is Tidy alone. Saying "Reindent and Tidy" everywhere was the
// first version of this, and it was wrong in exactly the cases a user is most likely to be
// looking at when they read it.
function alsoAvailable(languageID) {
    return REINDENTABLE[languageID] === 1
        ? "Reindent and Tidy Whitespace are on the Plugins menu."
        : "Tidy Whitespace is on the Plugins menu.";
}

function runFormatter(kind, text, opt, minify, languageID) {
    switch (kind) {
    case "json": return formatJSON(text, opt, minify);
    case "xml":  return formatMarkup(text, opt, false, minify);
    case "html": return formatMarkup(text, opt, true, minify);
    case "css":  return formatCSS(text, opt);
    case "code": return formatCode(text, languageID, opt);
    }
    return null;
}

// The extensions a code language claims, for the one sentence that has to name them.
function codeExtensions() {
    var list = [];
    for (var id in CODE_LANGUAGES) {
        if (!Object.prototype.hasOwnProperty.call(CODE_LANGUAGES, id)) { continue; }
        var claimed = CODE_LANGUAGES[id].extensions;
        for (var n = 0; n < claimed.length; n++) { list[list.length] = "." + claimed[n]; }
    }
    return list;
}

// ---------------------------------------------------------------------------------------
// §7  The commands
// ---------------------------------------------------------------------------------------

// What the last command said. Kept until the next one rather than put on a timer: a sidebar
// has no scrollback, and "line 42, column 8" is the whole of what a refusal is worth.
var outcome = null;

function say(message, bad) {
    outcome = { message: message, bad: bad === true };
    linelark.log(message);
    linelark.refreshPanels();
}

// Every command ends here. One `replaceRange` for the whole document, because a loop of
// small edits is a stack of undo steps the user has to unwind one at a time — and because
// every write invalidates the offsets taken before it.
//
// Nothing is written when the text is already what it would be. That is not only tidiness:
// an edit marks the document dirty, drops the line index and re-highlights the buffer in
// every pane showing it, so a no-op write costs a full repaint and a save the user did not
// need to make.
function apply(replacement, what) {
    var current = linelark.text();
    if (replacement === current) {
        say(what + ": already formatted.", false);
        return;
    }
    var line = linelark.caretLine();
    linelark.replaceRange(0, linelark.length(), replacement);
    restoreCaret(replacement, line);
    say(what + ": done.", false);
}

// Put the caret back on the line it was on. Formatting moves every offset in the document,
// so the offset the caret held means nothing afterwards; the line number is the part that
// still refers to the same code.
function restoreCaret(text, line) {
    if (line < 1) { return; }
    var offset = 0;
    var seen = 1;
    while (seen < line) {
        var at = text.indexOf("\n", offset);
        if (at < 0) { break; }
        offset = at + 1;
        seen++;
    }
    linelark.setSelection(offset, 0);
}

// The one place a refusal becomes something a person can act on. A formatter throws a
// `FormatError` carrying an offset; the line and column are worked out only here, so
// walking the document to find them never costs a successful run anything.
function guard(work, text, what) {
    try {
        return work();
    } catch (error) {
        if (error instanceof FormatError) {
            say(what + " stopped: " + error.message + placeOf(text, error.offset), true);
        } else {
            say(what + " failed: " + error, true);
        }
        return null;
    }
}

function optionsFor(text) {
    return { unit: indentUnit(), newline: newlineOf(text) };
}

function formatDocument(minify) {
    var what = minify ? "Minify" : "Format";
    if (linelark.isReadOnly()) { return say(what + ": this tab is read-only.", true); }

    var kind = formatterFor(linelark.language(), linelark.filePath());
    if (kind === "") {
        return say("Format: nothing here formats " + describeLanguage() + ". "
                   + alsoAvailable(linelark.language())
                   + " See the plugin's README for why there is no more than that.", true);
    }
    if (minify && kind === "code") {
        return say("Minify: not offered for " + CODE_LANGUAGES[linelark.language()].name
                   + ". Taking the line breaks out of a program is a different job from "
                   + "formatting it, and nothing here does it. JSON and XML minify exactly.",
                   true);
    }
    if (minify && (kind === "css" || kind === "html")) {
        return say("Minify: not offered for " + (kind === "css" ? "CSS" : "HTML")
                   + ", because whitespace there is not always removable without changing "
                   + "what the file means. JSON and XML minify exactly.", true);
    }

    var text = linelark.text();
    var bom = bomOf(text);
    var body = bom.length > 0 ? text.slice(1) : text;
    var opt = optionsFor(body);
    var result = guard(function () {
        return runFormatter(kind, body, opt, minify, linelark.language());
    }, body, what);
    if (result === null) { return; }
    // A document that ended in a newline keeps ending in one. Formatting is not the moment
    // to take a decision about something nobody asked about.
    if (!minify && endedWithNewline(body) && !endedWithNewline(result)) {
        result += opt.newline;
    }
    apply(bom + result, what);
}

function describeLanguage() {
    var language = linelark.language();
    if (language === "normal" || language === "") { return "this file"; }
    return language;
}

// Named, because the panel's buttons call these rather than a second copy of them: there is
// one description of what Reindent means, and a fix to it reaches the menu and the panel
// together.
function reindentDocument() {
    if (linelark.isReadOnly()) { return say("Reindent: this tab is read-only.", true); }
    var text = linelark.text();
    var result = guard(function () {
        return reindent(text, linelark.language(), optionsFor(text));
    }, text, "Reindent");
    if (result !== null) { apply(result, "Reindent"); }
}

function tidyDocument() {
    if (linelark.isReadOnly()) { return say("Tidy: this tab is read-only.", true); }
    var text = linelark.text();
    var result = guard(function () { return tidy(text, linelark.language()); }, text, "Tidy");
    if (result !== null) { apply(result, "Tidy"); }
}

linelark.addCommand("format.document", "Format Document", function () {
    formatDocument(false);
});

linelark.addCommand("format.minify", "Minify Document", function () {
    formatDocument(true);
});

linelark.addCommand("format.reindent", "Reindent Document", reindentDocument);
linelark.addCommand("format.tidy", "Tidy Whitespace", tidyDocument);

// Reachable from a tab's context menu, for the file types that have a real formatter. The
// extension list is what decides which tabs offer it — a menu item that is present on every
// file and refuses on most of them is worse than one that is simply not there.
linelark.addContextMenuItem({
    id: "format.document.menu",
    title: "Format Document",
    locations: ["tab"],
    kinds: ["file"],
    extensions: ["json", "jsonc", "ipynb", "webmanifest", "xml", "svg", "plist", "xsd",
                 "xsl", "xslt", "rss", "atom", "csproj", "storyboard", "xib", "html",
                 "htm", "xhtml", "vue", "css", "scss", "less",
                 "swift", "java", "js", "mjs", "cjs", "ts", "mts", "cts"],
    handler: function () { formatDocument(false); }
});

// ---------------------------------------------------------------------------------------
// §8  The panel
// ---------------------------------------------------------------------------------------
//
// Two rules from the plugin guide shape this one, and both are about a panel that has a
// text field in it.
//
// **The node list must not change shape.** A box's typed text belongs to the *nth* node
// rather than to the id written on it, so a status line that appears only when there is
// something to say would slide every field below it onto another setting's contents. The
// last line is therefore always drawn, and only its words change.
//
// **`value` is the stored setting, every draw.** Handing back the live text would rewrite
// the box under the cursor on every keystroke; handing back what is stored means the box is
// left alone while somebody types and matches the moment a save lands.

var TICKED = "checkmark.square.fill";
var UNTICKED = "square";

function toggleRow(id, title, detail, on) {
    return { id: id, title: title, detail: detail, symbol: on ? TICKED : UNTICKED };
}

// Always the last node, in both states, so nothing above it has to move to make room for
// something to say. Silence is a sentence like any other.
function statusNode() {
    return { type: "text",
             text: outcome === null ? "Ready." : outcome.message,
             style: outcome !== null && outcome.bad ? "primary" : "secondary" };
}

// What the panel shows for a file nothing here formats.
//
// One statement and the list of what would work — not the whole panel with its controls
// greyed out. A disabled button is a question the user cannot answer: nothing about a dim
// **Format Document** says what would make it available, and the panel's own answer used to
// be a sentence that was only half true, promising Reindent on files whose blocks are not
// brackets. Saying less, and saying it accurately, is the smaller panel and the honest one.
//
// The list is built from `BY_EXTENSION`, so it cannot drift from what actually formats.
function unsupportedNodes() {
    return [
        { type: "text", text: "No formatter for this file.", style: "primary" },
        { type: "text", text: alsoAvailable(linelark.language()) },
        { type: "rows", rows: [
            { id: "kind.json", title: "JSON", symbol: "curlybraces",
              detail: extensionsFor("json", 0) },
            { id: "kind.xml", title: "XML", symbol: "chevron.left.forwardslash.chevron.right",
              detail: extensionsFor("xml", 6) },
            { id: "kind.html", title: "HTML", symbol: "globe",
              detail: extensionsFor("html", 0) },
            { id: "kind.css", title: "CSS", symbol: "paintbrush",
              detail: extensionsFor("css", 0) },
            { id: "kind.code", title: "Swift, Java, JavaScript, TypeScript",
              symbol: "curlybraces.square", detail: codeExtensions().join("  ") }
        ]},
        statusNode()
    ];
}

function panelNodes() {
    var language = linelark.language();
    var path = linelark.filePath();
    var kind = formatterFor(language, path);
    var readOnly = linelark.isReadOnly();

    if (kind === "") { return unsupportedNodes(); }

    var what;
    if (kind === "json") { what = "Formats as JSON."; }
    else if (kind === "xml") { what = "Formats as XML."; }
    else if (kind === "html") { what = "Formats as HTML."; }
    else if (kind === "code") {
        // Named rather than called "code", because the one thing a reader wants confirmed
        // here is that the plugin agrees with them about what this file is.
        what = "Formats as " + CODE_LANGUAGES[language].name + " — indentation and spacing.";
    }
    else { what = "Formats as CSS."; }

    var canMinify = kind === "json" || kind === "xml";
    var canReindent = REINDENTABLE[language] === 1;

    return [
        { type: "text", text: what, style: "primary" },
        { type: "button", id: "format", title: "Format Document", symbol: "wand.and.stars",
          prominent: true, enabled: kind !== "" && !readOnly },
        { type: "actions", actions: [
            { id: "minify", title: "Minify", symbol: "arrow.down.right.and.arrow.up.left",
              enabled: canMinify && !readOnly },
            { id: "reindent", title: "Reindent", symbol: "increase.indent",
              enabled: canReindent && !readOnly },
            { id: "tidy", title: "Tidy Whitespace", symbol: "sparkles", enabled: !readOnly }
        ]},

        { type: "section", id: "indentation", title: "Indentation", children: [
            { type: "rows", rows: [
                toggleRow("useSpaces", "Spaces", settings.indent + " per level",
                          !settings.useTabs),
                toggleRow("useTabs", "Tabs", "one tab per level", settings.useTabs)
            ]},
            { type: "field", id: "indent", label: "Spaces per level", placeholder: "4",
              value: settings.indent, submit: "Set", enabled: !settings.useTabs }
        ]},

        { type: "section", id: "tidying", title: "Tidy Whitespace", children: [
            { type: "rows", rows: [
                toggleRow("trimTrailing", "Trim trailing whitespace",
                          "except inside strings", settings.trimTrailing),
                toggleRow("collapseBlanks", "Collapse blank lines",
                          "at most " + settings.maxBlankLines + " in a row",
                          settings.collapseBlanks),
                toggleRow("finalNewline", "End with a newline",
                          "adds one; never removes one", settings.finalNewline)
            ]},
            { type: "field", id: "maxBlankLines", label: "Blank lines in a row",
              placeholder: "1", value: settings.maxBlankLines, submit: "Set",
              enabled: settings.collapseBlanks }
        ]},

        statusNode()
    ];
}

linelark.addPanel({
    id: "format",
    title: "Format",
    symbol: "text.alignleft",
    side: "right",
    render: panelNodes,

    onSelect: function (id) {
        switch (id) {
        case "format": formatDocument(false); return;
        case "minify": formatDocument(true); return;
        case "reindent": reindentDocument(); return;
        case "tidy": tidyDocument(); return;
        case "useSpaces": settings.useTabs = false; break;
        case "useTabs": settings.useTabs = true; break;
        case "trimTrailing": settings.trimTrailing = !settings.trimTrailing; break;
        case "collapseBlanks": settings.collapseBlanks = !settings.collapseBlanks; break;
        case "finalNewline": settings.finalNewline = !settings.finalNewline; break;
        default: return;
        }
        saveSettings();
        linelark.refreshPanels();
    },

    onSubmit: function (id, value) {
        if (id === "indent") { settings.indent = String(value); }
        else if (id === "maxBlankLines") { settings.maxBlankLines = String(value); }
        else { return; }
        saveSettings();
        linelark.refreshPanels();
    }
});
