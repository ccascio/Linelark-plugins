// Scratch Notes — a scratchpad that belongs to the file you are looking at.
//
// Notes are kept per file and pinned to a line in it, so switching tabs switches notes and
// moving through a long document brings the note written about *that part* to the top.
// Typing saves itself; nothing here has a Save button, and nothing is lost by quitting.
//
// Four things shape the file, and all four are consequences of what a panel is.
//
// **The box is the note, and the box's id says which one.** `onChange` is delivered on a
// debounce, which means it can arrive *after* the panel has moved on to a different note.
// So the field's id carries the note's id — `note:ab12` rather than `note` — and the host
// hands back the id the pending save was scheduled with. Without that, switching notes
// while the debounce was in flight would write one note's text into another.
//
// **`value` is the note as *stored*, never the text being typed.** The view adopts a new
// `value` by replacing what is in the box, so a panel that echoed the live text back would
// move the cursor to the end on every autosave. The stored text is safe to hand back for
// exactly the reason the live text is not: while somebody types it does not change, so the
// box is left alone; and when a save lands it is equal to what the box already holds. It is
// also the only thing that makes the box survive being rebuilt — switching panels in the
// dock throws the field away — holding what was actually saved.
//
// **The caret is followed, not the scroll bar.** `followsCaret` asks the host to redraw
// this panel when the caret moves, coalesced to five times a second at most. A panel is
// otherwise drawn deliberately, and this is the one panel whose content is a function of
// where you are.
//
// **A line number is a guess, and the anchor text is the check.** Nothing tells a plugin
// that the document was edited, so a note pinned to line 40 is pointing at whatever line 40
// has become. Each note also keeps the text of the line it was made on, and re-finds it
// nearby when the two disagree.

var STORE_PREFIX = "f:";
var FORMAT = 1;
// How far from the remembered line to look for a moved anchor. Wide enough to survive a
// function being added above it, narrow enough that it never lands on the wrong one of a
// hundred identical `}` lines.
var ANCHOR_SEARCH = 250;
// An anchor this short says nothing — `}` matches everywhere — so such a note stays on its
// line number and takes its chances.
var ANCHOR_MINIMUM = 4;

// What the panel is showing that the store cannot say.
var state = {
    savedAt: null,
    problem: null
};

// One read per draw. The panel asks for the same file's notes several times while it builds
// itself, and a draw now happens whenever the caret moves.
var cache = null;

function invalidate() { cache = null; }

// MARK: - Identity

// What a file is called in the store. The path where there is one, so notes survive a
// rename of the *tab* but not of the file; the name otherwise, which is all an unsaved
// buffer has to be identified by.
function fileKey() {
    var path = linelark.filePath();
    if (path) { return path; }
    var name = linelark.fileName();
    return name ? "untitled:" + name : null;
}

function storeKey(key) { return STORE_PREFIX + key; }

function newID() {
    // Not a UUID: this only has to be unique among one file's notes, and a plugin has no
    // crypto to reach for.
    return Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

// MARK: - The store

function readFile(key) {
    var raw = linelark.storeGet(storeKey(key));
    if (!raw) { return { name: "", notes: [] }; }
    try {
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.notes || !parsed.notes.length) { return { name: "", notes: [] }; }
        return { name: parsed.name || "", notes: parsed.notes };
    } catch (error) {
        // A store this plugin cannot read is a store it must not overwrite in silence.
        linelark.log("Could not read the notes for " + key + ": " + error);
        return { name: "", notes: [] };
    }
}

function writeFile(key, name, notes) {
    if (!notes.length) {
        linelark.storeRemove(storeKey(key));
        state.problem = null;
        return;
    }
    var payload = JSON.stringify({ v: FORMAT, name: name, notes: notes });
    // The one call here that can be refused. A full store is not an exception — it is
    // something the panel has to say out loud, because the alternative is a scratchpad that
    // looks like it is saving and is not.
    state.problem = linelark.storeSet(storeKey(key), payload);
}

