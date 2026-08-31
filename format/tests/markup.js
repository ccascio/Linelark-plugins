var OPT = { unit: "  ", newline: "\n" };
function x(t) { return formatMarkup(t, OPT, false, false); }
function h(t) { return formatMarkup(t, OPT, true, false); }
function xmin(t) { return formatMarkup(t, OPT, false, true); }

check("nested elements", x('<a><b/><c/></a>'), '<a>\n  <b/>\n  <c/>\n</a>');
check("indents from minified", x('<a><b><c/></b></a>'), '<a>\n  <b>\n    <c/>\n  </b>\n</a>');
check("reindents badly indented", x('<a>\n        <b/>\n  </a>'), '<a>\n  <b/>\n</a>');
check("declaration first", x('<?xml version="1.0"?><a><b/></a>'),
      '<?xml version="1.0"?>\n<a>\n  <b/>\n</a>');
check("comment", x('<a><!-- note --><b/></a>'), '<a>\n  <!-- note -->\n  <b/>\n</a>');
check("doctype", x('<!DOCTYPE html><a><b/></a>'), '<!DOCTYPE html>\n<a>\n  <b/>\n</a>');
check("attributes untouched", x('<a x="1"  y = "2" ><b/></a>'), '<a x="1"  y = "2" >\n  <b/>\n</a>');
check("gt inside attribute", x('<a t="a>b"><c/></a>'), '<a t="a>b">\n  <c/>\n</a>');
check("idempotent", x(x('<a><b><c/></b></a>')), x('<a><b><c/></b></a>'));

// The rule: an element holding text of its own is copied out exactly.
check("text-only element kept whole", x('<a><n>Ada</n></a>'), '<a>\n  <n>Ada</n>\n</a>');
check("text spacing preserved", x('<a><n>  Ada  </n></a>'), '<a>\n  <n>  Ada  </n>\n</a>');
check("mixed content untouched", x('<a><p>Hello <b>world</b>!</p></a>'),
      '<a>\n  <p>Hello <b>world</b>!</p>\n</a>');
check("multi-line text untouched", x('<a><n>one\n  two</n></a>'), '<a>\n  <n>one\n  two</n>\n</a>');
check("cdata untouched", x('<a><![CDATA[ <not> a tag ]]></a>'), '<a>\n  <![CDATA[ <not> a tag ]]>\n</a>');
check("xml:space preserve", x('<a><b xml:space="preserve"><c/>   <d/></b></a>'),
      '<a>\n  <b xml:space="preserve"><c/>   <d/></b>\n</a>');
check("xml:space only as an attribute name", x('<a><b t="xml:space"><c/></b></a>'),
      '<a>\n  <b t="xml:space">\n    <c/>\n  </b>\n</a>');
check("bare < in prose", x('<a><p>x &lt; y and a < b</p></a>'), '<a>\n  <p>x &lt; y and a < b</p>\n</a>');

// HTML.
check("void elements", h('<div><br><img src="x"><hr></div>'),
      '<div>\n  <br>\n  <img src="x">\n  <hr>\n</div>');
check("script content untouched", h('<html><script>if (a<b) { x("</div>") }</script></html>'),
      '<html>\n  <script>if (a<b) { x("</div>") }</script>\n</html>');
check("style content untouched", h('<html><style>a{color:red}</style></html>'),
      '<html>\n  <style>a{color:red}</style>\n</html>');
check("pre untouched", h('<div><pre>  a\n    b</pre></div>'), '<div>\n  <pre>  a\n    b</pre>\n</div>');
check("unclosed li", h('<ul><li>a<li>b</ul>'), '<ul>\n  <li>a\n  <li>b\n</ul>');
check("blocks are broken", h('<div><div></div><div></div></div>'),
      '<div>\n  <div></div>\n  <div></div>\n</div>');

// The whitespace-sensitivity guard: tight inline runs are left alone, spaced ones are not.
check("tight inline run kept", h('<p><span>a</span><span>b</span></p>'),
      '<p><span>a</span><span>b</span></p>');
check("spaced inline run may break", h('<div><span>a</span> <span>b</span></div>'),
      '<div>\n  <span>a</span>\n  <span>b</span>\n</div>');
check("tight block run still breaks", h('<div><div>a</div><div>b</div></div>'),
      '<div>\n  <div>a</div>\n  <div>b</div>\n</div>');
check("tight run with a block child breaks", h('<div><span>a</span><div>b</div></div>'),
      '<div>\n  <span>a</span>\n  <div>b</div>\n</div>');
// XML has no inline concept, so the same shape indents there.
check("xml has no tight rule", x('<p><span>a</span><span>b</span></p>'),
      '<p>\n  <span>a</span>\n  <span>b</span>\n</p>');

check("minify drops whitespace between tags", xmin('<a>\n  <b/>\n  <c/>\n</a>'), '<a><b/><c/></a>');
check("minify keeps text", xmin('<a>\n  <n>Ada</n>\n</a>'), '<a><n>Ada</n></a>');

checkRefusal("empty", function () { x('   '); }, "no markup");

// Malformed input must never lose a character. Fuzz it: whatever comes out, stripping all
// whitespace from input and output must give the same string when the input has no
// whitespace-only text nodes to begin with.
var pieces = ['<a>', '</a>', '<b>', '</b>', '<c/>', 'text', '<!-- c -->', '<a x="1">',
              '</c>', '<?pi?>', '<![CDATA[z]]>'];
var seed = 12345;
function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }
var fuzzFails = 0;
for (var trial = 0; trial < 800; trial++) {
    var parts = [];
    var howMany = 1 + rnd(10);
    for (var k = 0; k < howMany; k++) { parts.push(pieces[rnd(pieces.length)]); }
    var input = parts.join("");
    var output;
    try { output = x(input); } catch (e) { continue; }
    if (input.replace(/\s+/g, "") !== output.replace(/\s+/g, "")) {
        if (fuzzFails++ < 3) { print("FUZZ " + JSON.stringify(input) + " -> " + JSON.stringify(output)); }
    }
}
check("fuzz: no character is ever lost", fuzzFails, 0);
report();
