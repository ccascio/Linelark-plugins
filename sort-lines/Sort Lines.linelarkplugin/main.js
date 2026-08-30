// Sort Lines — an editing plugin, and a panel that is a form.
//
// The commands under Plugins ▸ Sort Lines are the plugin at its simplest, and their three
// steps are the whole of what an editing plugin ever does: expand the selection to whole
// lines, compute the entire replacement, apply it as one edit. The panel is what makes the
// sort worth configuring — which lines, which part of each line to compare, in what order —
// and it holds the settings those commands run with.
//
// Three things shape the file.
//
// **A panel is never told the caret moved.** `render()` runs when the panel appears, when
// the front tab or the folder changes, and when the plugin asks — not when the selection
// changes. So nothing is *gated* on the selection: the Sort button is never greyed out
// because nothing is selected, and it reads the selection at the moment it is pressed,
// which is the only moment that answer is certainly current. A control disabled for a
// reason the panel cannot notice going away is a trap — the user selects the lines it
// asked for, the panel does not redraw, and the button stays grey.
//
// **Drawing the panel does not read the document.** A redraw happens on every tab change
// and every save, and there is no watchdog. So the panel asks for line counts and at most
// six lines, and the document is walked only when Sort is actually pressed.
//
// **Every setting is kept as the text that was typed.** A field cannot be submitted empty —
// the host disables its button — so a value parsed on the way in could never be taken back
// out. Parsing at the point of use means the panel can say what is wrong with "10..x"
// while leaving it on screen to be corrected.

// What the panel is for.
//
// In memory: there is no key-value store in the plugin API, so these last as long as the
// editor is open. That is the right lifetime for "sort by column 5" — it is the setting for
// the job in hand — and it is why the two menu commands honour these and start every
// session behaving exactly as they always did.
var DEFAULTS = {
    scope: "selection",     // "selection" | "file" | "lines"
    lines: "",              // "10-40", as typed
    key: "line",            // "line" | "columns" | "after"
    column: "",             // 1-based, as typed; empty is column 1
    marker: "",             // the text the key starts after
    span: "",               // how many characters of key to take; empty or 0 is the rest
    descending: false,
    ignoreCase: false,
    numeric: false,
    trim: false,
    unique: false
};

var options = copyOptions(DEFAULTS);

// What the last sort said. Kept until the next one rather than put on a timer: there is no
// scrollback in a sidebar, and "removed 3 duplicates" is the only report that three lines
// are gone.
var outcome = null;

// Reading the document to find where the selection's first line starts is the one thing
// here that touches the whole text. It is done only for the preview, and only for a
// document small enough that it costs nothing worth noticing; past that the preview says
// so rather than making every tab switch pause.
var PREVIEW_LIMIT = 1000000;
var PREVIEW_LINES = 6;

function copyOptions(from) {
    var out = {};
    for (var name in from) {
        if (Object.prototype.hasOwnProperty.call(from, name)) { out[name] = from[name]; }
    }
    return out;
}

// MARK: - Reading the settings back
//
// "10-40", "10", "10-", "-40" and nothing else. A range that half-parses is worse than one
// that is refused: sorting from line 10 to the end of the file when 40 was meant is not
// something undo makes you feel better about having watched happen.
//
// `last` of 0 means "to the end", which is what "10-" says and what a single number does not.
function parseLines(text) {
    var trimmed = String(text).replace(/\s+/g, "");
    if (!trimmed) { return null; }
    var match = /^(\d*)(?:(-|–|\.\.)(\d*))?$/.exec(trimmed);
    if (!match || (!match[1] && !match[2])) { return null; }
    var first = match[1] ? parseInt(match[1], 10) : 1;
    var last = match[2] ? (match[3] ? parseInt(match[3], 10) : 0) : first;
    if (first < 1) { return null; }
    if (last !== 0 && last < first) { return null; }
    return { first: first, last: last };
}