// This file's notes, with their lines resolved against the document as it is now.
function current() {
    if (cache) { return cache; }
    var key = fileKey();
    if (!key) { cache = { key: null, name: "", notes: [] }; return cache; }
    var stored = readFile(key);
    var notes = stored.notes.map(function (note) {
        return {
            id: note.id,
            line: resolveLine(note),
            text: note.text || "",
            anchor: note.anchor || "",
            updated: note.updated || ""
        };
    });
    notes.sort(function (a, b) { return a.line - b.line; });
    cache = { key: key, name: linelark.fileName(), notes: notes };
    return cache;
}

function persist() {
    var here = current();
    if (!here.key) { return; }
    writeFile(here.key, here.name, here.notes.map(function (note) {
        return { id: note.id, line: note.line, text: note.text,
                 anchor: note.anchor, updated: note.updated };
    }));
}

// MARK: - Anchors
//
// Where the note's line has got to. Nothing reports an edit to a plugin, so this is checked
// on every draw rather than maintained: the remembered line first, then a widening search
// for the text that line used to hold.
function resolveLine(note) {
    var total = linelark.lineCount();
    var line = Math.min(Math.max(1, note.line || 1), total);
    var anchor = (note.anchor || "").trim();
    if (anchor.length < ANCHOR_MINIMUM) { return line; }
    if (linelark.line(line).trim() === anchor) { return line; }
    for (var distance = 1; distance <= ANCHOR_SEARCH; distance++) {
        // Outwards from where it was, so the nearer of two identical lines wins.
        if (line - distance >= 1 && linelark.line(line - distance).trim() === anchor) {
            return line - distance;
        }
        if (line + distance <= total && linelark.line(line + distance).trim() === anchor) {
            return line + distance;
        }
    }
    return line;
}

function anchorFor(line) {
    return linelark.line(line).trim().slice(0, 120);
}

// MARK: - Which note is "here"

function nearest(notes, line) {
    var best = null;
    var bestDistance = Infinity;
    for (var i = 0; i < notes.length; i++) {
        var distance = Math.abs(notes[i].line - line);
        if (distance < bestDistance) {
            bestDistance = distance;
            best = notes[i];
        }
    }
    return best;
}

function noteByID(notes, id) {
    for (var i = 0; i < notes.length; i++) {
        if (notes[i].id === id) { return notes[i]; }
    }
    return null;
}

// The note the box is editing: whatever is nearest the caret. Clicking a row moves the
// caret to that note, so an explicit choice and following along are the same mechanism —
// there is no third state where the panel is showing one note and pointing at another.
function editing() {
    var here = current();
    if (!here.notes.length) { return null; }
    return nearest(here.notes, linelark.caretLine());
}

// MARK: - Editing

function addNote() {
    var here = current();
    if (!here.key) {
        linelark.log("Open a file to keep notes against it.");
        return null;
    }
    var line = linelark.caretLine();
    var note = { id: newID(), line: line, text: "", anchor: anchorFor(line),
                 updated: new Date().toISOString() };
    here.notes.push(note);
    here.notes.sort(function (a, b) { return a.line - b.line; });
    persist();
    return note;
}

function saveNote(id, text) {
    var here = current();
    var note = noteByID(here.notes, id);
    if (!note) { return; }
    if (note.text === text) { return; }
    note.text = text;
    note.updated = new Date().toISOString();
    persist();
    state.savedAt = new Date();
}

function deleteNote(id) {
    var here = current();
    var at = -1;
    for (var i = 0; i < here.notes.length; i++) {
        if (here.notes[i].id === id) { at = i; }
    }
    if (at === -1) { return; }
    here.notes.splice(at, 1);
    persist();
}

// MARK: - Drawing

function firstLine(text) {
    var trimmed = String(text).replace(/^\s+/, "");
    var stop = trimmed.indexOf("\n");
    var head = stop === -1 ? trimmed : trimmed.slice(0, stop);
    return head || "Empty note";
}

function clock(date) {
    if (!date) { return null; }
    var hours = String(date.getHours());
    var minutes = String(date.getMinutes());
    return (hours.length < 2 ? "0" : "") + hours + ":"
         + (minutes.length < 2 ? "0" : "") + minutes;
}

