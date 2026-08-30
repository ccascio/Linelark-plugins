// Story Bible — the notes a long piece of writing needs beside it, kept per project.
//
// Characters, plot, places: a few named panes that belong to the *whole* story rather than
// to any one chapter of it. That is the whole difference from a scratchpad, and everything
// below follows from it.
//
// **The scope is the folder, not the file.** A character list kept per file would be a
// different character list in every chapter, which is the one thing it must never be. So
// panes are keyed on `folderRoot()`, and a lone file with no folder open is its own small
// story rather than nothing at all.
//
// **The panes are sections, not tabs.** A section remembers whether it is open — the plugin
// says how it *starts* and the view owns it after that — so you get the same one-at-a-time
// reading a tab bar gives, without the thing a tab bar takes away: you can keep Characters
// open while you write into Plot.
//
// **This panel does not follow the caret.** `followsCaret` is fixed at load, and a bible is
// not a function of where you are — redrawing it on every arrow key would fight the person
// typing into it for no gain.
//
// **The node list is kept structurally stable across a save.** Nodes are identified to the
// view by their *position*, so a box's typing state belongs to the fifth node rather than
// to the field's id. Adding or removing a node while somebody types would slide every box
// after it onto a different pane's contents. Hence one status line that is always present
// and only ever changes its words, which is also what makes it safe to redraw — and so to
// count words — while the writing is still going on.

var STORE_PREFIX = "b:";
var FORMAT = 1;

// What a new bible starts with. Four panes covers the shape of the thing; the hints are
// there because an empty box with no label is a question nobody answers.
var SEED = [
    { title: "Characters", hint: "Who they are, what they want, what they are hiding." },
    { title: "Plot",       hint: "What happens, in the order it happens." },
    { title: "Places",     hint: "Where it happens, and what it is like to be there." },
    { title: "Notes",      hint: "Anything that does not belong to the others yet." }
];

// What the panel knows that the store does not.
var state = {
    // The project these values describe. Everything here is thrown away when it changes.
    project: null,
    // paneID -> how many times the plugin has rewritten that box. It rides in the field's
    // id so a save scheduled before a rewrite can be told apart from one after it.
    rev: {},
    // paneID -> {rev, add} — text this plugin appended while somebody might have been
    // mid-sentence, kept until the late save it has to be re-applied to arrives. See
    // `onChange`.
    merge: {},
    // The pane the menu commands act on: whichever one was last written in or touched.
    active: null,
    renaming: null,
    // What the "add a pane" box is told to hold. A box is only cleared by being handed a
    // value that differs from the last one it was handed, so emptying it takes two draws:
    // the name it already shows, and then nothing.
    newValue: "",
    // A delete is two clicks, because a plugin cannot put a question on the screen and the
    // text in these boxes is the only copy of itself.
    confirming: null,
    savedAt: null,
    notice: null,
    problem: null
};

// One read of the store per draw. The panel asks for the same list several times as it
// builds itself.
var cache = null;

function invalidate() { cache = null; }

// MARK: - Identity

// Which story this is. The open folder where there is one — that is what a project means —
// and otherwise the single file being written, which is still a story, just a short one.
function projectKey() {
    var root = linelark.folderRoot();
    if (root) { return "p:" + root; }
    var path = linelark.filePath();
    if (path) { return "f:" + path; }
    var name = linelark.fileName();
    return name ? "u:" + name : null;
}

function projectName(key) {
    if (!key) { return "No story"; }
    var rest = key.slice(2);
    if (key.charAt(0) === "u") { return rest; }
    var last = rest.replace(/\/+$/, "").split("/").pop();
    return last || rest;
}

var made = 0;

function newID() {
    // Unique among one story's panes, which is a handful. There is no crypto here to reach
    // for and nothing that would be worth reaching for it — but the counter is not
    // decoration: seeding makes four in the same millisecond, and two panes that collided
    // on an id would collide on a store key and one of them would simply not be there.
    made += 1;
    return Date.now().toString(36) + made.toString(36)
         + Math.floor(Math.random() * 1296).toString(36);
}

// One key per pane rather than one per story, so a long pane cannot push the others past
// the limit on a single value, and so the pane list is the store's own key list rather than
// an index that has to be kept in step with it.
function storeKey(paneID, project) { return STORE_PREFIX + paneID + ":" + project; }