// A whole number, the given value for an empty box, NaN for anything else — so a typo is
// reported rather than silently read as zero.
function parseCount(text, fallback) {
    var trimmed = String(text).replace(/\s+/g, "");
    if (!trimmed) { return fallback; }
    if (!/^\d+$/.test(trimmed)) { return NaN; }
    return parseInt(trimmed, 10);
}

// Everything the sort needs, parsed once. Reading it out of `options` per line would run
// the same regexes for every line in the file.
function plan(overrides) {
    var column = parseCount(options.column, 1);
    var span = parseCount(options.span, 0);
    if (isNaN(column) || isNaN(span)) {
        return { error: "The column and the character count have to be whole numbers." };
    }
    return {
        key: options.key,
        from: Math.max(1, column) - 1,
        span: span,
        marker: options.marker,
        trim: options.trim,
        ignoreCase: options.ignoreCase,
        numeric: options.numeric,
        descending: options.descending,
        unique: ("unique" in overrides) ? overrides.unique : options.unique
    };
}

// MARK: - The key
//
// What actually gets compared. Offsets and lengths are UTF-16 code units, which is what
// JavaScript's own strings count in and what the editor's own offsets are.

function part(text, from, span) {
    return span > 0 ? text.slice(from, from + span) : text.slice(from);
}

function keyOf(line, p) {
    var text = line;
    if (p.key === "columns") {
        text = part(text, p.from, p.span);
    } else if (p.key === "after" && p.marker) {
        var at = text.indexOf(p.marker);
        // A line the marker is not on has no key at all rather than its whole self. All of
        // them then land together at one end, where they can be seen — which is the answer
        // to "why is that line in the wrong place".
        text = at === -1 ? "" : part(text, at + p.marker.length, p.span);
    }
    // Applied to the key rather than to the line, so that a column stays a column: option
    // and key each mean one thing, and turning on "ignore leading blanks" does not quietly
    // move where column 5 is.
    return p.trim ? text.replace(/^\s+/, "") : text;
}

// "item2" before "item10". A plain compare puts "10" first because "1" sorts before "2", so
// digit runs are compared as numbers and everything else as text.
//
// By length after leading zeros are dropped, rather than by parsing: an id long enough to
// lose precision in a double is exactly the kind of thing people sort files of.
function chunks(text) {
    var out = [];
    var i = 0;
    while (i < text.length) {
        var start = i;
        var digits = isDigit(text.charAt(i));
        while (i < text.length && isDigit(text.charAt(i)) === digits) { i++; }
        out.push({ digits: digits, text: text.slice(start, i) });
    }
    return out;
}

function isDigit(character) {
    return character >= "0" && character <= "9";
}

function compareChunks(left, right) {
    var shared = Math.min(left.length, right.length);
    for (var i = 0; i < shared; i++) {
        var a = left[i];
        var b = right[i];
        if (a.digits && b.digits) {
            var x = a.text.replace(/^0+(?=\d)/, "");
            var y = b.text.replace(/^0+(?=\d)/, "");
            if (x.length !== y.length) { return x.length - y.length; }
            if (x !== y) { return x < y ? -1 : 1; }
        } else {
            var result = a.text.localeCompare(b.text);
            if (result !== 0) { return result; }
        }
    }
    return left.length - right.length;
}

// Sort–decorate–undecorate: the key and its digit runs are computed once per line rather
// than once per comparison, which is the difference between one pass over the range and
// n log n of them.
function decorate(lines, p) {
    return lines.map(function (line) {
        var key = keyOf(line, p);
        var folded = p.ignoreCase ? key.toLowerCase() : key;
        return { line: line, key: key, folded: folded,
                 chunks: p.numeric ? chunks(folded) : null };
    });
}

function compare(a, b, p) {
    var result = p.numeric ? compareChunks(a.chunks, b.chunks)
                           : a.folded.localeCompare(b.folded);
    // Two keys that fold together still have to be put in some order, and leaving that to
    // the sort means the same file comes out differently depending on how the lines
    // arrived. Comparing what was actually written settles it the same way every time.
    if (result === 0 && p.ignoreCase) { result = a.key.localeCompare(b.key); }
    return p.descending ? -result : result;
}

