var OPT = { unit: "  ", newline: "\n" };
function c(t) { return formatCSS(t, OPT); }

check("minified rule", c('a{color:red;background:blue}'),
      'a {\n  color: red;\n  background: blue;\n}');
check("missing final semicolon", c('a{color:red}'), 'a {\n  color: red;\n}');
check("nested at-rule", c('@media (min-width:0){a{color:red}}'),
      '@media (min-width:0) {\n  a {\n    color: red;\n  }\n}');
check("selector list one per line", c('h1,h2 ,  h3{color:red}'),
      'h1,\nh2,\nh3 {\n  color: red;\n}');
check("import", c('@import "x.css";a{color:red}'),
      '@import "x.css";\na {\n  color: red;\n}');
check("blank line kept", c('a{color:red}\n\n\nb{color:blue}'),
      'a {\n  color: red;\n}\n\nb {\n  color: blue;\n}');
check("no blank line invented", c('a{color:red}\nb{color:blue}'),
      'a {\n  color: red;\n}\nb {\n  color: blue;\n}');
check("comment on its own line", c('/* head */\na{color:red}'), '/* head */\na {\n  color: red;\n}');
check("comment inside a value keeps the spacing it had", c("a{color:/* x */red}"), "a {\n  color: /* x */red;\n}");
check("idempotent", c(c('a{color:red;b:c}')), c('a{color:red;b:c}'));

// The rule that matters: a space in a selector is a token.
check("descendant combinator survives", c('a :hover{color:red}'), 'a :hover {\n  color: red;\n}');
check("pseudo-class stays joined", c('a:hover{color:red}'), 'a:hover {\n  color: red;\n}');
check("child combinator spacing kept", c('a > b{color:red}'), 'a > b {\n  color: red;\n}');
check("tight child combinator kept", c('a>b{color:red}'), 'a>b {\n  color: red;\n}');
check("declaration colon normalised", c('a{color   :   red}'), 'a {\n  color: red;\n}');
check("only the first colon", c('a{background:url(a:b)}'), 'a {\n  background: url(a:b);\n}');

// Content is copied, never rewritten.
check("url untouched", c('a{background:url( x y.png )}'), 'a {\n  background: url( x y.png );\n}');
check("string untouched", c('a{content:"  a ; b { c }  "}'), 'a {\n  content: "  a ; b { c }  ";\n}');
check("brace in string", c('a{content:"}"}'), 'a {\n  content: "}";\n}');
check("semicolon in parens", c('a{grid:foo(a;b)}'), 'a {\n  grid: foo(a;b);\n}');
check("comma inside is(...) not broken", c(':is(a,b){color:red}'), ':is(a,b) {\n  color: red;\n}');
check("comma in a string not broken", c('a[t="x,y"]{color:red}'), 'a[t="x,y"] {\n  color: red;\n}');

// SCSS and LESS.
check("scss nesting", c('a{&:hover{color:red}}'), 'a {\n  &:hover {\n    color: red;\n  }\n}');
check("scss line comment", c('// note\na{color:red}'), '// note\na {\n  color: red;\n}');
check("scss variable", c('$x:1px;a{width:$x}'), '$x: 1px;\na {\n  width: $x;\n}');

checkRefusal("unclosed block", function () { c('a{color:red'); }, "unclosed block");
checkRefusal("stray close", function () { c('a{}}'); }, "no block open");
checkRefusal("brace with no selector", function () { c('{color:red}'); }, "no selector");
checkRefusal("unterminated string", function () { c('a{content:"x}'); }, "no closing quote");
checkRefusal("empty", function () { c('   '); }, "no CSS");

// Fuzz for stability and for never losing a non-whitespace character.
var pieces = ['a', 'b', '{', '}', ';', ':', 'color', 'red', ' ', '\n', '/* c */', '"s"',
              'url(x)', ',', '>', '@media', '(min-width:0)', '&:hover', '$v', '//x\n'];
var seed = 24680;
function rnd(n) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; }
var lost = 0, unstable = 0, refused = 0, shown = 0;
for (var trial = 0; trial < 4000; trial++) {
    var parts = [];
    var howMany = 1 + rnd(12);
    for (var k = 0; k < howMany; k++) { parts.push(pieces[rnd(pieces.length)]); }
    var input = parts.join("");
    var once;
    try { once = c(input); } catch (e) { refused++; continue; }
    var twice;
    try { twice = c(once); } catch (e) { twice = "<refused>"; }
    if (twice !== once) {
        unstable++;
        if (shown++ < 3) {
            print("  UNSTABLE " + JSON.stringify(input));
            print("    once -> " + JSON.stringify(once));
            print("    twice-> " + JSON.stringify(twice));
        }
    }
}
check("fuzz: formatting twice equals formatting once", unstable, 0);
print("(css fuzz: 4000 trials, " + refused + " refused)");
report();
