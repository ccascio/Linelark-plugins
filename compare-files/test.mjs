import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(here, "Compare Files.linelarkplugin", "main.js"),
  "utf8"
);

const registrations = { commands: [], contextMenus: [], panels: [], diffs: [] };
const context = vm.createContext({
  console,
  JSON,
  linelark: {
    storeGet: () => null,
    storeSet: () => null,
    log: () => {},
    addCommand: (...args) => registrations.commands.push(args),
    addContextMenuItem: (item) => registrations.contextMenus.push(item),
    addPanel: (panel) => registrations.panels.push(panel),
    refreshPanels: () => {},
    filePath: () => null,
    fileName: () => "",
    text: () => "",
    isReadOnly: () => false,
    openFile: () => {},
    openDiff: (descriptor) => registrations.diffs.push(descriptor),
    setText: () => {}
  }
});
vm.runInContext(source, context, { filename: "main.js" });

assert.equal(registrations.commands.length, 5);
assert.equal(registrations.contextMenus.length, 2);
assert.deepEqual(
  registrations.contextMenus.map((item) => item.id),
  ["use-left", "use-right"]
);
assert.equal(registrations.panels.length, 1);

registrations.contextMenus[0].handler({
  path: "/tmp/left.txt", name: "left.txt", kind: "file",
  text: "live unsaved text", isReadOnly: false
});
assert.equal(context.left.path, "/tmp/left.txt");
assert.equal(context.left.text, "live unsaved text");
registrations.contextMenus[1].handler({
  path: "/tmp/right.txt", name: "right.txt", kind: "file",
  text: "different text", isReadOnly: false
});
assert.equal(context.right.path, "/tmp/right.txt");
assert.equal(registrations.diffs.length, 1);
assert.match(registrations.diffs[0].name, /left\.txt.*right\.txt/);

function hostBlockCount(patch) {
  let started = false;
  let pending = false;
  let blocks = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      if (pending) { blocks += 1; pending = false; }
      started = true;
      continue;
    }
    if (!started || line.startsWith("\\")) { continue; }
    if (line.startsWith("-") || line.startsWith("+")) { pending = true; }
    else if (line.startsWith(" ") || line === "") {
      if (pending) { blocks += 1; pending = false; }
    }
  }
  if (pending) { blocks += 1; }
  return blocks;
}

function validate(leftLines, rightLines) {
  const operations = context.diffLines(leftLines, rightLines);
  const rebuiltLeft = [];
  const rebuiltRight = [];
  for (const operation of operations) {
    if (operation.type !== "insert") { rebuiltLeft.push(operation.left); }
    if (operation.type !== "delete") { rebuiltRight.push(operation.right); }
    if (operation.type === "equal") {
      assert.equal(context.comparisonKey(operation.left), context.comparisonKey(operation.right));
    }
  }
  assert.deepEqual(rebuiltLeft, leftLines);
  assert.deepEqual(rebuiltRight, rightLines);

  const blocks = context.blocksFrom(operations);
  const patch = context.patchFrom(operations, leftLines.length, rightLines.length);
  assert.equal(hostBlockCount(patch), blocks.length,
    "the native view and plugin must number change blocks identically");

  context.comparison = {
    left: { lines: leftLines, finalNewline: true },
    right: { lines: rightLines, finalNewline: true },
    blocks
  };
  for (const block of blocks) {
    const expectedLeft = leftLines.slice();
    expectedLeft.splice(
      block.leftStart,
      block.leftEnd - block.leftStart,
      ...rightLines.slice(block.rightStart, block.rightEnd)
    );
    assert.equal(context.mergedText("left", block), expectedLeft.join("\n") + "\n");

    const expectedRight = rightLines.slice();
    expectedRight.splice(
      block.rightStart,
      block.rightEnd - block.rightStart,
      ...leftLines.slice(block.leftStart, block.leftEnd)
    );
    assert.equal(context.mergedText("right", block), expectedRight.join("\n") + "\n");
  }
}

validate([], []);
validate(["a"], ["b"]);
validate(["a", "b", "c"], ["a", "B", "extra", "c"]);
validate(["same", "same", "same"], ["same", "different", "same"]);
validate(["a", "b", "a", "b"], ["b", "a", "b", "a"]);

context.options.whitespace = "changes";
context.options.ignoreCase = true;
validate(["  Alpha  ", "B\t C"], ["alpha", "b c"]);
context.options.whitespace = "exact";
context.options.ignoreCase = false;

let state = 0x6d2b79f5;
function random() {
  state = (Math.imul(state ^ (state >>> 15), 1 | state) + 0x6d2b79f5) | 0;
  let value = Math.imul(state ^ (state >>> 7), 61 | state);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

const vocabulary = ["", "a", "b", "c", "same", "{", "}", "  spaced", "tab\there"];
function randomLines() {
  const count = Math.floor(random() * 36);
  const lines = [];
  for (let i = 0; i < count; i += 1) {
    lines.push(vocabulary[Math.floor(random() * vocabulary.length)] +
      (random() < 0.18 ? String(Math.floor(random() * 7)) : ""));
  }
  return lines;
}

for (let iteration = 0; iteration < 600; iteration += 1) {
  validate(randomLines(), randomLines());
}

console.log("Compare Files: 600 fuzz pairs and focused cases passed.");
