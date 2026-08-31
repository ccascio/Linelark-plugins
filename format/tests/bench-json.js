// A document shaped like real data: many small objects, long string values, deep-ish nesting.
function makeJSON(records) {
    var rows = [];
    for (var i = 0; i < records; i++) {
        rows.push('{"id":' + i + ',"name":"Record number ' + i + ' with a reasonably long '
            + 'string value attached to it","tags":["alpha","beta","gamma"],"nested":'
            + '{"a":1.5,"b":null,"c":true,"d":{"e":[1,2,3,4,5]}},"note":"a second long '
            + 'string, because slice-emitting is supposed to make these nearly free"}');
    }
    return '{"records":[' + rows.join(",") + ']}';
}
var OPT = { unit: "    ", newline: "\n" };
[500, 2000, 8000].forEach(function (records) {
    var minified = makeJSON(records);
    var kb = (minified.length / 1024);
    // Format the *pretty* form too: that is the realistic case, a file already on disk.
    var pretty = formatJSON(minified, OPT, false);
    var prettyKB = pretty.length / 1024;

    var t0 = Date.now();
    var runs = 5;
    for (var r = 0; r < runs; r++) { formatJSON(pretty, OPT, false); }
    var each = (Date.now() - t0) / runs;

    var t1 = Date.now();
    for (var r2 = 0; r2 < runs; r2++) { formatJSON(pretty, OPT, true); }
    var eachMin = (Date.now() - t1) / runs;

    print(prettyKB.toFixed(0) + " KB pretty  format " + each.toFixed(1) + " ms ("
        + (each / prettyKB).toFixed(3) + " ms/KB)   minify " + eachMin.toFixed(1) + " ms");
});
