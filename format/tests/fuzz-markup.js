var OPT = { unit: "  ", newline: "\n" };
var pieces = ['<a>', '</a>', '<b>', '</b>', '<c/>', 'text', ' ', '\n  ', '<!-- c -->',
              '<a x="1">', '</c>', '<?pi?>', '<![CDATA[z]]>', '<li>', '</li>', '<ul>',
              '</ul>', '<p>', '</p>', '<span>', '</span>', '<div>', '</div>', '<br>',
              '<pre>', '</pre>', '<script>x<y</script>', '<td>', '</tr>', '<tr>'];
var seed = 987654321;
function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }
function strip(s) { return s.replace(/\s+/g, ""); }

var modes = [["xml", false], ["html", true]];
for (var m = 0; m < modes.length; m++) {
    var bad = 0, threw = 0, shown = 0;
    for (var trial = 0; trial < 5000; trial++) {
        var parts = [];
        var howMany = 1 + rnd(14);
        for (var k = 0; k < howMany; k++) { parts.push(pieces[rnd(pieces.length)]); }
        var input = parts.join("");
        var output;
        try { output = formatMarkup(input, OPT, modes[m][1], false); }
        catch (e) { threw++; continue; }
        if (strip(input) !== strip(output)) {
            bad++;
            if (shown++ < 3) {
                print("  LOSS " + JSON.stringify(input));
                print("    -> " + JSON.stringify(output));
            }
        }
        // And formatting twice must equal formatting once.
        var again;
        try { again = formatMarkup(output, OPT, modes[m][1], false); } catch (e2) { again = output; }
        if (again !== output && shown < 6) {
            print("  UNSTABLE " + JSON.stringify(input));
            print("    once -> " + JSON.stringify(output));
            print("    twice-> " + JSON.stringify(again));
            shown += 3;
        }
    }
    print(modes[m][0] + ": 5000 trials, " + bad + " lost characters, " + threw + " refused");
}
