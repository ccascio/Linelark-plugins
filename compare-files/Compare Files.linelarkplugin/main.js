// Compare Files — a WinMerge-style two-way compare and merge tool.
//
// The host owns the diff UI: aligned columns, line numbers, previous/next difference,
// and the arrows that copy one difference over the other. This plugin owns the file
// model and the diff algorithm. Keeping that boundary means the view remains native,
// themed, keyboard-accessible and fast while the comparison policy stays replaceable
// JavaScript.
//
// A source is a snapshot of an ordinary editor tab. A merge reopens that tab, verifies
// that its live text still matches the snapshot, and applies the whole result as one edit.
// The check is important: an arrow must never overwrite typing that happened after the
// comparison was drawn. The edit is deliberately not saved; it is dirty and undoable,
// exactly like a merge made in a desktop comparison tool.

var left = null;
var right = null;
var comparison = null;
var outcome = "Choose a left and a right file from tabs you have open.";

var OPTIONS_KEY = "options";
var options = loadOptions();

function loadOptions() {
    var defaults = { whitespace: "exact", ignoreCase: false };
    var saved = linelark.storeGet(OPTIONS_KEY);
    if (!saved) { return defaults; }
    try {
        var value = JSON.parse(saved);
        if (value.whitespace === "exact" || value.whitespace === "changes" ||
            value.whitespace === "all") {
            defaults.whitespace = value.whitespace;
        }
        defaults.ignoreCase = value.ignoreCase === true;
    } catch (_) {
        // A corrupt preference should reset two harmless toggles, not stop the plugin.
    }
    return defaults;
}

function saveOptions() {
    var refusal = linelark.storeSet(OPTIONS_KEY, JSON.stringify(options));
    if (refusal) { linelark.log(refusal); }
}

// MARK: - Sources

function currentSource() {
    var path = linelark.filePath();
    if (!path) {
        outcome = "Save the current tab first. A comparison source needs a file path so a merge can return to it safely.";
        return null;
    }
    return {
        path: path,
        name: linelark.fileName() || lastPathComponent(path),
        text: linelark.text(),
        readOnly: linelark.isReadOnly()
    };
}

// A context-menu handler receives the file under the pointer, including the live buffer
// when that file is already open. It must not fall back to linelark.text(): right-clicking
// a background tab or a sidebar row deliberately does not change the active editor.
function contextualSource(target) {
    if (!target || target.kind !== "file" || !target.path ||
        typeof target.text !== "string") {
        outcome = "This comparison action needs a readable file.";
        return null;
    }
    return {
        path: String(target.path),
        name: String(target.name || lastPathComponent(target.path)),
        text: target.text,
        readOnly: target.isReadOnly === true
    };
}

function lastPathComponent(path) {
    var parts = String(path).split("/");
    return parts[parts.length - 1] || path;
}

function sameFile(a, b) {
    return !!a && !!b && a.path === b.path;
}

function useSource(source, side, openWhenReady) {
    if (!source) {
        linelark.refreshPanels();
        return false;
    }
    if (side === "left") {
        if (sameFile(source, right)) {
            outcome = "The left and right sides must be different files.";
            linelark.refreshPanels();
            return false;
        }
        left = source;
        outcome = "Left is “" + source.name + "”. Open the other tab and use it as right.";
    } else {
        if (sameFile(source, left)) {
            outcome = "The left and right sides must be different files.";
            linelark.refreshPanels();
            return false;
        }
        right = source;
        outcome = "Right is “" + source.name + "”.";
    }
    comparison = null;
    linelark.refreshPanels();
    if (openWhenReady && left && right) { showComparison(); }
    return true;
}

function useCurrent(side, openWhenReady) {
    return useSource(currentSource(), side, openWhenReady);
}

function useContextTarget(target, side, openWhenReady) {
    return useSource(contextualSource(target), side, openWhenReady);
}

function openSource(source) {
    if (source) { linelark.openFile(source.path); }
}

