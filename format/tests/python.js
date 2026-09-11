// Reindent for Python. Its indentation *is* its block structure, so this restates the
// structure the file already has in the unit that was asked for — it never works one out.

var OPT = { unit: "    ", newline: "\n" };
var TABS = { unit: "\t", newline: "\n" };
function ri(t, opt) { return reindent(t, "python", opt || OPT); }

// --- The unit changes; the structure does not ---

check("three spaces become four", ri('def f():\n   if x:\n      return 1\n   return 2\n'),
      'def f():\n    if x:\n        return 1\n    return 2\n');
check("tabs become spaces", ri('def f():\n\tif x:\n\t\treturn 1\n'),
      'def f():\n    if x:\n        return 1\n');
check("spaces become tabs", ri('def f():\n  if x:\n    return 1\n', TABS),
      'def f():\n\tif x:\n\t\treturn 1\n');
check("an over-indented block comes back in line",
      ri('def f():\n            return 1\n'), 'def f():\n    return 1\n');
check("a file already in the unit is untouched",
      ri('def f():\n    return 1\n'), 'def f():\n    return 1\n');
check("dedenting two levels at once",
      ri('def f():\n  if x:\n    a = 1\n  return a\n'),
      'def f():\n    if x:\n        a = 1\n    return a\n');
check("siblings at the top level", ri('a = 1\nb = 2\n'), 'a = 1\nb = 2\n');
check("blank lines are emptied", ri('def f():\n   \n      a = 1\n'),
      'def f():\n\n    a = 1\n');
check("CRLF survives", ri('def f():\r\n  return 1\r\n'), 'def f():\r\n    return 1\r\n');
check("no trailing newline is added", ri('def f():\n  return 1'),
      'def f():\n    return 1');
check("idempotent", ri(ri('def f():\n   if x:\n      return 1\n')),
      ri('def f():\n   if x:\n      return 1\n'));

// --- Continuations are alignment, not structure ---
//
// A line held open by a bracket or a backslash is usually aligned to a column. Rebuilding
// it from a depth would destroy that, so it is shifted by exactly what its statement moved
// and by nothing else.

check("a hanging indent is shifted with its statement",
      ri('def f():\n  g(a,\n    b,\n    c)\n  return 1\n'),
      'def f():\n    g(a,\n      b,\n      c)\n    return 1\n');
check("a statement that did not move leaves its continuation alone",
      ri('def f():\n    g(a,\n      b)\n'), 'def f():\n    g(a,\n      b)\n');
check("a backslash continues a line too",
      ri('def f():\n  a = 1 + \\\n      2\n  return a\n'),
      'def f():\n    a = 1 + \\\n        2\n    return a\n');
check("a dedent inside brackets is not a dedent",
      ri('def f():\n  g(a,\nb)\n  return 1\n'),
      'def f():\n    g(a,\n  b)\n    return 1\n');
check("continuations are idempotent",
      ri(ri('def f():\n   g(a,\n     b)\n')), ri('def f():\n   g(a,\n     b)\n'));

// --- A `"""` block is a value ---

check("a docstring's own indentation is content",
      ri('def f():\n      """doc\n   indented\n"""\n      return 1\n'),
      'def f():\n    """doc\n   indented\n"""\n    return 1\n');
check("a brace in a docstring is not a bracket",
      ri('def f():\n      """{"""\n      return 1\n'),
      'def f():\n    """{"""\n    return 1\n');
check("a hash in a string does not start a comment",
      ri('def f():\n      a = "# x"\n      return a\n'),
      'def f():\n    a = "# x"\n    return a\n');

// --- A comment is about the line below it ---
//
// Which is the only reading that works: a comment above the first statement of a block is
// indented like that statement, and the block it opens has not been pushed at the moment
// the comment is read.

check("a comment introduces the block below it",
      ri('# top\ndef f():\n  # inner\n  return 1\n# after\n'),
      '# top\ndef f():\n    # inner\n    return 1\n# after\n');
check("a comment indented past the line below it stays in its own block",
      ri('def f():\n  return 1\n  # a note\nx = 1\n'),
      'def f():\n    return 1\n    # a note\nx = 1\n');
check("a comment at the margin is not a dedent — it joins the line below it",
      ri('def f():\n  if x:\n    a = 1\n# note\n    b = 2\n'),
      'def f():\n    if x:\n        a = 1\n        # note\n        b = 2\n');
check("and the block it was in is not popped by it",
      ri('def f():\n  if x:\n    a = 1\n# note\n  b = 2\n'),
      'def f():\n    if x:\n        a = 1\n    # note\n    b = 2\n');
check("a comment at the end of a file",
      ri('def f():\n  return 1\n# done\n'), 'def f():\n    return 1\n# done\n');
check("blank lines between held comments keep their place",
      ri('# a\n\n# b\ndef f():\n  return 1\n'), '# a\n\n# b\ndef f():\n    return 1\n');
check("comments are idempotent",
      ri(ri('# top\ndef f():\n  # inner\n  return 1\n')),
      ri('# top\ndef f():\n  # inner\n  return 1\n'));

// --- Refused rather than guessed at ---

checkRefusal("a dedent to no block at all", function () {
    ri('def f():\n    if x:\n        a = 1\n      b = 2\n');
}, "not out to any block");
checkRefusal("indentation that means two things", function () {
    ri('if x:\n\ta = 1\n        b = 2\n');
}, "one column and another if it is eight");
check("a refusal names the line", (function () {
    var text = 'def f():\n    if x:\n        a = 1\n      b = 2\n';
    try { ri(text); } catch (e) { return placeOf(text, e.offset); }
    return "";
}()), " (line 4, column 7)");

// A tab and eight spaces agreeing is not ambiguous, whatever it looks like.
check("a tab and eight spaces agree", ri('if x:\n\ta = 1\nif y:\n        b = 2\n'),
      'if x:\n    a = 1\nif y:\n    b = 2\n');

// --- Reindent is Python's; Format is not offered ---

check("python has a Reindent", REINDENTABLE["python"], 1);
check("python has no Format", formatterFor("python", "/tmp/x.py"), "");
check("python's panel says Reindent applies", alsoAvailable("python"),
      "Reindent and Tidy Whitespace are on the Plugins menu.");

report();
