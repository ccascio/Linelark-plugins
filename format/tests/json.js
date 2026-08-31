var OPT = { unit: "  ", newline: "\n" };
function f(t) { return formatJSON(t, OPT, false); }
function m(t) { return formatJSON(t, OPT, true); }

check("object", f('{"a":1,"b":2}'), '{\n  "a": 1,\n  "b": 2\n}');
check("nested", f('{"a":{"b":[1,2]}}'), '{\n  "a": {\n    "b": [\n      1,\n      2\n    ]\n  }\n}');
check("empty object", f('{ }'), '{}');
check("empty array", f('[  ]'), '[]');
check("empty nested", f('{"a":{},"b":[]}'), '{\n  "a": {},\n  "b": []\n}');
check("top-level scalar", f(' 42 '), '42');
check("already formatted is idempotent", f(f('{"a":[1,{"b":null}]}')), f('{"a":[1,{"b":null}]}'));

// The whole reason this is a token scanner and not JSON.parse/stringify.
check("1.0 survives", f('{"a":1.0}'), '{\n  "a": 1.0\n}');
check("1e3 survives", f('{"a":1e3}'), '{\n  "a": 1e3\n}');
check("big integer survives", f('{"a":12345678901234567890}'), '{\n  "a": 12345678901234567890\n}');
check("key order survives", f('{"2":"a","b":"c","1":"d"}'),
      '{\n  "2": "a",\n  "b": "c",\n  "1": "d"\n}');
check("duplicate keys survive", f('{"a":1,"a":2}'), '{\n  "a": 1,\n  "a": 2\n}');
check("-0 survives", f('[-0]'), '[\n  -0\n]');
// And what JSON.parse/JSON.stringify does to the same five inputs, for the README.
print("round trip 1.0        -> " + JSON.stringify(JSON.parse('{"a":1.0}')));
print("round trip 1e3        -> " + JSON.stringify(JSON.parse('{"a":1e3}')));
print("round trip big int    -> " + JSON.stringify(JSON.parse('{"a":12345678901234567890}')));
print("round trip key order  -> " + JSON.stringify(JSON.parse('{"2":"a","b":"c","1":"d"}')));
print("round trip duplicates -> " + JSON.stringify(JSON.parse('{"a":1,"a":2}')));

// Strings are copied, never interpreted.
check("escapes untouched", f('{"a":"x\\u00e9\\n\\\\ \\" y"}'), '{\n  "a": "x\\u00e9\\n\\\\ \\" y"\n}');
check("brace inside string", f('{"a":"{not a brace}"}'), '{\n  "a": "{not a brace}"\n}');
check("literal tab in string tolerated", f('{"a":"x\ty"}'), '{\n  "a": "x\ty"\n}');

// Comments, which every hand-maintained settings file has.
check("own-line comment", f('{\n// why\n"a":1}'), '{\n  // why\n  "a": 1\n}');
check("trailing comment", f('{"a":1, // why\n"b":2}'), '{\n  "a": 1, // why\n  "b": 2\n}');
check("block comment", f('{/* x */"a":1}'), '{\n  /* x */\n  "a": 1\n}');
check("comment before close", f('{"a":1\n// last\n}'), '{\n  "a": 1\n  // last\n}');
check("value after line comment goes to its own line", f('[1, // c\n2]'), '[\n  1, // c\n  2\n]');

// Trailing commas are tolerated on the way in and dropped on the way out.
check("trailing comma dropped", f('[1,2,]'), '[\n  1,\n  2\n]');
check("trailing comma in object", f('{"a":1,}'), '{\n  "a": 1\n}');

// Minifying.
check("minify", m('{ "a" : [ 1, 2 ] }'), '{"a":[1,2]}');
check("minify drops comments", m('{"a":1 // c\n}'), '{"a":1}');
check("minify keeps string spacing", m('{"a":" x "}'), '{"a":" x "}');

// Refusals, which is the half that keeps a broken file from being rewritten into a
// well-shaped broken file.
checkRefusal("unclosed", function () { f('{"a":1'); }, "unclosed");
checkRefusal("mismatched", function () { f('{"a":1]'); }, "Closed with");
checkRefusal("single quotes", function () { f("{'a':1}"); }, "single quotes");
checkRefusal("bad escape", function () { f('{"a":"\\q"}'); }, "escape JSON does not have");
checkRefusal("short \\u", function () { f('{"a":"\\u12"}'); }, "four hex digits");
checkRefusal("leading zero", function () { f('[007]'); }, "leading zero");
checkRefusal("negative leading zero", function () { f('[-007]'); }, "leading zero");
checkRefusal("bare exponent", function () { f('[1e]'); }, "after its exponent");
checkRefusal("bare decimal", function () { f('[1.]'); }, "decimal point");
checkRefusal("NaN", function () { f('[NaN]'); }, "no NaN");
checkRefusal("two top-level values", function () { f('{} {}'); }, "second value at the top level");
checkRefusal("unterminated string", function () { f('{"a":"x}'); }, "no closing quote");
checkRefusal("string over a newline", function () { f('{"a":"x\ny"}'); }, "off the end of its line");
checkRefusal("key with no colon", function () { f('{"a"}'); }, "Expected \":\" here");
checkRefusal("key with no value", function () { f('{"a":}'); }, "key with no value");
check("block comment between key and value", f('{"a": /*n*/ 1}'), '{\n  "a": /*n*/ 1\n}');
check("comment after opener goes to its own line", f('{/* x */"a":1}'), '{\n  /* x */\n  "a": 1\n}');
checkRefusal("empty document", function () { f('   '); }, "no JSON");
checkRefusal("unopened close", function () { f('}'); }, "nothing open");
checkRefusal("stray comma", function () { f('[,1]'); }, "no value to separate");
checkRefusal("unquoted key", function () { f('{a:1}'); }, "not a quoted string");

// -0 is a number JSON.parse also survives, but 1.0 is not; check the digit scanner on a
// spread of shapes rather than trusting the three above.
var numbers = ["0", "-0", "1", "-1", "0.5", "-0.5", "1e10", "1E10", "1e+10", "1e-10",
               "1.5e10", "0.0", "100", "1000000000000000000000"];
for (var i = 0; i < numbers.length; i++) {
    check("number " + numbers[i], f("[" + numbers[i] + "]"), "[\n  " + numbers[i] + "\n]");
}
report();