function splitKey(key) {
    if (key.indexOf(STORE_PREFIX) !== 0) { return null; }
    var rest = key.slice(STORE_PREFIX.length);
    var cut = rest.indexOf(":");
    if (cut < 1) { return null; }
    return { paneID: rest.slice(0, cut), project: rest.slice(cut + 1) };
}

// MARK: - The store

function readPane(paneID, project) {
    var raw = linelark.storeGet(storeKey(paneID, project));
    if (!raw) { return null; }
    try {
        var parsed = JSON.parse(raw);
        if (!parsed || !parsed.title) { return null; }
        return {
            id: paneID,
            title: String(parsed.title),
            hint: parsed.hint ? String(parsed.hint) : "",
            order: typeof parsed.order === "number" ? parsed.order : 0,
            text: parsed.text ? String(parsed.text) : "",
            updated: parsed.updated || ""
        };
    } catch (error) {
        // A pane this plugin cannot read is a pane it must not quietly overwrite.
        linelark.log("Could not read pane " + paneID + ": " + error);
        return null;
    }
}

function writePane(pane, project) {
    var payload = JSON.stringify({
        v: FORMAT, title: pane.title, hint: pane.hint,
        order: pane.order, text: pane.text, updated: pane.updated
    });
    // The one call that can be refused rather than throwing. A full store has to be said
    // out loud: the alternative is a panel that looks like it is saving and is not.
    var refusal = linelark.storeSet(storeKey(pane.id, project), payload);
    state.problem = refusal;
    return !refusal;
}

// Every pane of every story, read once. Grouped rather than filtered because the panel
// wants both this story's panes and a count of the others.
function allPanes() {
    if (cache) { return cache; }
    var keys = linelark.storeKeys();
    var stories = {};
    for (var i = 0; i < keys.length; i++) {
        var parts = splitKey(keys[i]);
        if (!parts) { continue; }
        var pane = readPane(parts.paneID, parts.project);
        if (!pane) { continue; }
        if (!stories[parts.project]) { stories[parts.project] = []; }
        stories[parts.project].push(pane);
    }
    for (var project in stories) {
        stories[project].sort(function (a, b) {
            return a.order - b.order || (a.title < b.title ? -1 : 1);
        });
    }
    cache = stories;
    return cache;
}

function panesOf(project) {
    if (!project) { return []; }
    return allPanes()[project] || [];
}

function paneByID(project, paneID) {
    var panes = panesOf(project);
    for (var i = 0; i < panes.length; i++) {
        if (panes[i].id === paneID) { return panes[i]; }
    }
    return null;
}

// MARK: - Editing

function seed(project) {
    for (var i = 0; i < SEED.length; i++) {
        var pane = { id: newID(), title: SEED[i].title, hint: SEED[i].hint,
                     order: i, text: "", updated: new Date().toISOString() };
        if (!writePane(pane, project)) { break; }
    }
    invalidate();
}

function addPane(project, title) {
    var panes = panesOf(project);
    var pane = { id: newID(), title: title, hint: "",
                 order: panes.length ? panes[panes.length - 1].order + 1 : 0,
                 text: "", updated: new Date().toISOString() };
    writePane(pane, project);
    invalidate();
    state.active = pane.id;
    return pane;
}

function savePane(project, paneID, text) {
    var pane = paneByID(project, paneID);
    if (!pane || pane.text === text) { return; }
    pane.text = text;
    pane.updated = new Date().toISOString();
    if (writePane(pane, project)) { state.savedAt = new Date(); }
    state.active = paneID;
}

function renamePane(project, paneID, title) {
    var pane = paneByID(project, paneID);
    if (!pane) { return; }
    pane.title = title;
    pane.updated = new Date().toISOString();
    writePane(pane, project);
    invalidate();
}

function deletePane(project, paneID) {
    linelark.storeRemove(storeKey(paneID, project));
    invalidate();
    delete state.rev[paneID];
    delete state.merge[paneID];
    if (state.active === paneID) { state.active = null; }
}

// Text added to a pane by this plugin rather than by typing into its box.
//
// The box may be in the middle of a sentence, and handing it a new `value` makes the host
// deliver the pending save rather than drop it — losing half a second of typing is the
// worse bug, so it is not the one the host chose. Which leaves this one: that save carries
// the text as it was *before* the append, and would undo it. So the addition is parked
// against the revision it was made at, and `onChange` re-applies it when the late save
// turns up bearing that revision.
function append(project, paneID, addition) {
    var pane = paneByID(project, paneID);
    if (!pane) { return false; }
    var separator = pane.text && !/\n\s*$/.test(pane.text) ? "\n\n" : "";
    var add = separator + addition;
    var updated = pane.text + add;
    var rev = state.rev[paneID] || 0;
    state.merge[paneID] = { rev: rev, add: add };
    state.rev[paneID] = rev + 1;
    savePane(project, paneID, updated);
    return true;
}

