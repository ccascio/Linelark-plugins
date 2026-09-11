// Format Document for Swift, Java, JavaScript and TypeScript: Reindent, and the spacing
// pass §5b describes. Split in two, because the two halves fail differently — a wrong
// indent is ugly and a wrong space can stop a file compiling.

var OPT = { unit: "    ", newline: "\n" };
function fmt(t, lang) { return formatCode(t, lang || "javascript.js", OPT); }
function sp(t, lang) { return respace(t, lang || "javascript.js"); }
function ri(t, lang) { return reindent(t, lang || "javascript.js", OPT); }

// --- Spacing: the pairs that settle themselves ---

check("comma", sp('f(a ,b,c)'), 'f(a, b, c)');
check("comma before a closer stays closed up", sp('[1 , 2 , ]'), '[1, 2,]');
check("semicolon", sp('for (a=1;b<2 ;c++) {}'), 'for (a = 1; b<2; c++) {}');
check("assignment", sp('a=1'), 'a = 1');
check("compound assignment", sp('a+=1'), 'a += 1');
check("equality", sp('if (a===b) {}'), 'if (a === b) {}');
check("arrow", sp('x=>x'), 'x => x');
check("inside parens closes up", sp('f( a )'), 'f(a)');
check("inside brackets closes up", sp('a[ 0 ]'), 'a[0]');
check("call keeps its name", sp('f (x)'), 'f(x)');
check("subscript keeps its name", sp('a [0]'), 'a[0]');
check("a keyword gains its space", sp('if(x) {}'), 'if (x) {}');
check("return is a keyword too", sp('return(x)'), 'return (x)');
check("brace after a call", sp('f(){}'), 'f() {}');
check("member access closes up", sp('a . b . c'), 'a.b.c');

// A `{` is the one bracket whose inside is a house style rather than a fact, so both
// spellings survive whichever one the file already used.
check("tight braces stay tight", sp('function f(){g();}'), 'function f() {g();}');
check("spaced braces stay spaced", sp('function f() { g(); }'), 'function f() { g(); }');

// --- Spacing: prefix is not infix ---
//
// Swift is why this matters: `a - b` and `-b` are both Swift and `a -b` is not, so an
// operator spaced on one side only is a different operator.

check("unary minus after `=`", sp('let y = -x', "swift"), 'let y = -x');
check("unary minus after a comma", sp('f(a, -1)', "swift"), 'f(a, -1)');
check("unary minus after a keyword", sp('return -1', "swift"), 'return -1');
check("binary minus", sp('let y = a-b', "swift"), 'let y = a - b');
check("`*` after `(` is Swift's wildcard", sp('@available(*, deprecated)', "swift"),
      '@available(*, deprecated)');
check("`&` before a name is inout", sp('f(&x)', "swift"), 'f(&x)');
check("`&` between two is a bitwise and", sp('let m = a&b', "swift"), 'let m = a & b');
check("postfix `!` is left alone", sp('let v = a!.b', "swift"), 'let v = a!.b');
check("prefix `!`", sp('if !x {}', "swift"), 'if !x {}');

// --- Spacing: `<` and `>` are never touched ---

check("generics survive", sp('Map<String,List<String>> m;', "java"),
      'Map<String, List<String>> m;');
check("a comparison is left as written", sp('if (a<b) {}', "java"), 'if (a<b) {}');
check("a spaced comparison is left as written", sp('if (a < b) {}', "java"),
      'if (a < b) {}');
check("`>=` is not spaced, because it may be a generic and an `=`",
      sp('const x: Array<number>= [];', "typescript"), 'const x: Array<number>= [];');
check("`->` is spaced, because nothing else spells it",
      sp('func f()->Int', "swift"), 'func f() -> Int');

// --- Spacing: the three colons ---

check("type annotation", sp('let x:Int = 1', "swift"), 'let x: Int = 1');
check("object key", sp('const o = {a:1, b:2};'), 'const o = {a: 1, b: 2};');
check("dictionary type", sp('let d: [String:Int] = [:]', "swift"),
      'let d: [String: Int] = [:]');
check("case label", sp('case 1:', "java"), 'case 1:');
check("ternary is spaced on both sides", sp('let t = a ?b:c', "swift"),
      'let t = a ? b : c');
check("ternary onto an implicit member", sp('let t = flag ? .red : .blue', "swift"),
      'let t = flag ? .red : .blue');
check("an optional type is not a ternary", sp('let w: Int? = nil', "swift"),
      'let w: Int? = nil');
check("optional chaining is not a ternary", sp('let z = x?.y ?? 0', "swift"),
      'let z = x?.y ?? 0');
check("`try?` is not a ternary", sp('let u = try? g()\nlet d: [String: Int] = [:]', "swift"),
      'let u = try? g()\nlet d: [String: Int] = [:]');
