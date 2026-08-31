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
// §5  Reindent and Tidy — what the other languages get, named for what it is
// ---------------------------------------------------------------------------------------
//
// There is no Format for Python, Swift, Go, Rust or C here, and there is no honest way to
// add one. Formatting those languages means black, swift-format, gofmt and rustfmt: they
// decide where a line wraps, and reproducing any of them is a program rather than a
// function. The plugin API has no call that runs one, and the App Store edition is
// sandboxed, so there is nowhere for such a call to lead even if it existed.
//
// What is offered instead is two operations that are exactly definable and never move a
// token, so their names promise what they do and no more:
//
//   **Reindent** rewrites the leading whitespace of each line from its bracket depth. It is
//   what Notepad++'s re-indent and Xcode's ⌃I do. It never wraps, never reorders, and never
//   touches a character that is not leading whitespace.
//
//   **Tidy** removes whitespace that does nothing: trailing spaces, runs of blank lines, a
//   missing or repeated final newline. It only ever *removes* whitespace, which is what
//   makes it safe to offer for every language in the editor.
//
// Both rest on one scan that answers, for every line: what construct is open at the start of
// it, how deep the brackets are, and what its first non-blank character is. A line whose
// start is inside a string or a block comment is left alone by both — its leading whitespace
// is content, and stripping the trailing spaces from a line of a here-doc or a `"""` block
// changes the value of a string.

var S_CODE = 0, S_BLOCK = 1, S_TRIPLE_D = 2, S_TRIPLE_S = 3, S_RAW = 4;