function readSource(source) {
    linelark.openFile(source.path);
    if (linelark.filePath() !== source.path) {
        return "Could not bring “" + source.name + "” to the front.";
    }
    source.text = linelark.text();
    source.readOnly = linelark.isReadOnly();
    source.name = linelark.fileName() || source.name;
    return null;
}

function refreshComparison() {
    if (!left || !right) {
        outcome = "Choose both files before refreshing.";
        linelark.refreshPanels();
        return;
    }
    var failure = readSource(left) || readSource(right);
    if (failure) {
        outcome = failure;
        linelark.refreshPanels();
        return;
    }
    outcome = "Refreshed both files from their live editor buffers.";
    showComparison();
}

function swapSides() {
    var held = left;
    left = right;
    right = held;
    comparison = null;
    outcome = left && right ? "Swapped left and right." : "Swapped the available source.";
    linelark.refreshPanels();
    if (left && right) { showComparison(); }
}

function clearSources() {
    left = null;
    right = null;
    comparison = null;
    outcome = "Choose a left and a right file from tabs you have open.";
    linelark.refreshPanels();
}

// MARK: - Comparing lines

function splitText(text) {
    // Linelark normalises a loaded document to \n internally. Preserve the final newline
    // separately so a merge at EOF does not silently change it.
    var finalNewline = text.length > 0 && text.charAt(text.length - 1) === "\n";
    var lines = text.split("\n");
    if (finalNewline) { lines.pop(); }
    if (text.length === 0) { lines = []; }
    return { lines: lines, finalNewline: finalNewline };
}

function joinText(parts) {
    var text = parts.lines.join("\n");
    return parts.finalNewline ? text + "\n" : text;
}

function comparisonKey(line) {
    var key = line;
    if (options.whitespace === "changes") {
        key = key.replace(/[\t ]+/g, " ").replace(/^ | $/g, "");
    } else if (options.whitespace === "all") {
        key = key.replace(/[\t ]+/g, "");
    }
    if (options.ignoreCase) { key = key.toLocaleLowerCase(); }
    return key;
}

function keyed(lines) {
    var result = new Array(lines.length);
    for (var i = 0; i < lines.length; i += 1) { result[i] = comparisonKey(lines[i]); }
    return result;
}

function equalOp(a, ai, b, bi) {
    return { type: "equal", left: a[ai], right: b[bi] };
}

function deleteOp(a, ai) {
    return { type: "delete", left: a[ai] };
}

function insertOp(b, bi) {
    return { type: "insert", right: b[bi] };
}

// Lines that occur exactly once in each range are unambiguous anchors. The longest
// increasing subsequence of their right-hand positions is the patience-diff spine.
function patienceAnchors(aKeys, aStart, aEnd, bKeys, bStart, bEnd) {
    var aSeen = Object.create(null);
    var bSeen = Object.create(null);
    var i;

    function note(table, key, position) {
        var entry = table[key];
        if (entry) { entry.count += 1; }
        else { table[key] = { count: 1, position: position }; }
    }

    for (i = aStart; i < aEnd; i += 1) { note(aSeen, "$" + aKeys[i], i); }
    for (i = bStart; i < bEnd; i += 1) { note(bSeen, "$" + bKeys[i], i); }

    var pairs = [];
    for (i = aStart; i < aEnd; i += 1) {
        var key = "$" + aKeys[i];
        if (aSeen[key].count === 1 && bSeen[key] && bSeen[key].count === 1) {
            pairs.push({ left: i, right: bSeen[key].position });
        }
    }
    if (!pairs.length) { return pairs; }

    var tails = [];
    var tailPair = [];
    var previous = new Array(pairs.length);
    for (i = 0; i < pairs.length; i += 1) {
        var lo = 0;
        var hi = tails.length;
        while (lo < hi) {
            var mid = (lo + hi) >> 1;
            if (tails[mid] < pairs[i].right) { lo = mid + 1; }
            else { hi = mid; }
        }
        tails[lo] = pairs[i].right;
        previous[i] = lo > 0 ? tailPair[lo - 1] : -1;
        tailPair[lo] = i;
    }

    var chain = [];
    var at = tailPair[tails.length - 1];
    while (at >= 0) {
        chain.push(pairs[at]);
        at = previous[at];
    }
    chain.reverse();
    return chain;
}