// MARK: - Which lines
//
// Whatever lines the selection touches, whole — selecting half of a line should still sort
// that line rather than cutting it in two.
function expandToLines(range, text) {
    var start = range.location === 0 ? 0 : text.lastIndexOf("\n", range.location - 1) + 1;
    var to = range.location + range.length;
    // A selection dragged down to the start of the next line ends *at* that line without
    // touching any of it. Sorting a line nobody can see selected is a surprise, and undo
    // does not undo being confused by it.
    if (to > start && text.charAt(to - 1) === "\n") { to--; }
    var end = text.indexOf("\n", to);
    if (end === -1) { end = text.length; }
    return { location: start, length: end - start };
}

// The offset line `n` starts at, 1-based, or -1 when the file has no such line. indexOf
// rather than a walk character by character: the scan happens in the host, which is what
// makes this affordable on a file big enough that somebody is sorting a range out of the
// middle of it.
function offsetOfLine(text, n) {
    var at = 0;
    for (var i = 1; i < n; i++) {
        var next = text.indexOf("\n", at);
        if (next === -1) { return -1; }
        at = next + 1;
    }
    return at;
}

function rangeOfLines(first, last, text) {
    var start = offsetOfLine(text, first);
    if (start === -1) {
        return { error: "This file has only " + linelark.lineCount() + " lines." };
    }
    var end = text.length;
    if (last !== 0) {
        var lastStart = offsetOfLine(text, last);
        if (lastStart !== -1) {
            end = text.indexOf("\n", lastStart);
            if (end === -1) { end = text.length; }
        }
    }
    return { location: start, length: end - start };
}

// The range this run will replace, or why there isn't one.
function rangeToSort(scope) {
    if (!linelark.fileName()) { return { error: "Open a file to sort." }; }
    if (linelark.isReadOnly()) { return { error: "This tab is read-only." }; }

    if (scope === "file") { return { location: 0, length: linelark.length() }; }

    if (scope === "lines") {
        var parsed = parseLines(options.lines);
        if (!parsed) { return { error: "Type a line range like 10-40 first." }; }
        return rangeOfLines(parsed.first, parsed.last, linelark.text());
    }

    var selection = linelark.selectionRange();
    if (!selection || selection.length === 0) {
        return { error: "Nothing is selected. Select the lines to sort, or set the range "
                      + "to the whole file." };
    }
    return expandToLines(selection, linelark.text());
}

// MARK: - Doing it

function report(ok, text) {
    outcome = { ok: ok, text: text };
    // Also to the log, where it is the only trace when the run came from the menu with the
    // panel shut.
    if (!ok) { linelark.log(text); }
    linelark.refreshPanels();
}

// `overrides` is how the menu commands say what their own titles already promise —
// `{scope: "selection"}`, `{unique: true}` — without touching the panel's settings.
function run(overrides) {
    var scope = overrides.scope || options.scope;
    var range = rangeToSort(scope);
    if (range.error) { return report(false, range.error); }
    if (range.length === 0) { return report(false, "There is nothing in that range."); }

    var p = plan(overrides);
    if (p.error) { return report(false, p.error); }

    var original = linelark.getRange(range.location, range.length);
    var body = original;
    // A range ending in a newline splits into a final empty string, and sorting that to the
    // top turns the file's trailing newline into a leading blank line. The break belongs to
    // the range rather than to a line in it, so it is set aside and put back.
    var tail = "";
    if (body.charAt(body.length - 1) === "\n") {
        tail = "\n";
        body = body.slice(0, -1);
    }

    var lines = body.split("\n");
    var kept = lines.length;
    var result;

    if (overrides.reverse) {
        result = lines.slice().reverse();
    } else {
        var items = decorate(lines, p);
        // Stable since ES2019, which is what leaves lines with equal keys in the order they
        // were written — the thing that makes sorting by one column of a table useful.
        items.sort(function (a, b) { return compare(a, b, p); });
        if (p.unique) {
            // Whole lines, not keys. Two lines sharing a key are not the same line, and a
            // "remove duplicates" that threw one of them away would be deleting text the
            // user can see is different.
            //
            // A prototype-less object so a line reading "constructor" is a key like any
            // other rather than something already there.
            var seen = Object.create(null);
            items = items.filter(function (item) {
                if (seen[item.line]) { return false; }
                seen[item.line] = true;
                return true;
            });
        }
        result = items.map(function (item) { return item.line; });
    }

    var replacement = result.join("\n") + tail;
    var dropped = kept - result.length;
    if (replacement === original) {
        return report(true, dropped ? "Nothing to remove." : "Already in that order.");
    }

    // One replacement rather than one per line: it lands as a single undoable edit, named
    // after the command in the Undo menu, and every offset computed above stays valid right
    // up to the moment it stops mattering.
    linelark.replaceRange(range.location, range.length, replacement);
    // The result stays selected, so the same range can be sorted again with a different
    // setting without hunting for it, and so what moved is visible.
    linelark.setSelection(range.location, replacement.length);

    report(true, (overrides.reverse ? "Reversed " : "Sorted ") + result.length + " line"
                 + (result.length === 1 ? "" : "s")
                 + (dropped ? ", removed " + dropped + " duplicate"
                            + (dropped === 1 ? "" : "s") : "") + ".");
}

