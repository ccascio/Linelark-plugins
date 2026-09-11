function open(text, language, path) {
    __doc.text = text; __doc.language = language; __doc.path = path || null;
    __doc.readOnly = false; __doc.sel = 0; __doc.edits = 0;
    __log = [];
}
function run(id) { __commands[id].run(); }
function lastLog() { return __log.length ? __log[__log.length - 1] : ""; }

check("registered four commands", Object.keys(__commands).sort().join(","),
      "format.document,format.minify,format.reindent,format.tidy");
check("registered one panel", __panels.length, 1);
check("panel is in the right dock", __panels[0].side, "right");
check("registered one context menu item", __menu.length, 1);

// End to end, through the same entry points the menu uses.
open('{"a":1,"b":[2,3]}', "json", "/tmp/x.json");
run("format.document");
check("json formatted", __doc.text, '{\n    "a": 1,\n    "b": [\n        2,\n        3\n    ]\n}');
check("one edit", __doc.edits, 1);

run("format.document");
check("second run is a no-op", __doc.edits, 1);
check("and says so", lastLog(), "Format: already formatted.");

open('{"a":1}\n', "json", "/tmp/x.json");
run("format.document");
check("trailing newline kept", __doc.text.charAt(__doc.text.length - 1), "\n");

open('{"a":1}', "json", "/tmp/x.json");
run("format.document");
check("no trailing newline invented", __doc.text.charAt(__doc.text.length - 1), "}");

open('{"a":1,}', "json", "/tmp/x.json");
run("format.minify");
check("minified", __doc.text, '{"a":1}');

open('{"a":}', "json", "/tmp/x.json");
run("format.document");
check("refusal names the place", lastLog(),
      "Format stopped: A key with no value. (line 1, column 6)");
check("and nothing was written", __doc.text, '{"a":}');

open('<a><b/></a>', "xml", "/tmp/x.xml");
run("format.document");
check("xml formatted", __doc.text, '<a>\n    <b/>\n</a>');

open('a{color:red}', "css", "/tmp/x.scss");
run("format.document");
check("scss formatted", __doc.text, 'a {\n    color: red;\n}');

// A .json the editor opened as plain text still formats, via the extension.
open('{"a":1}', "normal", "/tmp/config.json");
run("format.document");
check("extension fallback", __doc.text, '{\n    "a": 1\n}');

open('# x\n', "markdown", "/tmp/x.md");
run("format.document");
check("markdown refusal names only what really applies",
      lastLog().indexOf("Tidy Whitespace is on the Plugins menu.") > 0, true);
check("and does not promise Reindent, which Markdown cannot have",
      lastLog().indexOf("Reindent") < 0, true);
check("markdown untouched", __doc.text, '# x\n');

// Python has no Format, but it does have a Reindent now, and the sentence has to say so.
open('def f():\n    pass\n', "python", "/tmp/x.py");
run("format.document");
check("python refusal offers Reindent",
      lastLog().indexOf("Reindent and Tidy Whitespace are on the Plugins menu.") > 0, true);
check("python untouched by Format", __doc.text, 'def f():\n    pass\n');
run("format.reindent");
check("python reindented", __doc.text, 'def f():\n    pass\n');

// The four code languages format, and a .jsx does not — it is JavaScript to the editor and
// a grammar this plugin does not read.
open('func f(){\nlet a=[1,2]\n}\n', "swift", "/tmp/x.swift");
run("format.document");
check("swift formatted", __doc.text, 'func f() {\n    let a = [1, 2]\n}\n');
run("format.minify");
check("swift minify refused", lastLog().indexOf("not offered for Swift") > 0, true);

open('const a=1\n', "javascript.js", "/tmp/app.jsx");
run("format.document");
check("jsx refused", lastLog().indexOf("No formatter") < 0
      && lastLog().indexOf("nothing here formats") > 0, true);
check("jsx untouched", __doc.text, 'const a=1\n');

open('const a=1;\n', "typescript", "/tmp/x.ts");
run("format.document");
check("ts formatted", __doc.text, 'const a = 1;\n');

// A .vue is lexed as JavaScript by the editor and is markup by construction.
open('<div><p>hi</p></div>\n', "javascript.js", "/tmp/x.vue");
run("format.document");
check("vue formatted as HTML", __doc.text, '<div>\n    <p>hi</p>\n</div>\n');

open('a{color:red}', "css", "/tmp/x.css");
run("format.minify");
check("css minify refused", lastLog().indexOf("not offered for CSS") > 0, true);

open('function f() {\nreturn 1;\n}\n', "javascript.js", "/tmp/x.js");
run("format.reindent");
check("js reindented", __doc.text, 'function f() {\n    return 1;\n}\n');

open('a = 1   \n\n\n\nb = 2\n', "python", "/tmp/x.py");
run("format.tidy");
check("python tidied", __doc.text, 'a = 1\n\nb = 2\n');

open('{"a":1}', "json", "/tmp/x.json");
__doc.readOnly = true;
run("format.document");
check("read-only refused", lastLog(), "Format: this tab is read-only.");
check("read-only untouched", __doc.text, '{"a":1}');