function valueAt(vector, diagonal) {
    return Object.prototype.hasOwnProperty.call(vector, diagonal) ? vector[diagonal] : -1;
}

// Myers is the fallback for a range with no unique patience anchors. A deliberately large
// repeated region is emitted as one replacement instead of retaining O(D²) trace memory;
// it is still one correct merge block, just without speculative line pairing inside it.
function myersRange(a, aKeys, aStart, aEnd, b, bKeys, bStart, bEnd, output) {
    var n = aEnd - aStart;
    var m = bEnd - bStart;
    if (n + m > 6000) {
        var coarse;
        for (coarse = aStart; coarse < aEnd; coarse += 1) { output.push(deleteOp(a, coarse)); }
        for (coarse = bStart; coarse < bEnd; coarse += 1) { output.push(insertOp(b, coarse)); }
        return;
    }

    var vector = { 1: 0 };
    var trace = [];
    var maximum = n + m;
    var finished = false;

    for (var distance = 0; distance <= maximum && !finished; distance += 1) {
        var next = {};
        for (var diagonal = -distance; diagonal <= distance; diagonal += 2) {
            var x;
            if (diagonal === -distance ||
                (diagonal !== distance &&
                 valueAt(vector, diagonal - 1) < valueAt(vector, diagonal + 1))) {
                x = valueAt(vector, diagonal + 1);
            } else {
                x = valueAt(vector, diagonal - 1) + 1;
            }
            if (x < 0) { x = 0; }
            var y = x - diagonal;
            while (x < n && y < m &&
                   aKeys[aStart + x] === bKeys[bStart + y]) {
                x += 1;
                y += 1;
            }
            next[diagonal] = x;
            if (x >= n && y >= m) { finished = true; break; }
        }
        trace.push(next);
        vector = next;
    }

    var reversed = [];
    var currentX = n;
    var currentY = m;
    for (var d = trace.length - 1; d > 0; d -= 1) {
        var before = trace[d - 1];
        var k = currentX - currentY;
        var previousK;
        if (k === -d || (k !== d && valueAt(before, k - 1) < valueAt(before, k + 1))) {
            previousK = k + 1;
        } else {
            previousK = k - 1;
        }
        var previousX = valueAt(before, previousK);
        if (previousX < 0) { previousX = 0; }
        var previousY = previousX - previousK;

        while (currentX > previousX && currentY > previousY) {
            currentX -= 1;
            currentY -= 1;
            reversed.push(equalOp(a, aStart + currentX, b, bStart + currentY));
        }
        if (currentX === previousX) {
            currentY -= 1;
            reversed.push(insertOp(b, bStart + currentY));
        } else {
            currentX -= 1;
            reversed.push(deleteOp(a, aStart + currentX));
        }
    }
    while (currentX > 0 && currentY > 0) {
        currentX -= 1;
        currentY -= 1;
        reversed.push(equalOp(a, aStart + currentX, b, bStart + currentY));
    }
    while (currentX > 0) {
        currentX -= 1;
        reversed.push(deleteOp(a, aStart + currentX));
    }
    while (currentY > 0) {
        currentY -= 1;
        reversed.push(insertOp(b, bStart + currentY));
    }
    reversed.reverse();
    Array.prototype.push.apply(output, reversed);
}

