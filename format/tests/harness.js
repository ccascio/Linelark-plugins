// A stand-in for the host object, enough to load the plugin outside the editor.
var __store = {};
var __log = [];
var linelark = {
    storeGet: function (k) { return Object.prototype.hasOwnProperty.call(__store, k) ? __store[k] : null; },
    storeSet: function (k, v) { __store[k] = v; return null; },
    storeRemove: function (k) { delete __store[k]; },
    storeKeys: function () { return Object.keys(__store); },
    log: function (m) { __log.push(String(m)); },
    apiVersion: function () { return 7; },
    addCommand: function () {}, addContextMenuItem: function () {},
    addPanel: function () {}, addPreview: function () {}, refreshPanels: function () {},
    fileName: function () { return "test.json"; }, filePath: function () { return null; },
    language: function () { return "json"; }, isReadOnly: function () { return false; },
    text: function () { return ""; }, length: function () { return 0; },
    lineCount: function () { return 1; }, line: function () { return ""; },
    getRange: function () { return ""; },
    selectionRange: function () { return { location: 0, length: 0 }; },
    setSelection: function () {}, replaceRange: function () {}, setText: function () {},
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
function checkRefusal(name, fn, fragment) {
    try { fn(); __fail++; print("FAIL " + name + " — expected a refusal, got none"); }
    catch (e) {
        if (String(e.message).indexOf(fragment) < 0) {
            __fail++; print("FAIL " + name + " — refusal was: " + e.message);
        } else { __pass++; }
    }
}
function report() {
    print((__fail ? "FAILED " : "ok ") + __pass + " passed, " + __fail + " failed");
}
