var OPT = { unit: "    ", newline: "\n" };
function ri(t, lang) { return reindent(t, lang || "javascript.js", OPT); }
function td(t, lang) { return tidy(t, lang || "javascript.js"); }

// --- Reindent ---
check("basic braces", ri('function f() {\nvar a = 1;\n}'),
      'function f() {\n    var a = 1;\n}');
check("nested", ri('if (a) {\nif (b) {\nx();\n}\n}'),
      'if (a) {\n    if (b) {\n        x();\n    }\n}');
check("closing bracket dedents", ri('var a = [\n1,\n2\n];'), 'var a = [\n    1,\n    2\n];');
check("continuation inside parens", ri('f(\na,\nb\n);'), 'f(\n    a,\n    b\n);');
// Brackets opened on one line are one level, not one each. `defineConfig({` is the shape
// of nearly every JavaScript config file there is, and counting both would bring a
// two-space file back at eight.
check("two brackets on a line are one level",
      ri('export default defineConfig({\nfoo: 1,\n})'),
      'export default defineConfig({\n    foo: 1,\n})');
check("a callback argument is one level",
      ri("test('x', () => {\nassert(1);\n});"), "test('x', () => {\n    assert(1);\n});");
check("brackets on separate lines are a level each",
      ri('const a = {\nb: [\n1\n]\n};'), 'const a = {\n    b: [\n        1\n    ]\n};');
check("a closing line takes the level of the line its bracket opened on",
      ri('const a = {b: [\n1\n]};'), 'const a = {b: [\n    1\n]};');

check("over-indented is fixed", ri('function f() {\n            var a = 1;\n      }'),
      'function f() {\n    var a = 1;\n}');
check("blank lines emptied", ri('a() {\n   \nb();\n}'), 'a() {\n\n    b();\n}');
check("tabs become the unit", ri('function f() {\n\t\t\tvar a = 1;\n}'),
      'function f() {\n    var a = 1;\n}');
check("idempotent", ri(ri('if(a){\nb();\n}')), ri('if(a){\nb();\n}'));

// Brackets inside strings and comments must not count.
check("brace in a string ignored", ri('if (a) {\nvar s = "}";\nvar t = 1;\n}'),
      'if (a) {\n    var s = "}";\n    var t = 1;\n}');
check("brace in a line comment ignored", ri('if (a) {\n// }\nvar t = 1;\n}'),
      'if (a) {\n    // }\n    var t = 1;\n}');
check("brace in a block comment ignored", ri('if (a) {\n/* } */\nvar t = 1;\n}'),
      'if (a) {\n    /* } */\n    var t = 1;\n}');
check("block comment body untouched", ri('if (a) {\n/* one\n   two */\nx();\n}'),
      'if (a) {\n    /* one\n   two */\n    x();\n}');
check("template literal body untouched", ri('if (a) {\nvar s = `one\n  two`;\nx();\n}'),
      'if (a) {\n    var s = `one\n  two`;\n    x();\n}');
check("escaped quote", ri('if (a) {\nvar s = "a\\"}";\nx();\n}'),
      'if (a) {\n    var s = "a\\"}";\n    x();\n}');
check("swift triple-quoted untouched", ri('func f() {\nlet s = """\n  raw }\n  """\nx()\n}', "swift"),
      'func f() {\n    let s = """\n  raw }\n  """\n    x()\n}');
check("go raw string untouched", ri('func f() {\ns := `one\n  two`\nx()\n}', "go"),
      'func f() {\n    s := `one\n  two`\n    x()\n}');
check("crlf preserved", ri('function f() {\r\nvar a = 1;\r\n}'),
      'function f() {\r\n    var a = 1;\r\n}');
check("no trailing newline added", ri('if (a) {\nb();\n}'), 'if (a) {\n    b();\n}');

checkRefusal("markdown refused", function () { ri('# x\n', "markdown"); }, "brackets");

// --- Tidy ---
settings.trimTrailing = true;
settings.collapseBlanks = true;
settings.finalNewline = true;
settings.maxBlankLines = "1";