// MARK: - The panel
//
// A row that is a checkbox, and a row that is one of a set. Neither is a node type: `rows`
// is what a sidebar has, and the symbol is what says which of the two a row is behaving as.
function toggleRow(id, title, on, detail) {
    return { id: id, title: title, detail: detail || null,
             symbol: on ? "checkmark.square.fill" : "square" };
}

function choiceRow(id, title, on, detail) {
    return { id: id, title: title, detail: detail || null,
             symbol: on ? "largecircle.fill.circle" : "circle" };
}

function field(id, label, placeholder, value) {
    return { type: "field", id: id, label: label, placeholder: placeholder,
             value: value, multiline: false, submit: "Set" };
}

function describeLines() {
    var parsed = parseLines(options.lines);
    if (!parsed) { return options.lines ? "Not a range" : "Not set yet"; }
    if (parsed.last === 0) { return "Line " + parsed.first + " to the end"; }
    if (parsed.last === parsed.first) { return "Line " + parsed.first + " only"; }
    return "Lines " + parsed.first + " to " + parsed.last;
}

function rangeNodes() {
    var open = !!linelark.fileName();
    var nodes = [{
        type: "rows",
        rows: [
            choiceRow("scope:selection", "The selection", options.scope === "selection",
                      "The lines it touches, whole"),
            choiceRow("scope:file", "Whole file", options.scope === "file",
                      open ? linelark.lineCount() + " lines" : null),
            choiceRow("scope:lines", "A line range", options.scope === "lines",
                      describeLines())
        ]
    }];
    if (options.scope === "lines") {
        nodes.push(field("lines", "From line, to line", "10-40", options.lines));
    }
    return nodes;
}

function keyNodes() {
    var nodes = [{
        type: "rows",
        rows: [
            choiceRow("key:line", "The whole line", options.key === "line", null),
            choiceRow("key:columns", "From a column", options.key === "columns",
                      options.key === "columns" ? describeColumns() : null),
            choiceRow("key:after", "After some text", options.key === "after",
                      options.key === "after" ? describeMarker() : null)
        ]
    }];
    if (options.key === "columns") {
        nodes.push(field("column", "Start at column", "1", options.column));
    }
    if (options.key === "after") {
        nodes.push(field("marker", "Start after this text", "e.g. a comma", options.marker));
    }
    if (options.key !== "line") {
        nodes.push(field("span", "For how many characters — 0 for the rest of the line",
                         "0", options.span));
    }
    return nodes.concat(previewNodes());
}

function describeColumns() {
    var column = parseCount(options.column, 1);
    var span = parseCount(options.span, 0);
    if (isNaN(column) || isNaN(span)) { return "Not a number"; }
    column = Math.max(1, column);
    return span > 0 ? "Columns " + column + " to " + (column + span - 1)
                    : "Column " + column + " to the end";
}