// MARK: - Drawing

function words(text) {
    var trimmed = String(text).replace(/^\s+|\s+$/g, "");
    return trimmed ? trimmed.split(/\s+/).length : 0;
}

function plural(count, one) {
    return count + " " + one + (count === 1 ? "" : "s");
}

function clock(date) {
    var hours = String(date.getHours());
    var minutes = String(date.getMinutes());
    return (hours.length < 2 ? "0" : "") + hours + ":"
         + (minutes.length < 2 ? "0" : "") + minutes;
}

function fieldID(pane) { return "pane:" + pane.id + "@" + (state.rev[pane.id] || 0); }

function paneSection(project, pane) {
    var children = [];
    // The *stored* text, on every draw — never the text being typed, which is the box's own
    // and would move the cursor to the end if it were handed back.
    //
    // Handing back what is stored is safe precisely because of when it changes. While
    // somebody types it does not change at all, so the view sees the same value it already
    // adopted and leaves the box alone. It changes when a save lands, and at that moment it
    // is equal to what the box already holds. And it is what makes the box survive being
    // thrown away and rebuilt — switching panels in the dock does that — with the text that
    // is actually stored rather than whatever it said when the panel first opened.
    var field = {
        type: "field",
        id: fieldID(pane),
        placeholder: pane.hint || "Whatever this pane is for.",
        value: pane.text,
        multiline: true,
        submit: "Save now",
        enabled: true
    };
    children.push(field);

    if (state.renaming === pane.id) {
        children.push({ type: "field", id: "rename:" + pane.id, label: "Rename this pane",
                        placeholder: pane.title, value: pane.title,
                        multiline: false, submit: "Rename", enabled: true });
    }

    var deleting = state.confirming === pane.id;
    children.push({
        type: "actions",
        actions: [
            { id: "capture:" + pane.id, title: "Add the selected text to " + pane.title,
              symbol: "text.append" },
            { id: "insert:" + pane.id, title: "Insert " + pane.title + " into the document",
              symbol: "text.insert" },
            { id: "copy:" + pane.id, title: "Copy " + pane.title, symbol: "doc.on.doc" },
            { id: "rename:" + pane.id, title: "Rename " + pane.title, symbol: "pencil" },
            { id: "delete:" + pane.id,
              title: deleting ? "Click again to delete " + pane.title + " for good"
                              : "Delete " + pane.title,
              symbol: deleting ? "trash.fill" : "trash", tint: "negative" }
        ]
    });

    return {
        type: "section",
        // Stable across draws and across a rename, because it is what the view remembers
        // "this one is open" against.
        id: "pane:" + pane.id,
        title: pane.title + " · " + plural(words(pane.text), "word"),
        // How it *starts*, once, on the first draw of a session: the first pane open and
        // the rest folded. After that whoever clicked it owns it.
        collapsed: pane.order !== 0,
        children: children
    };
}

function otherStoryRows(exceptProject) {
    var stories = allPanes();
    var rows = [];
    for (var project in stories) {
        if (project === exceptProject) { continue; }
        var panes = stories[project];
        var total = 0;
        for (var i = 0; i < panes.length; i++) { total += words(panes[i].text); }
        rows.push({
            id: "story:" + project,
            title: projectName(project),
            detail: plural(panes.length, "pane") + " · " + plural(total, "word"),
            symbol: project.charAt(0) === "p" ? "folder" : "doc.text"
        });
    }
    rows.sort(function (a, b) { return a.title < b.title ? -1 : 1; });
    return rows;
}