function noteRows(notes, line, activeID) {
    return notes.map(function (note) {
        return {
            id: "go:" + note.id,
            title: firstLine(note.text),
            detail: "Line " + note.line + (note.line === line ? " · here" : ""),
            symbol: note.id === activeID ? "pencil.circle.fill" : "circle",
            badge: note.text.trim() ? null : "empty",
            badgeTint: note.text.trim() ? null : "warning"
        };
    });
}

// Every other file that has notes, so a scratchpad is not invisible the moment you switch
// tabs. Built from the store's own key list rather than a second index to keep in step.
function otherFileRows(exceptKey) {
    var keys = linelark.storeKeys();
    var rows = [];
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(STORE_PREFIX) !== 0) { continue; }
        var path = key.slice(STORE_PREFIX.length);
        if (path === exceptKey) { continue; }
        var stored = readFile(path);
        if (!stored.notes.length) { continue; }
        rows.push({
            id: "open:" + path,
            title: stored.name || path.split("/").pop(),
            detail: stored.notes.length + " note" + (stored.notes.length === 1 ? "" : "s"),
            symbol: path.indexOf("untitled:") === 0 ? "doc" : "doc.text"
        });
    }
    return rows;
}

function panelNodes() {
    invalidate();
    var here = current();
    var nodes = [];

    if (!here.key) {
        nodes.push({ type: "heading", text: "No file" });
        nodes.push({ type: "text", text: "Open a file and its notes appear here." });
        var orphans = otherFileRows(null);
        if (orphans.length) {
            nodes.push({ type: "section", id: "elsewhere", title: "Notes elsewhere",
                         collapsed: false, children: [{ type: "rows", rows: orphans }] });
        }
        return nodes;
    }

    var line = linelark.caretLine();
    var note = editing();

    nodes.push({ type: "heading", text: here.name });

    // Before anything else, because a refused write is usually also the reason the panel
    // looks empty: the note was never stored, so the next draw cannot find it. Saying
    // nothing here is how a scratchpad looks broken rather than full.
    if (state.problem) {
        nodes.push({ type: "heading", text: "Not saved" });
        nodes.push({ type: "text", text: state.problem, style: "primary" });
    }

    if (!note) {
        nodes.push({ type: "text",
                     text: "Nothing noted about this file yet. A note is pinned to the line "
                         + "you start it on, and comes back when you are near it again." });
        nodes.push({ type: "button", id: "add", title: "Start a note at line " + line,
                     symbol: "square.and.pencil", prominent: true });
    } else {
        // The id carries the note, so a save that arrives late still lands on the right one.
        nodes.push({
            type: "field",
            id: "note:" + note.id,
            label: "Line " + note.line + (note.line === line ? " · here" : ""),
            placeholder: "Type. It saves itself.",
            value: note.text,
            multiline: true,
            submit: "Save now",
            enabled: true
        });
        nodes.push({
            type: "actions",
            actions: [
                { id: "add", title: "New note at line " + line, symbol: "plus.square" },
                { id: "insert:" + note.id, title: "Insert this note into the document",
                  symbol: "text.insert" },
                { id: "copy:" + note.id, title: "Copy this note", symbol: "doc.on.doc" },
                { id: "export", title: "Export every note for this file",
                  symbol: "square.and.arrow.up" },
                { id: "delete:" + note.id, title: "Delete this note",
                  symbol: "trash", tint: "negative" }
            ]
        });
        if (!state.problem && state.savedAt) {
            nodes.push({ type: "text", text: "Saved at " + clock(state.savedAt) });
        }
    }

    if (here.notes.length) {
        nodes.push({
            type: "section", id: "notes",
            title: "In this file · " + here.notes.length, collapsed: false,
            children: [{ type: "rows",
                         rows: noteRows(here.notes, line, note ? note.id : null) }]
        });
    }

    var others = otherFileRows(here.key);
    if (others.length) {
        nodes.push({ type: "section", id: "elsewhere",
                     title: "Other files · " + others.length, collapsed: true,
                     children: [{ type: "rows", rows: others }] });
    }
    return nodes;
}

// MARK: - Exporting