function describeMarker() {
    if (!options.marker) { return "No text set yet"; }
    var span = parseCount(options.span, 0);
    if (isNaN(span)) { return "Not a number"; }
    return span > 0 ? span + " characters after “" + options.marker + "”"
                    : "Everything after “" + options.marker + "”";
}

// What the sort is about to compare, on the first few lines it will compare it on.
//
// This is the whole reason a column can be typed into a box at all: "column 5" is a guess
// until something shows what is at column 5. It is a hint and it can be stale — the panel
// is not redrawn when the caret moves — which is what the Refresh action beside Sort is
// for, and why nothing depends on it being current.
function previewNodes() {
    if (options.key === "line") { return []; }
    var p = plan({});
    if (p.error) { return []; }

    var lines = previewLines();
    if (lines === null) {
        return [{ type: "text", text: "This file is too large to preview a key from." }];
    }
    if (!lines.length) { return []; }

    var rows = lines.map(function (line, index) {
        var key = keyOf(line, p);
        return {
            id: "preview:" + index,
            title: key || "Nothing there",
            detail: line.replace(/^\s+/, "") || "(blank line)",
            symbol: key ? "text.alignleft" : "questionmark",
            badge: key ? null : "none",
            badgeTint: key ? null : "warning"
        };
    });
    return [{ type: "section", id: "preview", title: "What will be compared",
              collapsed: false, children: [{ type: "rows", rows: rows }] }];
}

// The first few lines of the range, read the cheapest way each scope allows: by line number
// where the range is stated in line numbers, and out of the document only for a selection,
// whose first line cannot be found without looking backwards from an offset.
function previewLines() {
    if (!linelark.fileName()) { return []; }
    var lines = [];
    var n;

    if (options.scope === "file") {
        var count = Math.min(PREVIEW_LINES, linelark.lineCount());
        for (n = 1; n <= count; n++) { lines.push(linelark.line(n)); }
        return lines;
    }

    if (options.scope === "lines") {
        var parsed = parseLines(options.lines);
        if (!parsed) { return []; }
        var total = linelark.lineCount();
        for (n = parsed.first; n <= total && lines.length < PREVIEW_LINES; n++) {
            if (parsed.last !== 0 && n > parsed.last) { break; }
            lines.push(linelark.line(n));
        }
        return lines;
    }

    var selection = linelark.selectionRange();
    if (!selection || selection.length === 0) { return []; }
    if (linelark.length() > PREVIEW_LIMIT) { return null; }
    var range = expandToLines(selection, linelark.text());
    return linelark.getRange(range.location, range.length).split("\n").slice(0, PREVIEW_LINES);
}

function optionNodes() {
    return [{
        type: "rows",
        rows: [
            // Two rows rather than a "Descending" checkbox: the direction is a choice
            // between two answers, and a box that has to be *unticked* to get the ordinary
            // one reads as an option rather than as half of a pair.
            choiceRow("order:up", "Ascending", !options.descending, "A to Z, 1 to 9"),
            choiceRow("order:down", "Descending", options.descending, "Z to A, 9 to 1"),
            toggleRow("option:ignoreCase", "Ignore case", options.ignoreCase,
                      "a and A together"),
            toggleRow("option:numeric", "Numbers as numbers", options.numeric,
                      "item2 before item10"),
            toggleRow("option:trim", "Ignore leading blanks", options.trim,
                      "Indentation does not count"),
            toggleRow("option:unique", "Remove duplicates", options.unique,
                      "Keep the first of identical lines")
        ]
    }];
}

// Never disabled for want of a selection: see the note at the top. It is disabled only for
// the two things the panel can actually watch — a read-only tab, and a line range that does
// not parse — both of which it redraws for.
// The two reasons a run cannot happen that the panel is actually redrawn for.
function canEdit() {
    return !!linelark.fileName() && !linelark.isReadOnly();
}