function panelNodes() {
    invalidate();
    var project = projectKey();
    if (project !== state.project) {
        // A different story: nothing carried over describes it.
        state.project = project;
        state.rev = {};
        state.merge = {};
        state.active = null;
        state.renaming = null;
        state.confirming = null;
        state.notice = null;
    }

    var panes = panesOf(project);
    var nodes = [];

    nodes.push({ type: "heading", text: projectName(project) });

    // Always drawn, whatever it has to say. Its words change; its existence does not,
    // because a node that comes and goes shifts every box below it onto another pane.
    var total = 0;
    for (var i = 0; i < panes.length; i++) { total += words(panes[i].text); }
    var status = plural(panes.length, "pane") + " · " + plural(total, "word");
    if (state.savedAt) { status += " · saved " + clock(state.savedAt); }
    if (state.notice) { status = state.notice + " · " + status; }
    nodes.push({ type: "text", text: status });

    if (state.problem) {
        nodes.push({ type: "heading", text: "Not saved" });
        nodes.push({ type: "text", text: state.problem, style: "primary" });
    }

    if (!project) {
        nodes.push({ type: "text",
                     text: "Open the folder your story lives in, and its bible appears here.",
                     style: "primary" });
    } else if (!panes.length) {
        nodes.push({ type: "text",
                     text: "Nothing kept for this story yet. Characters, Plot, Places and "
                         + "Notes is a start; rename them, delete them, add your own.",
                     style: "primary" });
        nodes.push({ type: "button", id: "seed",
                     title: "Start a bible for " + projectName(project),
                     symbol: "books.vertical", prominent: true });
    } else {
        nodes.push({
            type: "actions",
            actions: [
                { id: "copyAll", title: "Copy the whole bible", symbol: "doc.on.doc" },
                { id: "export", title: "Export the whole bible as Markdown",
                  symbol: "square.and.arrow.up" }
            ]
        });
        for (var p = 0; p < panes.length; p++) {
            nodes.push(paneSection(project, panes[p]));
        }
        nodes.push({
            type: "section", id: "add", title: "Add a pane", collapsed: true,
            children: [{ type: "field", id: "new", label: "Name it",
                         placeholder: "Timeline, Research, Cut lines…",
                         value: state.newValue, multiline: false,
                         submit: "Add", enabled: true }]
        });
    }

    var others = otherStoryRows(project);
    if (others.length) {
        nodes.push({ type: "section", id: "others",
                     title: "Other stories · " + others.length, collapsed: true,
                     children: [{ type: "rows", rows: others }] });
    }
    return nodes;
}

// Empty the "add a pane" box after it has been used.
//
// A box adopts a new `value` only when it differs from the last one it was handed, and this
// one has been handed "" since the panel opened — so setting it to "" again does nothing and
// the name just added stays there, ready to be added a second time. Handing back what is
// already typed and then emptying it is two draws, and the timer is how a plugin gets a
// second one.
function emptyTheNameBox(typed) {
    state.newValue = typed;
    setTimeout(function () {
        state.newValue = "";
        linelark.refreshPanels();
    }, 0);
}

// MARK: - Handing it out

function bibleText(project) {
    var panes = panesOf(project);
    if (!panes.length) { return null; }
    var lines = ["# " + projectName(project), ""];
    for (var i = 0; i < panes.length; i++) {
        lines.push("## " + panes[i].title);
        lines.push("");
        lines.push(panes[i].text || "_(empty)_");
        lines.push("");
    }
    return lines.join("\n");
}

function exportBible(project) {
    var text = bibleText(project);
    if (!text) { return false; }
    return linelark.exportFile({ name: projectName(project) + " bible.md", text: text });
}

// MARK: - The panel