function exportNotes() {
    var here = current();
    if (!here.notes.length) { return false; }
    var lines = ["# Notes on " + (here.name || here.key), ""];
    for (var i = 0; i < here.notes.length; i++) {
        var note = here.notes[i];
        lines.push("## Line " + note.line);
        if (note.anchor) { lines.push("`" + note.anchor + "`"); }
        lines.push("");
        lines.push(note.text || "_(empty)_");
        lines.push("");
    }
    var base = (here.name || "notes").replace(/\.[^.]+$/, "");
    return linelark.exportFile({ name: base + " notes.md", text: lines.join("\n") });
}

// MARK: - The panel

linelark.addPanel({
    id: "notes",
    title: "Scratch",
    symbol: "square.and.pencil",
    side: "right",
    // The whole point of the panel: which note is in the box depends on where you are.
    followsCaret: true,
    render: panelNodes,

    // Delivered on a debounce while typing. `id` is `note:<noteID>`, which is how a save
    // scheduled before the panel moved on still reaches the note it was typed into.
    onChange: function (id, value) {
        invalidate();
        if (id.indexOf("note:") !== 0) { return; }
        saveNote(id.slice(5), value);
        // Redrawn as soon as the save lands, so that `value` and the box are back in step
        // before anything else can redraw the panel. Without it, a caret move in the window
        // between saving and the next draw hands the box back the text as it was *before*
        // the save — and the note appears to lose what was just typed into it.
        //
        // Safe because a save does not change the shape of the node list: the box keeps its
        // position, and a box's typing belongs to its position rather than to its id.
        linelark.refreshPanels();
    },

    // The button beside the box. Nothing here needs it — the debounce already saved — but a
    // box with no way to say "now" is a box people do not trust.
    onSubmit: function (id, value) {
        invalidate();
        if (id.indexOf("note:") !== 0) { return; }
        saveNote(id.slice(5), value);
        linelark.refreshPanels();
    },

    onSelect: function (id) {
        invalidate();
        var cut = id.indexOf(":");
        var verb = cut === -1 ? id : id.slice(0, cut);
        var rest = cut === -1 ? "" : id.slice(cut + 1);

        if (verb === "add") {
            addNote();
        } else if (verb === "go") {
            // Moving the caret is what selects the note: the panel follows the caret, so
            // there is only ever one answer to "which note is current".
            var target = noteByID(current().notes, rest);
            if (target) { jumpTo(target.line); }
        } else if (verb === "copy") {
            var toCopy = noteByID(current().notes, rest);
            if (toCopy) { linelark.copyToClipboard(toCopy.text); }
        } else if (verb === "insert") {
            var toInsert = noteByID(current().notes, rest);
            if (toInsert && !linelark.isReadOnly()) { linelark.insert(toInsert.text); }
        } else if (verb === "delete") {
            deleteNote(rest);
        } else if (verb === "export") {
            exportNotes();
        } else {
            return;
        }
        linelark.refreshPanels();
    }
});

// The caret to the start of a line, which also scrolls it into view and focuses the editor.
function jumpTo(line) {
    var offset = 0;
    for (var i = 1; i < line; i++) { offset += linelark.line(i).length + 1; }
    linelark.setSelection(offset, 0);
}

// MARK: - Commands
//
// The same things from the Plugins menu, so the scratchpad has keyboard access: macOS lets
// a menu item be given a shortcut in System Settings ▸ Keyboard ▸ Keyboard Shortcuts ▸ App
// Shortcuts, and a menu item is the only thing a plugin can offer to be bound.

linelark.addCommand("new", "New Scratch Note Here", function () {
    invalidate();
    if (addNote()) { linelark.refreshPanels(); }
});

linelark.addCommand("copy", "Copy the Nearest Scratch Note", function () {
    invalidate();
    var note = nearest(current().notes, linelark.caretLine());
    if (!note) { return linelark.log("There is no note in this file yet."); }
    linelark.copyToClipboard(note.text);
});

linelark.addCommand("noteSelection", "Note the Selection", function () {
    invalidate();
    var selected = linelark.selection();
    var note = addNote();
    if (!note) { return; }
    if (selected) { saveNote(note.id, selected); }
    linelark.refreshPanels();
});

linelark.addCommand("export", "Export Notes for This File", function () {
    invalidate();
    if (!exportNotes()) { linelark.log("There is nothing to export."); }
});
