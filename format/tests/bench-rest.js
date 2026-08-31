function timeIt(label, text, fn) {
    var kb = text.length / 1024;
    var runs = 5, t = Date.now();
    for (var r = 0; r < runs; r++) { fn(text); }
    var each = (Date.now() - t) / runs;
    print("  " + label + ": " + kb.toFixed(0) + " KB in " + each.toFixed(1) + " ms ("
          + (each / kb).toFixed(3) + " ms/KB)");
}
var OPT = { unit: "    ", newline: "\n" };

var css = [];
for (var i = 0; i < 12000; i++) {
    css.push('.rule-' + i + ' .nested > .child:hover {\n  color: #ff' + (i % 10) + '000;\n'
        + '  background: url(images/thing-' + i + '.png) no-repeat center;\n'
        + '  transition: all 0.2s ease-in-out;\n}\n');
}
timeIt("CSS      ", css.join("\n"), function (t) { return formatCSS(t, OPT); });

var js = [];
for (var j = 0; j < 14000; j++) {
    js.push('function handler' + j + '(a, b) {\n    if (a > b) {\n        return {\n'
        + '            name: "value ' + j + '",\n            items: [1, 2, 3]\n        };\n'
        + '    }\n    return null;   \n}\n');
}
var jsText = js.join("\n");
timeIt("Reindent ", jsText, function (t) { return reindent(t, "javascript.js", OPT); });
timeIt("Tidy     ", jsText, function (t) { return tidy(t, "javascript.js"); });