function patienceRange(a, aKeys, aStart, aEnd, b, bKeys, bStart, bEnd, output) {
    while (aStart < aEnd && bStart < bEnd && aKeys[aStart] === bKeys[bStart]) {
        output.push(equalOp(a, aStart, b, bStart));
        aStart += 1;
        bStart += 1;
    }

    var suffix = [];
    while (aStart < aEnd && bStart < bEnd &&
           aKeys[aEnd - 1] === bKeys[bEnd - 1]) {
        aEnd -= 1;
        bEnd -= 1;
        suffix.push(equalOp(a, aEnd, b, bEnd));
    }

    if (aStart === aEnd) {
        for (var inserted = bStart; inserted < bEnd; inserted += 1) {
            output.push(insertOp(b, inserted));
        }
    } else if (bStart === bEnd) {
        for (var deleted = aStart; deleted < aEnd; deleted += 1) {
            output.push(deleteOp(a, deleted));
        }
    } else {
        var anchors = patienceAnchors(aKeys, aStart, aEnd, bKeys, bStart, bEnd);
        if (!anchors.length) {
            myersRange(a, aKeys, aStart, aEnd, b, bKeys, bStart, bEnd, output);
        } else {
            var leftAt = aStart;
            var rightAt = bStart;
            for (var index = 0; index < anchors.length; index += 1) {
                var anchor = anchors[index];
                patienceRange(a, aKeys, leftAt, anchor.left,
                              b, bKeys, rightAt, anchor.right, output);
                output.push(equalOp(a, anchor.left, b, anchor.right));
                leftAt = anchor.left + 1;
                rightAt = anchor.right + 1;
            }
            patienceRange(a, aKeys, leftAt, aEnd, b, bKeys, rightAt, bEnd, output);
        }
    }

    for (var tail = suffix.length - 1; tail >= 0; tail -= 1) {
        output.push(suffix[tail]);
    }
}

function diffLines(leftLines, rightLines) {
    var output = [];
    var leftKeys = keyed(leftLines);
    var rightKeys = keyed(rightLines);
    patienceRange(leftLines, leftKeys, 0, leftLines.length,
                  rightLines, rightKeys, 0, rightLines.length, output);
    return output;
}

function blocksFrom(operations) {
    var blocks = [];
    var leftLine = 0;
    var rightLine = 0;
    var index = 0;
    while (index < operations.length) {
        if (operations[index].type === "equal") {
            leftLine += 1;
            rightLine += 1;
            index += 1;
            continue;
        }
        var block = {
            leftStart: leftLine,
            rightStart: rightLine,
            leftEnd: leftLine,
            rightEnd: rightLine
        };
        while (index < operations.length && operations[index].type !== "equal") {
            if (operations[index].type === "delete") { leftLine += 1; }
            else { rightLine += 1; }
            index += 1;
        }
        block.leftEnd = leftLine;
        block.rightEnd = rightLine;
        blocks.push(block);
    }
    return blocks;
}

function patchFrom(operations, leftCount, rightCount) {
    var oldStart = leftCount ? 1 : 0;
    var newStart = rightCount ? 1 : 0;
    var patch = ["@@ -" + oldStart + "," + leftCount +
                 " +" + newStart + "," + rightCount + " @@"];
    for (var i = 0; i < operations.length; i += 1) {
        var operation = operations[i];
        if (operation.type === "equal") { patch.push(" " + operation.left); }
        else if (operation.type === "delete") { patch.push("-" + operation.left); }
        else { patch.push("+" + operation.right); }
    }
    return patch.join("\n");
}

function buildComparison() {
    var leftParts = splitText(left.text);
    var rightParts = splitText(right.text);
    var operations = diffLines(leftParts.lines, rightParts.lines);
    var blocks = blocksFrom(operations);
    return {
        left: leftParts,
        right: rightParts,
        operations: operations,
        blocks: blocks,
        patch: patchFrom(operations, leftParts.lines.length, rightParts.lines.length)
    };
}

// MARK: - Showing and merging

function pairKey() {
    var paths = [left.path, right.path].sort();
    return "compare-files:" + paths[0] + "\u001f" + paths[1];
}