// The panel renders, and keeps its shape while the settings change under it.
open('{"a":1}', "json", "/tmp/x.json");
var nodes = __panels[0].render();
check("panel draws", nodes.length > 0, true);
var shape = nodes.map(function (n) { return n.type; }).join(",");
__panels[0].onSelect("useTabs");
__panels[0].onSelect("collapseBlanks");
var after = __panels[0].render();
check("panel shape is stable across setting changes",
      after.map(function (n) { return n.type; }).join(","), shape);
check("last node is always the status line", after[after.length - 1].type, "text");
__panels[0].onSelect("useTabs"); __panels[0].onSelect("useSpaces");
__panels[0].onSelect("collapseBlanks");

// Settings survive a reload, because they go through the store.
__panels[0].onSubmit("indent", "2");
check("indent stored", JSON.parse(__store["settings"]).indent, "2");
open('{"a":1}', "json", "/tmp/x.json");
run("format.document");
check("stored indent is used", __doc.text, '{\n  "a": 1\n}');
__panels[0].onSubmit("indent", "4");

// Every SF Symbol the panel names, collected so the README can list what to check by hand:
// a mistyped symbol draws nothing at all, and nothing here can resolve one.
var symbols = {};
function collect(list) {
    for (var i = 0; i < list.length; i++) {
        var n = list[i];
        if (n.symbol) { symbols[n.symbol] = 1; }
        if (n.type === "actions") { collect(n.actions); }
        if (n.type === "rows") { collect(n.rows); }
        if (n.type === "section") { collect(n.children); }
    }
}
collect(__panels[0].render());
symbols[__panels[0].symbol] = 1;
print("symbols used: " + Object.keys(symbols).sort().join(" "));


// A byte-order mark is split off before the scanner runs and put back after, because none of
// the scanners expect one and all of them would refuse the document it leads.
open('﻿{"a":1}', "json", "/tmp/bom.json");
run("format.document");
check("BOM survives formatting", __doc.text, '﻿{\n    "a": 1\n}');
check("BOM did not become content", __doc.text.charCodeAt(0), 0xFEFF);


// --- The panel's two states ---
//
// A file nothing formats gets a statement and the list of what would work, rather than the
// whole panel with its controls greyed out. Nothing about a dim button says what would make
// it available, and the sentence that used to stand in for that was only half true: it
// promised Reindent on files whose blocks are not brackets.

function typesOf(nodes) { return nodes.map(function (n) { return n.type; }).join(","); }

open('# x\n', "markdown", "/tmp/x.md");
var dead = __panels[0].render();
check("unsupported panel says so first", dead[0].text, "No formatter for this file.");
check("unsupported panel offers no controls", typesOf(dead), "text,text,rows,text");
check("unsupported panel names only Tidy for Markdown", dead[1].text,
      "Tidy Whitespace is on the Plugins menu.");
check("unsupported panel lists every formatter",
      dead[2].rows.map(function (r) { return r.title; }).join(","),
      "JSON,XML,HTML,CSS,Swift, Java, JavaScript, TypeScript");
check("the code row is derived from the same table the dispatch uses",
      dead[2].rows[4].detail, ".swift  .java  .js  .mjs  .cjs  .ts  .mts  .cts");
check("the list is derived, so JSON's extensions are the dispatch table's",
      dead[2].rows[0].detail, ".json  .jsonc  .ipynb  .webmanifest");
check("a long list is capped rather than truncated silently",
      dead[2].rows[1].detail.indexOf("more") > 0, true);
check("status line is still last", dead[dead.length - 1].type, "text");

// A language that Reindent *does* handle gets told so, even with no Format behind it.
open('def f():\n    pass\n', "python", "/tmp/x.py");
check("python is told about Reindent too", __panels[0].render()[1].text,
      "Reindent and Tidy Whitespace are on the Plugins menu.");

// A code language gets the full panel, and it says which language it thinks this is.
open('func f() {\n}\n', "swift", "/tmp/x.swift");
var code = __panels[0].render();
check("code panel keeps its controls", typesOf(code),
      "text,button,actions,section,section,text");
check("code panel names the language", code[0].text,
      "Formats as Swift — indentation and spacing.");
check("code panel offers Reindent", code[2].actions[1].enabled, true);
check("code panel refuses Minify", code[2].actions[0].enabled, false);

// The supported state is unchanged, and still shape-stable.
open('{"a":1}', "json", "/tmp/x.json");
var live = __panels[0].render();
check("supported panel keeps its controls", typesOf(live),
      "text,button,actions,section,section,text");
check("supported panel enables Format", live[1].enabled, true);

// Switching between the two states must not leave a field behind in the wrong place. There
// are no fields at all in the unsupported state, which is what makes that safe: a box's
// typed text belongs to the nth node, and there is no nth node to misdeliver it to.
function fieldsIn(nodes) {
    var found = [];
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].type === "field") { found.push(nodes[i].id); }
        if (nodes[i].type === "section") {
            found = found.concat(fieldsIn(nodes[i].children));
        }
    }
    return found;
}
check("no fields in the unsupported state", fieldsIn(dead).length, 0);
check("the fields come back where they were", fieldsIn(live).join(","), "indent,maxBlankLines");
report();
