function makeXML(n) {
    var rows = [];
    for (var i = 0; i < n; i++) {
        rows.push('<record id="' + i + '" kind="sample"><name>Record ' + i + '</name>'
            + '<description>A description long enough to be worth slicing rather than '
            + 'copying character by character.</description><tags><tag>alpha</tag>'
            + '<tag>beta</tag></tags><nested><deep><deeper val="' + i + '"/></deep></nested>'
            + '</record>');
    }
    return '<?xml version="1.0"?>\n<catalogue>' + rows.join("") + '</catalogue>';
}
var OPT = { unit: "    ", newline: "\n" };
[400, 1600, 6400].forEach(function (n) {
    var pretty = formatMarkup(makeXML(n), OPT, false, false);
    var kb = pretty.length / 1024;
    var runs = 5, t = Date.now();
    for (var r = 0; r < runs; r++) { formatMarkup(pretty, OPT, false, false); }
    var each = (Date.now() - t) / runs;
    print(kb.toFixed(0) + " KB  " + each.toFixed(1) + " ms  (" + (each / kb).toFixed(3) + " ms/KB)");
});