function showComparison(message) {
    if (!left || !right) {
        outcome = "Choose both files before comparing.";
        linelark.refreshPanels();
        return;
    }
    if (sameFile(left, right)) {
        outcome = "The left and right sides must be different files.";
        linelark.refreshPanels();
        return;
    }

    comparison = buildComparison();
    var count = comparison.blocks.length;
    var summary = count === 0 ? "The files are identical with the current options."
        : count + (count === 1 ? " difference." : " differences.");
    outcome = message || summary;
    linelark.refreshPanels();
    linelark.openDiff({
        key: pairKey(),
        name: left.name + " ↔ " + right.name,
        label: summary,
        patch: comparison.patch,
        onMerge: mergeDifference
    });
}

function mergedText(direction, block) {
    var target = direction === "left" ? comparison.left : comparison.right;
    var source = direction === "left" ? comparison.right : comparison.left;
    var targetStart = direction === "left" ? block.leftStart : block.rightStart;
    var targetEnd = direction === "left" ? block.leftEnd : block.rightEnd;
    var sourceStart = direction === "left" ? block.rightStart : block.leftStart;
    var sourceEnd = direction === "left" ? block.rightEnd : block.leftEnd;
    var lines = target.lines.slice();
    var replacement = source.lines.slice(sourceStart, sourceEnd);
    lines.splice.apply(lines, [targetStart, targetEnd - targetStart].concat(replacement));

    var finalNewline = target.finalNewline;
    // When this difference reaches both files' EOF, the source's ending is part of what
    // was taken. Otherwise the target's line-ending state is unrelated and remains its own.
    if (targetEnd === target.lines.length && sourceEnd === source.lines.length) {
        finalNewline = source.finalNewline;
    }
    return joinText({ lines: lines, finalNewline: finalNewline });
}

function mergeDifference(blockIndex, direction) {
    if (!comparison || !comparison.blocks[blockIndex]) {
        outcome = "That difference is no longer present. Refresh the comparison.";
        linelark.refreshPanels();
        return;
    }
    if (direction !== "left" && direction !== "right") {
        outcome = "The comparison asked for an unknown merge direction.";
        linelark.refreshPanels();
        return;
    }

    var target = direction === "left" ? left : right;
    var expected = target.text;
    var replacement = mergedText(direction, comparison.blocks[blockIndex]);
    linelark.openFile(target.path);

    if (linelark.filePath() !== target.path) {
        outcome = "Could not bring “" + target.name + "” to the front, so nothing was changed.";
        linelark.refreshPanels();
        return;
    }
    if (linelark.isReadOnly()) {
        outcome = "“" + target.name + "” is read-only, so nothing was changed.";
        linelark.refreshPanels();
        showComparison();
        return;
    }
    if (linelark.text() !== expected) {
        outcome = "“" + target.name + "” changed after this comparison was drawn. Refresh before merging so no newer edits are overwritten.";
        linelark.refreshPanels();
        return;
    }

    linelark.setText(replacement);
    target.text = replacement;
    target.readOnly = false;
    var message = direction === "left"
        ? "Took the right-hand difference into “" + target.name + "”. Save the file when ready."
        : "Took the left-hand difference into “" + target.name + "”. Save the file when ready.";
    showComparison(message);
}

// MARK: - Panel

function sourceRows() {
    return [
        {
            id: "open-left",
            title: left ? "Left: " + left.name : "Left: not chosen",
            detail: left ? left.path : "Open a file tab, then use it as left",
            symbol: "doc",
            badge: left && left.readOnly ? "READ ONLY" : null,
            badgeTint: left && left.readOnly ? "warning" : "neutral"
        },
        {
            id: "open-right",
            title: right ? "Right: " + right.name : "Right: not chosen",
            detail: right ? right.path : "Open a file tab, then use it as right",
            symbol: "doc",
            badge: right && right.readOnly ? "READ ONLY" : null,
            badgeTint: right && right.readOnly ? "warning" : "neutral"
        }
    ];
}

function whitespaceDetail() {
    if (options.whitespace === "changes") { return "Runs of spaces and tabs compare as one"; }
    if (options.whitespace === "all") { return "Spaces and tabs do not participate"; }
    return "Every space and tab participates";
}

