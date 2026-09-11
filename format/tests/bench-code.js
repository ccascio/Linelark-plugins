// The code formatter, with the JIT off — the engine a plugin actually gets. There is no
// size cap anywhere in this plugin and no watchdog to save one that takes too long, so the
// margin has to be measured rather than hoped for. `document-preview` measured vendored
// marked at ~2 ms/KB under these conditions; that is the number to beat.
//
// Format Document is two passes over the document, so it is timed as one and its halves are
// timed beside it — the spacing pass tokenizes exactly and Reindent scans cheaply, and it
// is worth seeing which of them costs what.

function timeIt(label, text, fn) {
    var kb = text.length / 1024;
    var runs = 5, t = Date.now();
    for (var r = 0; r < runs; r++) { fn(text); }
    var each = (Date.now() - t) / runs;
    print("  " + label + ": " + kb.toFixed(0) + " KB in " + each.toFixed(1) + " ms ("
          + (each / kb).toFixed(3) + " ms/KB)");
}
var OPT = { unit: "    ", newline: "\n" };

var swift = [];
for (var i = 0; i < 9000; i++) {
    swift.push('struct Row' + i + ': View {\n    let title: String\n'
        + '    var body: some View {\n        HStack(spacing: 8) {\n'
        + '            Text(title)\n                .font(.headline)\n'
        + '                .foregroundStyle(.primary)\n            Spacer()\n'
        + '        }\n    }\n    func score(_ n: Int) -> Int {\n'
        + '        switch n {\n        case 0:\n            return -1\n'
        + '        default:\n            return n * 2 + ' + i + '\n        }\n    }\n}\n');
}
var swiftText = swift.join("\n");
timeIt("Swift    ", swiftText, function (t) { return formatCode(t, "swift", OPT); });
timeIt("  spacing", swiftText, function (t) { return respace(t, "swift"); });
timeIt("  indent ", swiftText, function (t) { return reindent(t, "swift", OPT); });

var ts = [];
for (var j = 0; j < 11000; j++) {
    ts.push('export function handler' + j + '(a: number, b: string): Result<number> {\n'
        + '    const items = [1, 2, 3].map((x) => x * ' + j + ');\n'
        + '    if (a > 0 && b !== "") {\n        return { ok: true, value: a / 2, items };\n'
        + '    }\n    return { ok: false, value: null, items: [] };\n}\n');
}
var tsText = ts.join("\n");
timeIt("TypeScript", tsText, function (t) { return formatCode(t, "typescript", OPT); });

var py = [];
for (var k = 0; k < 16000; k++) {
    py.push('def handler' + k + '(a, b):\n    # a note about it\n    if a > b:\n'
        + '        return {\n            "name": "value ' + k + '",\n'
        + '            "items": [1, 2, 3],\n        }\n    return None\n');
}
timeIt("Python   ", py.join("\n"), function (t) { return reindent(t, "python", OPT); });
