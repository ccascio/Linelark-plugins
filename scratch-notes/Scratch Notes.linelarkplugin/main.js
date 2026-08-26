// A right-dock panel.
//
// The right dock is for panels that sit beside the work rather than describing the
// project — an outline, test results, an assistant. Declaring `side: "right"` is the only
// difference from a left-hand panel; everything else about the API is the same, and the
// dock's switcher shows one icon per panel exactly as the side panel does.
//
// This one lists the TODO-ish comments in the file you are currently looking at, and
// clicking one selects that line.

var MARKERS = ["TODO", "FIXME", "HACK", "XXX"];

function marks() {
    var found = [];
    var count = linelark.lineCount();
    for (var line = 1; line <= count; line++) {
        var text = linelark.line(line);
        for (var i = 0; i < MARKERS.length; i++) {
            if (text.indexOf(MARKERS[i]) !== -1) {
                found.push({
                    id: String(line),
                    title: text.replace(/^\s+/, ""),
                    detail: "Line " + line,
                    badge: MARKERS[i]
                });
                break;
            }
        }
    }
    return found;
}

linelark.addPanel({
    id: "notes",
    title: "Notes",
    symbol: "checklist",
    side: "right",

    render: function () {
        var name = linelark.fileName();
        if (!name) {
            return [{ type: "text", text: "Open a file to see its notes." }];
        }

        var rows = marks();
        if (!rows.length) {
            return [
                { type: "heading", text: name },
                { type: "text", text: "No TODO, FIXME, HACK or XXX comments here." }
            ];
        }

        return [
            { type: "heading", text: name },
            { type: "rows", rows: rows }
        ];
    },

    onSelect: function (id) {
        var line = parseInt(id, 10);
        if (isNaN(line)) return;
        // Selecting the line scrolls it into view and focuses the editor.
        var offset = 0;
        for (var i = 1; i < line; i++) { offset += linelark.line(i).length + 1; }
        linelark.setSelection(offset, linelark.line(line).length);
    }
});