function panelNodes() {
    return [
        { type: "text", text: outcome, style: "primary" },
        {
            type: "section", id: "sources", title: "Files", collapsed: false,
            children: [
                { type: "rows", rows: sourceRows() },
                {
                    type: "actions",
                    actions: [
                        { id: "use-left", title: "Use current tab as left", symbol: "arrow.left.to.line" },
                        { id: "use-right", title: "Use current tab as right", symbol: "arrow.right.to.line" },
                        { id: "swap", title: "Swap left and right", symbol: "arrow.left.arrow.right", enabled: !!(left || right) },
                        { id: "refresh", title: "Refresh both files", symbol: "arrow.clockwise", enabled: !!(left && right) },
                        { id: "clear", title: "Clear comparison", symbol: "xmark", enabled: !!(left || right), tint: "negative" }
                    ]
                },
                { type: "button", id: "compare", title: "Compare", symbol: "rectangle.split.2x1", prominent: true, enabled: !!(left && right) }
            ]
        },
        {
            type: "section", id: "options", title: "Comparison options", collapsed: false,
            children: [
                {
                    type: "rows",
                    rows: [
                        { id: "whitespace", title: "Whitespace", detail: whitespaceDetail(), symbol: "space", badge: options.whitespace.toUpperCase(), badgeTint: options.whitespace === "exact" ? "neutral" : "info" },
                        { id: "case", title: "Ignore letter case", detail: "Treat A and a as equal", symbol: options.ignoreCase ? "checkmark.square.fill" : "square", badge: options.ignoreCase ? "ON" : "OFF", badgeTint: options.ignoreCase ? "info" : "neutral" }
                    ]
                }
            ]
        },
        {
            type: "text",
            text: "Merges change the editor buffer as one undoable edit; they do not save the file. If a source changes after the diff opens, the merge is refused until Refresh.",
            style: "secondary"
        }
    ];
}

function selected(id) {
    if (id === "use-left") { useCurrent("left", false); }
    else if (id === "use-right") { useCurrent("right", false); }
    else if (id === "open-left") { openSource(left); }
    else if (id === "open-right") { openSource(right); }
    else if (id === "swap") { swapSides(); }
    else if (id === "refresh") { refreshComparison(); }
    else if (id === "clear") { clearSources(); }
    else if (id === "compare") { showComparison(); }
    else if (id === "whitespace") {
        options.whitespace = options.whitespace === "exact" ? "changes"
            : (options.whitespace === "changes" ? "all" : "exact");
        saveOptions();
        comparison = null;
        outcome = "Whitespace mode: " + options.whitespace + ".";
        linelark.refreshPanels();
        if (left && right) { showComparison(); }
    } else if (id === "case") {
        options.ignoreCase = !options.ignoreCase;
        saveOptions();
        comparison = null;
        outcome = options.ignoreCase ? "Letter case is ignored." : "Letter case is compared.";
        linelark.refreshPanels();
        if (left && right) { showComparison(); }
    }
}

linelark.addCommand("use-left", "Use Current File as Left", function () {
    useCurrent("left", false);
});

linelark.addCommand("use-right", "Use Current File as Right and Compare", function () {
    useCurrent("right", true);
});

linelark.addCommand("compare", "Show File Comparison", showComparison);
linelark.addCommand("refresh", "Refresh File Comparison", refreshComparison);
linelark.addCommand("swap", "Swap Compared Files", swapSides);

linelark.addContextMenuItem({
    id: "use-left",
    title: "Use as Left",
    locations: ["tab", "sidebar"],
    kinds: ["file"],
    handler: function (target) { useContextTarget(target, "left", false); }
});

linelark.addContextMenuItem({
    id: "use-right",
    title: "Use as Right and Compare",
    locations: ["tab", "sidebar"],
    kinds: ["file"],
    handler: function (target) { useContextTarget(target, "right", true); }
});

linelark.addPanel({
    id: "compare-files",
    title: "Compare",
    symbol: "rectangle.split.2x1",
    side: "right",
    render: panelNodes,
    onSelect: selected
});