check("`as?` is not a ternary", sp('let v = w as? String', "swift"),
      'let v = w as? String');
check("TypeScript's optional parameter", sp('function f(y?:string) {}', "typescript"),
      'function f(y?: string) {}');
check("a ternary inside a call keeps its own depth",
      sp('f(a, c ?x:y, b)'), 'f(a, c ? x : y, b)');
check("Java's method reference", sp('list.map(String::length);', "java"),
      'list.map(String::length);');

// --- Spacing: strings, comments and patterns are copied out exactly ---

check("a string is content", sp('var s = "a ,  b";'), 'var s = "a ,  b";');
check("a template literal is content", sp('var s = `a ${ b } c`;'), 'var s = `a ${ b } c`;');
check("a nested template is one token", sp('var s=`x ${ `y ${z}` } w`;'),
      'var s = `x ${ `y ${z}` } w`;');
check("a Swift raw string is content", sp('let s = #"a } b"#', "swift"),
      'let s = #"a } b"#');
// The whole point of a raw string is that the quote inside it is text, so this is the case
// that tells a scanner reading the delimiter from one reading it as a `#` and a string.
check("a quote inside a raw string is text", sp('let s = #"a " b"#\nlet t=1', "swift"),
      'let s = #"a " b"#\nlet t = 1');
check("and so is a brace", ri('func f() {\nlet s = #"a " { b"#\nlet t = 1\n}', "swift"),
      'func f() {\n    let s = #"a " { b"#\n    let t = 1\n}');
check("two hashes take two to close", sp('let s = ##"a "# b"##\nlet t=1', "swift"),
      'let s = ##"a "# b"##\nlet t = 1');
check("a raw string can be multi-line",
      sp('let s = #"""\na "" b\n"""#\nlet t=1', "swift"),
      'let s = #"""\na "" b\n"""#\nlet t = 1');
check("Swift interpolation is content", sp('let s = "\\(x),  \\(y)"', "swift"),
      'let s = "\\(x),  \\(y)"');
check("a line comment is content", sp('a=1; // x ,  y'), 'a = 1; // x ,  y');
check("a block comment is content", sp('a=1; /* x ,  y */ b=2;'),
      'a = 1; /* x ,  y */ b = 2;');
check("a regex is content", sp('s.replace(/a ,  b/g,"")'), 's.replace(/a ,  b/g, "")');
check("a division is not a regex", sp('var q = a/b, r = c/d;'),
      'var q = a / b, r = c / d;');
check("a regex after `return`", sp('return /a,b/.test(s);'), 'return /a,b/.test(s);');
check("Java's char literal", sp("char c='x';", "java"), "char c = 'x';");
check("Swift has no char literal, so an apostrophe cannot open one",
      sp("let a = 1 // don't\nlet b=2", "swift"), "let a = 1 // don't\nlet b = 2");
check("Swift's escaped identifier", sp('let `class` = 1', "swift"), 'let `class` = 1');
check("a Java text block is content", sp('var s = """\n  a ,  b\n  """;', "java"),
      'var s = """\n  a ,  b\n  """;');

// --- Spacing: what it never does ---

check("line breaks are never added", sp('a=1; b=2;'), 'a = 1; b = 2;');
check("line breaks are never taken away", sp('a=1;\nb=2;'), 'a = 1;\nb = 2;');
check("CRLF survives", sp('a=1;\r\nb=2;'), 'a = 1;\r\nb = 2;');
check("leading whitespace is Reindent's, not this pass's", sp('   a=1;'), '   a = 1;');
check("idempotent", sp(sp('f( a ,b )')), sp('f( a ,b )'));

// --- Reindent: `switch` ---
//
// The two conventions differ by which half of the pair moves: Swift and Xcode pull the
// labels out to the `switch`, everyone else pushes the body past them.

check("swift case sits at the switch's level",
      ri('func f() {\nswitch x {\ncase .a:\nreturn 1\ncase .b:\nreturn 2\n}\n}', "swift"),
      'func f() {\n    switch x {\n    case .a:\n        return 1\n    case .b:\n'
      + '        return 2\n    }\n}');
check("swift nests inside a case",
      ri('switch x {\ncase .a:\nif y {\nf()\n}\n}', "swift"),
      'switch x {\ncase .a:\n    if y {\n        f()\n    }\n}');
check("java case sits one level in",
      ri('void f() {\nswitch (x) {\ncase 1:\nif (y) {\ng();\n}\nbreak;\ndefault:\nbreak;\n}\n}',
         "java"),
      'void f() {\n    switch (x) {\n        case 1:\n            if (y) {\n'
      + '                g();\n            }\n            break;\n        default:\n'
      + '            break;\n    }\n}');
