// An example Linelark plugin.
//
// Copy this folder into the plugins directory (Plugins ▸ Reveal Plugins Folder in
// Finder) and pick Plugins ▸ Reload Plugins. The two commands below show up under
// Plugins ▸ Sort Lines.
//
// The whole host API is on the `linelark` object; see README.md for the full list.
// Offsets are UTF-16 code units, which is what JavaScript's own strings count in, so
// `linelark.text().substr(location, length)` and `linelark.getRange(location, length)`
// always agree.

// Whatever lines the selection touches, whole — selecting half of a line should still
// sort that line rather than cutting it in two.
function selectedLineRange() {
    var range = linelark.selectionRange();
    var text = linelark.text();

    var start = range.location;
    while (start > 0 && text.charAt(start - 1) !== "\n") {
        start--;
    }

    var end = range.location + range.length;
    while (end < text.length && text.charAt(end) !== "\n") {
        end++;
    }

    return { location: start, length: end - start };
}

function sortSelectedLines(unique) {
    var range = selectedLineRange();
    if (range.length === 0) {
        linelark.log("Select the lines to sort first.");
        return;
    }

    var lines = linelark.getRange(range.location, range.length).split("\n");
    lines.sort(function (a, b) {
        return a.localeCompare(b);
    });

    if (unique) {
        lines = lines.filter(function (line, index) {
            return index === 0 || line !== lines[index - 1];
        });
    }

    // One replacement rather than one per line: it lands as a single undoable edit,
    // named after the command in the Undo menu.
    linelark.replaceRange(range.location, range.length, lines.join("\n"));
}

linelark.addCommand("sort", "Sort Selected Lines", function () {
    sortSelectedLines(false);
});

linelark.addCommand("sortUnique", "Sort Selected Lines and Remove Duplicates", function () {
    sortSelectedLines(true);
});
