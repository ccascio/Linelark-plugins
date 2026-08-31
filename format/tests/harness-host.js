// A host stub that records what the plugin registered and lets a test drive it.
var __store = {}, __log = [];
var __doc = { text: "", language: "normal", path: null, readOnly: false, sel: 0, edits: 0 };
var __commands = {}, __panels = [], __menu = [];
var linelark = {
    storeGet: function (k) { return Object.prototype.hasOwnProperty.call(__store, k) ? __store[k] : null; },
    storeSet: function (k, v) { __store[k] = v; return null; },
    storeRemove: function (k) { delete __store[k]; },
    storeKeys: function () { return Object.keys(__store); },
    log: function (m) { __log.push(String(m)); },
    apiVersion: function () { return 7; },
    addCommand: function (id, title, fn) { __commands[id] = { title: title, run: fn }; },
    addContextMenuItem: function (d) { __menu.push(d); },
    addPanel: function (d) { __panels.push(d); },
    addPreview: function () {},
    refreshPanels: function () {},
    fileName: function () { return __doc.path || "untitled"; },
    filePath: function () { return __doc.path; },
    language: function () { return __doc.language; },
    isReadOnly: function () { return __doc.readOnly; },
    text: function () { return __doc.text; },
    length: function () { return __doc.text.length; },
    lineCount: function () { return __doc.text.split("\n").length; },
    line: function (n) { return __doc.text.split("\n")[n - 1] || ""; },
    getRange: function (l, n) { return __doc.text.substr(l, n); },
    selectionRange: function () { return { location: __doc.sel, length: 0 }; },
    caretLine: function () { return __doc.text.slice(0, __doc.sel).split("\n").length; },
    setSelection: function (l) { __doc.sel = l; },
    replaceRange: function (l, n, r) {
        __doc.text = __doc.text.slice(0, l) + r + __doc.text.slice(l + n);
        __doc.edits++;
    },
    setText: function (t) { __doc.text = t; __doc.edits++; },
    insert: function () {}, replaceSelection: function () {},
    copyToClipboard: function () { return true; }
};
var __fail = 0, __pass = 0;
function check(name, got, want) {
    if (got === want) { __pass++; return; }
    __fail++;
    print("FAIL " + name);
    print("  want: " + JSON.stringify(want));
    print("  got : " + JSON.stringify(got));
}
function report() { print((__fail ? "FAILED " : "ok ") + __pass + " passed, " + __fail + " failed"); }