check("a nested switch counts twice",
      ri('switch (a) {\ncase 1:\nswitch (b) {\ncase 2:\nf();\n}\n}', "java"),
      'switch (a) {\n    case 1:\n        switch (b) {\n            case 2:\n'
      + '                f();\n        }\n}');
check("a swift enum's cases are not a switch's",
      ri('enum E {\ncase a\ncase b\n}', "swift"), 'enum E {\n    case a\n    case b\n}');
check("a java class's fields are not a switch's",
      ri('class A {\nint defaults = 1;\n}', "java"), 'class A {\n    int defaults = 1;\n}');
// A label would land one level out, at the `switch`'s own indent plus one; this is an
// ordinary statement in the body, so it lands where the body does.
check("a word starting with `case` is not a label",
      ri('switch (x) {\ncases();\n}', "java"), 'switch (x) {\n        cases();\n}');
check("switch is idempotent", ri(ri('switch (x) {\ncase 1:\nf();\n}', "java"), "java"),
      ri('switch (x) {\ncase 1:\nf();\n}', "java"));

// --- Reindent: a line that continues the one above it ---

check("a modifier chain steps in once",
      ri('VStack {\nText("a")\n.font(.title)\n.padding()\n}', "swift"),
      'VStack {\n    Text("a")\n        .font(.title)\n        .padding()\n}');
check("a chain hanging off a closing brace keeps that brace's level",
      ri('Button {\nact()\n}\n.tint(.red)', "swift"),
      'Button {\n    act()\n}\n.tint(.red)');
// The chain rule offers a level; the brackets set a floor under it. Here the line above
// starts with a closer, so the chain would take that line's level — and the bracket opened
// further along it says otherwise.
check("a chain never goes shallower than the brackets say",
      ri('f(g(\na\n), b(\n.c()\n))'), 'f(g(\n    a\n), b(\n    .c()\n))');
check("and a chain in a call still steps in", ri('f(\n.a()\n)'), 'f(\n    .a()\n)');
check("a comment does not break a chain",
      ri('Group {\nx()\n}\n// why\n.overlay(y)', "swift"),
      'Group {\n    x()\n}\n// why\n.overlay(y)');
check("a comment inside a chain takes the chain's level",
      ri('a()\n.b()\n// why\n.c()'), 'a()\n    .b()\n    // why\n    .c()');
check("a chain is idempotent", ri(ri('a()\n.b()\n.c()')), ri('a()\n.b()\n.c()'));
check("CSS is not chained, because a leading dot there is a selector",
      ri('.a {\ncolor: red;\n}\n.b {\ncolor: blue;\n}', "css"),
      '.a {\n    color: red;\n}\n.b {\n    color: blue;\n}');

// --- Refusals ---

checkRefusal("an unclosed brace", function () { fmt('function f() {\na();\n'); },
             "never closed");
checkRefusal("a stray closer", function () { fmt('function f() {\n}\n}'); },
             "never opened");
checkRefusal("the wrong closer", function () { fmt('f(a]'); }, "wrong kind");
checkRefusal("an unclosed block comment", function () { fmt('a();\n/* x\n'); },
             "never closed");
checkRefusal("an unclosed string", function () { fmt('var s = "a;\n'); }, "never closed");
checkRefusal("an unclosed template", function () { fmt('var s = `a;\n'); }, "never closed");
checkRefusal("an unclosed text block", function () { fmt('var s = """\na\n', "java"); },
             "never closed");

// --- What running it over sixty files of the editor's own source turned up ---
//
// Every one of these was a real line in a real file that came back wrong, and each is here
// rather than in the fuzzer because the fuzzer cannot see a space in the wrong place —
// only a character lost. The argument for driving a formatter over a corpus is this list.

check("an optional call is not a ternary", sp('fullHeightDidChange?(isFullHeight)', "swift"),
      'fullHeightDidChange?(isFullHeight)');
check("nor is a failable initialiser", sp('init?(header: String) { }', "swift"),
      'init?(header: String) { }');
check("nor an optional subscript", sp('values?[0]', "swift"), 'values?[0]');
check("but a parenthesised ternary still is", sp('let x = flag ? (a) : (b)', "swift"),
      'let x = flag ? (a) : (b)');
check("an optional type before `in`", sp('f { x -> Thing? in g(x) }', "swift"),
      'f { x -> Thing? in g(x) }');
check("a double optional is not a coalescing",
      sp('func f(file newFile: URL?? = nil) { }', "swift"),
      'func f(file newFile: URL?? = nil) { }');
check("and a coalescing still is", sp('let v = a??b', "swift"), 'let v = a ?? b');
check("Swift's overflow operators are one token",
      sp('func f() { token &+= 1 }', "swift"), 'func f() { token &+= 1 }');