linelark.addPanel({
    id: "bible",
    title: "Bible",
    symbol: "books.vertical",
    side: "right",
    render: panelNodes,

    // Delivered on a debounce while somebody is still typing, and — because the host
    // flushes rather than drops — sometimes describing a box this plugin has since
    // rewritten. The revision in the id is what tells those apart.
    onChange: function (id, value) {
        invalidate();
        if (id.indexOf("pane:") !== 0) { return; }
        var rest = id.slice(5);
        var at = rest.lastIndexOf("@");
        var paneID = at === -1 ? rest : rest.slice(0, at);
        var rev = at === -1 ? 0 : Number(rest.slice(at + 1));
        var project = state.project;

        var parked = state.merge[paneID];
        if (parked && parked.rev === rev) {
            // This save was typed before the append and would undo it. Re-apply the
            // addition to what was typed, so both survive, and hand the result back to the
            // box — which is the only way it stops showing something the store disagrees
            // with.
            delete state.merge[paneID];
            savePane(project, paneID, value + parked.add);
            state.rev[paneID] = (state.rev[paneID] || 0) + 1;
            linelark.refreshPanels();
            return;
        }
        savePane(project, paneID, value);
        // Safe to redraw while typing only because the node list does not change shape
        // when it does, and worth it because the word counts are the reason to look.
        linelark.refreshPanels();
    },

    // The button beside a box. The debounce has already saved; this is for the people who
    // do not believe it.
    onSubmit: function (id, value) {
        invalidate();
        var project = state.project;
        if (id === "new") {
            var title = value.replace(/^\s+|\s+$/g, "");
            if (title) { addPane(project, title); }
            emptyTheNameBox(value);
        } else if (id.indexOf("rename:") === 0) {
            var name = value.replace(/^\s+|\s+$/g, "");
            if (name) { renamePane(project, id.slice(7), name); }
            state.renaming = null;
        } else if (id.indexOf("pane:") === 0) {
            var rest = id.slice(5);
            var at = rest.lastIndexOf("@");
            savePane(project, at === -1 ? rest : rest.slice(0, at), value);
        } else {
            return;
        }
        linelark.refreshPanels();
    },

    onSelect: function (id) {
        invalidate();
        var project = state.project;
        var cut = id.indexOf(":");
        var verb = cut === -1 ? id : id.slice(0, cut);
        var rest = cut === -1 ? "" : id.slice(cut + 1);
        // Any other click is the answer to "did you mean it?" being no.
        if (verb !== "delete") { state.confirming = null; }
        state.notice = null;

        if (verb === "seed") {
            seed(project);
        } else if (verb === "capture") {
            var selected = linelark.selection();
            if (!selected) {
                state.notice = "Select something first";
            } else if (append(project, rest, selected)) {
                var into = paneByID(project, rest);
                state.notice = "Added to " + (into ? into.title : "the pane");
                state.active = rest;
            }
        } else if (verb === "insert") {
            var source = paneByID(project, rest);
            if (!source) { return; }
            if (linelark.isReadOnly()) {
                state.notice = "This document is read-only";
            } else {
                linelark.insert(source.text);
                state.active = rest;
            }
        } else if (verb === "copy") {
            var copying = paneByID(project, rest);
            if (copying) {
                linelark.copyToClipboard(copying.text);
                state.notice = "Copied " + copying.title;
                state.active = rest;
            }
        } else if (verb === "copyAll") {
            var whole = bibleText(project);
            if (whole) {
                linelark.copyToClipboard(whole);
                state.notice = "Copied the bible";
            }
        } else if (verb === "rename") {
            state.renaming = state.renaming === rest ? null : rest;
        } else if (verb === "delete") {
            if (state.confirming === rest) {
                state.confirming = null;
                deletePane(project, rest);
            } else {
                state.confirming = rest;
            }
        } else if (verb === "export") {
            exportBible(project);
        } else if (verb === "story") {
            // A folder cannot be opened from here — there is no call for it — but a story
            // that is one file can be, and saying so beats a row that does nothing.
            if (rest.charAt(0) === "f") {
                linelark.openFile(rest.slice(2));
            } else {
                state.notice = "Open that folder to see its bible";
            }
        } else {
            return;
        }
        linelark.refreshPanels();
    }
});

// MARK: - Commands
//
// The same things from the Plugins menu, which is also how they get keyboard shortcuts:
// macOS binds any menu item under System Settings ▸ Keyboard ▸ Keyboard Shortcuts ▸ App
// Shortcuts, and a menu item is the only thing a plugin can offer to be bound.

// Which pane a command without a pane in front of it means: the last one touched, and
// otherwise the first, which is Characters in a bible nobody has rearranged.
function activePane(project) {
    var panes = panesOf(project);
    if (!panes.length) { return null; }
    return (state.active && paneByID(project, state.active)) || panes[0];
}

linelark.addCommand("capture", "Add the Selection to the Story Bible", function () {
    invalidate();
    var project = projectKey();
    var pane = activePane(project);
    if (!pane) { return linelark.log("There is no bible for this story yet."); }
    var selected = linelark.selection();
    if (!selected) { return linelark.log("Select something to add first."); }
    append(project, pane.id, selected);
    state.notice = "Added to " + pane.title;
    linelark.refreshPanels();
});

linelark.addCommand("copy", "Copy the Story Bible", function () {
    invalidate();
    var text = bibleText(projectKey());
    if (!text) { return linelark.log("There is no bible for this story yet."); }
    linelark.copyToClipboard(text);
});

linelark.addCommand("export", "Export the Story Bible", function () {
    invalidate();
    if (!exportBible(projectKey())) { linelark.log("There is nothing to export."); }
});