check("trailing whitespace", td('a = 1;   \nb = 2;\t\n'), 'a = 1;\nb = 2;\n');
check("blank runs collapsed", td('a;\n\n\n\n\nb;\n'), 'a;\n\nb;\n');
check("trailing blanks removed", td('a;\n\n\n\n'), 'a;\n');
check("final newline added", td('a;'), 'a;\n');
check("final newline not doubled", td('a;\n'), 'a;\n');
check("crlf preserved", td('a;   \r\nb;\r\n'), 'a;\r\nb;\r\n');
check("indentation untouched", td('    a;   \n'), '    a;\n');
check("whole file blank", td('\n\n\n'), '');
check("idempotent", td(td('a;   \n\n\n\nb;')), td('a;   \n\n\n\nb;'));
check("string trailing spaces kept", td('var s = `a   \nb   `;\nx;   \n'),
      'var s = `a   \nb   `;\nx;\n');
check("python docstring kept", td('s = """a   \nb   """\nx = 1   \n', "python"),
      's = """a   \nb   """\nx = 1\n');
check("unknown language still tidied", td('a;   \n\n\n\nb;   \n', "normal"), 'a;\n\nb;\n');
check("markdown hard break kept", td('one  \ntwo   \nthree\n', "markdown"),
      'one  \ntwo  \nthree\n');
check("markdown single trailing space still goes", td('one \ntwo\n', "markdown"), 'one\ntwo\n');

settings.maxBlankLines = "2";
check("two blank lines allowed", td('a;\n\n\n\n\nb;\n'), 'a;\n\n\nb;\n');
settings.maxBlankLines = "0";
check("no blank lines allowed", td('a;\n\n\nb;\n'), 'a;\nb;\n');
settings.maxBlankLines = "1";
settings.collapseBlanks = false;
check("collapsing off leaves runs", td('a;\n\n\n\nb;\n'), 'a;\n\n\n\nb;\n');
settings.collapseBlanks = true;


// --- The limits, pinned ---
//
// These record what the line scanner does *not* understand. They are here so the README's
// "Known limits" section is checked rather than remembered, and so that anything which fixes
// one of them fails loudly instead of quietly making a claim in the README untrue.

// A regex literal is told from a division by what came before it, which is the same
// question that decides whether an operator is infix. A brace inside a pattern is text.
check("brace in a regex is not structure", ri('function f() {\nvar r = /[}]/;\nvar t = 1;\n}'),
      'function f() {\n    var r = /[}]/;\n    var t = 1;\n}');
check("a slash after a value still divides", ri('function f() {\nvar q = a / b;\nvar t = 1;\n}'),
      'function f() {\n    var q = a / b;\n    var t = 1;\n}');
check("a pattern that does not close on its line is a division",
      ri('function f() {\nvar q = a / b, r = c / d;\nvar t = 1;\n}'),
      'function f() {\n    var q = a / b, r = c / d;\n    var t = 1;\n}');
check("regex after return", ri('function f() {\nif (x) {\nreturn /}/.test(s);\n}\n}'),
      'function f() {\n    if (x) {\n        return /}/.test(s);\n    }\n}');

// Template literals, by contrast, are handled — including the two cases that look as though
// they would break it.
check("nested template is fine", ri('function f() {\nvar s = `a ${`b`} c`;\nvar t = 1;\n}'),
      'function f() {\n    var s = `a ${`b`} c`;\n    var t = 1;\n}');
check("object literal in an interpolation is fine",
      ri('function f() {\nvar s = `a ${ {x:1}.x } c`;\nvar t = 1;\n}'),
      'function f() {\n    var s = `a ${ {x:1}.x } c`;\n    var t = 1;\n}');
check("apostrophe in a line comment is fine", ri("function f() {\n// don't\nvar t = 1;\n}"),
      "function f() {\n    // don't\n    var t = 1;\n}");

// A Rust raw string is read as an ordinary string, which ends at the line break.
check("single-line rust raw string is fine",
      ri('fn f() {\nlet s = r#"a } b"#;\nlet t = 1;\n}', "rust"),
      'fn f() {\n    let s = r#"a } b"#;\n    let t = 1;\n}');
check("LIMIT: multi-line rust raw string miscounts",
      ri('fn f() {\nlet s = r#"a\n} b"#;\nlet t = 1;\n}', "rust"),
      'fn f() {\n    let s = r#"a\n} b"#;\nlet t = 1;\n}');

// A here-document body is not tracked, so Tidy strips inside one.
check("LIMIT: heredoc body is trimmed",
      td('f() {\ncat <<EOF\n   indented   \nEOF\n}\n', "bash"),
      'f() {\ncat <<EOF\n   indented\nEOF\n}\n');
report();