// What spans a line, per language. Only the constructs that can *cross* a newline matter to
// either operation; a string that cannot reach the next line needs no state.
var SYNTAX = {
    "c":             { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 1 },
    "cpp":           { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 1 },
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
    "python":        { slash: 0, block: 0, hash: 1, quotes: 1, triple: 1, raw: 0, braces: 0 },
    "ruby":          { slash: 0, block: 0, hash: 1, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "bash":          { slash: 0, block: 0, hash: 1, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "yaml":          { slash: 0, block: 0, hash: 1, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "sql":           { slash: 1, block: 1, hash: 0, quotes: 1, triple: 0, raw: 0, braces: 0 },
    "xml":           { slash: 0, block: 0, hash: 0, quotes: 0, triple: 0, raw: 0, braces: 0 },
    "html":          { slash: 0, block: 0, hash: 0, quotes: 0, triple: 0, raw: 0, braces: 0 }
};

// A file the editor could not place. Nothing is assumed to span a line, which makes Tidy
// behave as a plain whitespace pass — the only safe reading when the grammar is unknown.
var SYNTAX_PLAIN = { slash: 0, block: 0, hash: 0, quotes: 0, triple: 0, raw: 0, braces: 0 };

function syntaxFor(languageID) {
    var found = SYNTAX[languageID];
    return found === undefined ? SYNTAX_PLAIN : found;
}

// One pass. Per line: the offset it starts at, the offset its text ends at (before any CR
// or LF, so the file's own line endings survive untouched), what was open at its start, the
// bracket depth at its start, and its first non-blank character.
function scanLines(text, syn) {
    var len = text.length;
    var start = [], stop = [], state = [], depth = [], first = [];
    var lines = 0;
    var s = S_CODE;
    var d = 0;
    var i = 0;

    for (;;) {
        start[lines] = i;
        state[lines] = s;
        depth[lines] = d;
        var firstCode = 0;

        while (i < len) {
            var code = text.charCodeAt(i);
            if (code === LF) { break; }

            if (firstCode === 0 && code !== SPACE && code !== TAB && code !== CR) {
                firstCode = code;
            }

            if (s === S_BLOCK) {
                if (code === STAR && text.charCodeAt(i + 1) === SLASH) { s = S_CODE; i += 2; }
                else { i++; }
                continue;
            }
            if (s === S_TRIPLE_D || s === S_TRIPLE_S) {
                var mark = s === S_TRIPLE_D ? QUOTE : APOS;
                if (code === BACKSLASH) { i += 2; continue; }
                if (code === mark && text.charCodeAt(i + 1) === mark
                    && text.charCodeAt(i + 2) === mark) { s = S_CODE; i += 3; }
                else { i++; }
                continue;
            }
            if (s === S_RAW) {
                if (code === BACKSLASH) { i += 2; continue; }
                if (code === BACKTICK) { s = S_CODE; i++; }
                else { i++; }
                continue;
            }

            // S_CODE.
            if (syn.slash === 1 && code === SLASH) {
                var after = text.charCodeAt(i + 1);
                if (after === SLASH) { break; }                 // rest of the line
                if (syn.block === 1 && after === STAR) { s = S_BLOCK; i += 2; continue; }
            }
            if (syn.hash === 1 && code === HASH) { break; }     // rest of the line
            if (syn.raw === 1 && code === BACKTICK) { s = S_RAW; i++; continue; }
            if (syn.quotes === 1 && (code === QUOTE || code === APOS)) {
                if (syn.triple === 1 && text.charCodeAt(i + 1) === code
                    && text.charCodeAt(i + 2) === code) {
                    s = code === QUOTE ? S_TRIPLE_D : S_TRIPLE_S;
                    i += 3;
                    continue;
                }
                // A string that cannot reach the next line. An unclosed one ends at the
                // line break, which is what an editor shows and what a compiler reports.
                i++;
                while (i < len) {
                    var inner = text.charCodeAt(i);
                    if (inner === LF) { break; }
                    if (inner === BACKSLASH) { i += 2; continue; }
                    if (inner === code) { i++; break; }
                    i++;
                }
                continue;
            }
            if (syn.braces === 1) {
                if (code === OPEN_BRACE || code === OPEN_BRACKET || code === OPEN_PAREN) { d++; }
                else if (code === CLOSE_BRACE || code === CLOSE_BRACKET
                         || code === CLOSE_PAREN) { d--; if (d < 0) { d = 0; } }
            }
            i++;
        }

        // Past a line comment, if that is what stopped the inner loop, to the line's end.
        while (i < len && text.charCodeAt(i) !== LF) { i++; }

        var end = i;
        if (end > start[lines] && text.charCodeAt(end - 1) === CR) { end--; }
        stop[lines] = end;
        first[lines] = firstCode;
        lines++;

        if (i >= len) { break; }
        i++;                                                    // past the LF
    }

    return { start: start, stop: stop, state: state, depth: depth, first: first,
             count: lines };
}

// Which languages have a bracket depth worth indenting from. Python is deliberately absent:
// its indentation *is* its block structure, so recomputing it from brackets would not
// reformat the file, it would rewrite what the program does.
var REINDENTABLE = {
    "c": 1, "cpp": 1, "java": 1, "javascript.js": 1, "typescript": 1, "swift": 1,
    "kotlin": 1, "go": 1, "rust": 1, "php": 1, "css": 1, "json": 1
};

function reindent(text, languageID, opt) {
    if (REINDENTABLE[languageID] !== 1) {
        var syn = SYNTAX[languageID];
        if (languageID === "python") {
            refuse("Python's indentation is its block structure, so it cannot be worked out "
                   + "from brackets. Tidy Whitespace is the safe one here.", -1);
        }
        refuse("Reindent needs a language whose blocks are brackets. This one is "
               + (syn === undefined ? "not one the editor knows" : "not written that way")
               + ".", -1);
    }

    var lines = scanLines(text, syntaxFor(languageID));
    var ind = new Indents(opt.unit, opt.newline);
    var out = new Out();

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

        var level = lines.depth[n];
        var head = lines.first[n];
        // A line beginning with a closing bracket belongs to the level it closes, not to
        // the one inside it. Without this every `}` sits one level too deep.
        if (head === CLOSE_BRACE || head === CLOSE_BRACKET || head === CLOSE_PAREN) {
            level--;
        }
        if (level < 0) { level = 0; }

        var body = from;
        while (body < to) {
            var lead = text.charCodeAt(body);
            if (lead !== SPACE && lead !== TAB) { break; }
            body++;
        }
        out.add(ind.at(level));
        out.add(text.slice(body, to));
    }
    return out.done();
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

// One of "json", "xml", "html", "css", or "" when nothing here formats this document.
function formatterFor(languageID, path) {
    if (languageID === "json") { return "json"; }
    if (languageID === "xml") { return "xml"; }
    if (languageID === "html") { return "html"; }
    if (languageID === "css") {
        // `css` covers SCSS and LESS in the editor's language database, and one formatter
        // covers all three, so the extension is not consulted here.
        return "css";
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
// needs brackets, so for Python, Markdown, YAML and shell it is Tidy alone. Saying "Reindent
// and Tidy" everywhere was the first version of this, and it was wrong in exactly the cases
// a user is most likely to be looking at when they read it.
function alsoAvailable(languageID) {
    return REINDENTABLE[languageID] === 1
        ? "Reindent and Tidy Whitespace are on the Plugins menu."
        : "Tidy Whitespace is on the Plugins menu.";
}

function runFormatter(kind, text, opt, minify) {
    switch (kind) {
    case "json": return formatJSON(text, opt, minify);
    case "xml":  return formatMarkup(text, opt, false, minify);
    case "html": return formatMarkup(text, opt, true, minify);
    case "css":  return formatCSS(text, opt);
    }
    return null;
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
    if (minify && (kind === "css" || kind === "html")) {
        return say("Minify: not offered for " + (kind === "css" ? "CSS" : "HTML")
                   + ", because whitespace there is not always removable without changing "
                   + "what the file means. JSON and XML minify exactly.", true);
    }

    var text = linelark.text();
    var bom = bomOf(text);
    var body = bom.length > 0 ? text.slice(1) : text;
    var opt = optionsFor(body);
    var result = guard(function () { return runFormatter(kind, body, opt, minify); },
                       body, what);
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
                 "htm", "xhtml", "vue", "css", "scss", "less"],
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
              detail: extensionsFor("css", 0) }
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