function sortButton() {
    var range = options.scope === "lines" ? parseLines(options.lines) : null;
    var title = "Sort the selected lines";
    if (options.scope === "file") {
        title = "Sort all " + linelark.lineCount() + " lines";
    } else if (options.scope === "lines") {
        // Not `describeLines()` when it does not parse: "Sort not a range" is a button
        // saying something about itself that it means about the box above it.
        title = range ? "Sort " + describeLines().toLowerCase() : "Sort a line range";
    }
    return {
        type: "button", id: "sort", title: title, symbol: "arrow.up.arrow.down",
        prominent: true,
        enabled: canEdit() && (options.scope !== "lines" || !!range)
    };
}

function panelNodes() {
    if (!linelark.fileName()) {
        return [
            { type: "heading", text: "No document" },
            { type: "text", text: "Open a file to sort part of it." }
        ];
    }

    var nodes = [{ type: "heading", text: linelark.fileName() }];
    if (linelark.isReadOnly()) {
        nodes.push({ type: "text", text: "This tab is read-only, so nothing here can "
                                       + "change it.", style: "primary" });
    }

    nodes.push({ type: "section", id: "range", title: "Which lines", collapsed: false,
                 children: rangeNodes() });
    nodes.push({ type: "section", id: "key", title: "Sort by", collapsed: false,
                 children: keyNodes() });
    nodes.push({ type: "section", id: "options", title: "How", collapsed: false,
                 children: optionNodes() });

    nodes.push(sortButton());
    nodes.push({
        type: "actions",
        actions: [
            { id: "reverse", title: "Reverse these lines instead", symbol: "arrow.uturn.up",
              enabled: canEdit() },
            { id: "refresh", title: "Draw this panel again", symbol: "arrow.clockwise" },
            { id: "reset", title: "Back to the default settings",
              symbol: "arrow.counterclockwise" }
        ]
    });

    if (outcome) {
        nodes.push({ type: "heading", text: outcome.ok ? "Done" : "Cannot sort" });
        nodes.push({ type: "text", text: outcome.text,
                     style: outcome.ok ? "secondary" : "primary" });
    }
    return nodes;
}

linelark.addPanel({
    id: "sort",
    title: "Sort",
    symbol: "arrow.up.arrow.down",
    // The right dock, because this describes the document in front of you rather than the
    // project around it — the same reason a file tree belongs on the left.
    side: "right",
    render: panelNodes,

    onSelect: function (id) {
        var cut = id.indexOf(":");
        var group = cut === -1 ? id : id.slice(0, cut);
        var value = cut === -1 ? "" : id.slice(cut + 1);

        if (group === "scope") {
            options.scope = value;
        } else if (group === "key") {
            options.key = value;
        } else if (group === "order") {
            options.descending = value === "down";
        } else if (group === "option") {
            options[value] = !options[value];
        } else if (id === "sort") {
            return run({});
        } else if (id === "reverse") {
            return run({ reverse: true });
        } else if (id === "reset") {
            options = copyOptions(DEFAULTS);
            outcome = null;
        } else if (id === "refresh") {
            outcome = null;
        } else {
            return;
        }
        // Clicking a row does not redraw the panel by itself — the host hands the click over
        // and leaves the plugin to say whether anything changed.
        linelark.refreshPanels();
    },

    onSubmit: function (id, value) {
        // Kept exactly as typed, so a box holding something unparseable keeps holding it and
        // can be corrected, rather than being emptied by the redraw that reports the problem.
        if (id === "lines" || id === "column" || id === "marker" || id === "span") {
            options[id] = value;
            outcome = null;
        }
    }
});

// MARK: - Commands
//
// The same sort from the Plugins menu, over the selection — which is what their titles say,
// and why the panel's range setting is the one thing they do not take from it. Everything
// else they do take: the panel is where a sort is configured, and a menu item that ignored
// the settings sitting open beside it would be the surprise.
linelark.addCommand("sort", "Sort Selected Lines", function () {
    run({ scope: "selection" });
});

linelark.addCommand("sortUnique", "Sort Selected Lines and Remove Duplicates", function () {
    run({ scope: "selection", unique: true });
});

linelark.addCommand("reverse", "Reverse Selected Lines", function () {
    run({ scope: "selection", reverse: true });
});