check("`new` and `delete` are ordinary names in Swift",
      sp('case delete(old: Int)\nif old[h] == new[h] { }', "swift"),
      'case delete(old: Int)\nif old[h] == new[h] { }');
check("`of` is not an ordinary name in JavaScript",
      sp("for (const path of ['/a', '/b']) { f(path); }"),
      "for (const path of ['/a', '/b']) { f(path); }");
check("`repeat` is an ordinary name in JavaScript",
      sp('return { changes: repeat ? 0 : 1 };'), 'return { changes: repeat ? 0 : 1 };');
check("a member is not a keyword", sp('p.then(f).catch(() => {})'),
      'p.then(f).catch(() => {})');
check("dynamic import is a call", sp("en: () => import('./en.js'),"),
      "en: () => import('./en.js'),");
check("an attribute's bracket is left as written",
      sp('func f(_ body: @escaping (Int) -> Void) { }', "swift"),
      'func f(_ body: @escaping (Int) -> Void) { }');
check("including a closed-up one", sp('@available(*, deprecated)\nfunc f() {}', "swift"),
      '@available(*, deprecated)\nfunc f() {}');
check("and one that follows the attribute's own arguments",
      sp('let f: @convention(block) (JSValue?) -> Void = { }', "swift"),
      'let f: @convention(block) (JSValue?) -> Void = { }');
check("`inout` is a keyword",
      sp('func f(_ body: (inout [String: Any]) -> Bool) { }', "swift"),
      'func f(_ body: (inout [String: Any]) -> Bool) { }');
check("a closing brace ends a value, for a ternary",
      sp('return folders.contains { $0 == x } ? selected : nil', "swift"),
      'return folders.contains { $0 == x } ? selected : nil');
check("a ternary split across lines is still one ternary",
      sp('var x = a\n? b\n: c;'), 'var x = a\n? b\n: c;');
check("no space before a semicolon, even with one there",
      sp('didSet { persist() ; apply() }', "swift"), 'didSet { persist(); apply() }');

// **More than one space is alignment.** This is the rule that keeps a formatter from being
// the thing that ruins a file: a table somebody lined up stays lined up.
check("an aligned table survives",
      sp('var t = {\n    "a":     1,\n    "bbbb":  2\n};'),
      'var t = {\n    "a":     1,\n    "bbbb":  2\n};');
check("an aligned trailing comment survives",
      sp('a = 1;      // one\nbb = 2;     // two'), 'a = 1;      // one\nbb = 2;     // two');
check("a single space is still decided", sp('f(a ,b)'), 'f(a, b)');
check("and so is no space at all", sp('f(a,b)'), 'f(a, b)');

// Indentation, from the same corpus.
check("a wrapped condition steps in once",
      ri('if (a\n&& b) {\nf();\n}'), 'if (a\n    && b) {\n    f();\n}');
check("a ternary's halves step in once",
      ri('var x = a\n? b\n: c;'), 'var x = a\n    ? b\n    : c;');
check("and stay there rather than stepping again",
      ri('var x = a\n? b\n: c;\nvar y = 1;'), 'var x = a\n    ? b\n    : c;\nvar y = 1;');
check("a lone `-` does not continue a line, because `->` is what does",
      ri('func f()\n-> Int {\nreturn 1\n}', "swift"),
      'func f()\n    -> Int {\n    return 1\n}');

// A known limit, pinned so that fixing it is a deliberate act: `? {` is read as an optional
// type meeting its body rather than as a ternary onto a closure. See `startsOperand`.
check("LIMIT: a ternary onto a closure loses the space before its colon",
      sp('f(x: flag ? { a } : nil)'), 'f(x: flag ? { a }: nil)');
check("because this is the commoner reading of the same two characters",
      sp('func f() -> Any? { nil }', "swift"), 'func f() -> Any? { nil }');

// --- The whole thing, on something shaped like real code ---

check("swiftui", fmt('struct V: View {\nvar body: some View {\nVStack(spacing:8) {\n'
                     + 'Text("hi")\n.font(.title)\n}\n}\n}', "swift"),
      'struct V: View {\n    var body: some View {\n        VStack(spacing: 8) {\n'
      + '            Text("hi")\n                .font(.title)\n        }\n    }\n}');
check("typescript", fmt('function f(x:number,y?:string):void{\nconst a=[1,2];\n'
                        + 'switch(x){\ncase 1:\nreturn;\n}\n}', "typescript"),
      'function f(x: number, y?: string): void {\n    const a = [1, 2];\n'
      + '    switch (x) {\n        case 1:\n            return;\n    }\n}');
check("formatting twice equals formatting once",
      fmt(fmt('class A{\nvoid f(){int[] a={1,2 , 3};}\n}', "java"), "java"),
      fmt('class A{\nvoid f(){int[] a={1,2 , 3};}\n}', "java"));

report();
