// Launcher — the things this project *runs*, kept next to it and started in one click.
//
// A project is rarely one program. It is a server, a worker, a watcher and a test run, each
// with its own folder and its own two or three lines to start it — and all of them live in
// somebody's head, in a README nobody reads twice, or in shell history. This panel is
// somewhere to put them.
//
// **Running goes to a terminal, and that is the feature rather than a limitation.** The
// host will not start a hidden process for a plugin: `runInTerminal` types the lines at a
// shell in the terminal panel, which is then shown. So the output is the terminal's, ⌃C
// stops it, a password prompt can be answered, and ↑ runs it again after the panel is
// closed. Nothing comes back to this plugin — there is no exit status here, and a panel
// that claimed to know one would be inventing it.
//
// **The list is the launcher; the sections are the settings.** Clicking a row runs it,
// which is the thing done fifty times a day. Editing one is a section that has to be opened
// first, which is the thing done twice. Neither is hidden behind the other.
//
// **Everything saves as it is typed.** There is no Save button, deliberately. A form that
// accumulates what is typed and commits it on a click loses whatever was typed in the last
// half-second before that click — `onChange` arrives on a debounce, so the click can beat
// the keystrokes to the store. Saving each box as it settles has no such window, and it is
// why every field's `value` can be the stored text on every draw.
//
// **A field's id carries which application it belongs to.** `onChange` is delivered late by
// construction, and it can land after the panel has moved on. Delivered with the id it was
// scheduled with, `name:ab12` says which record the text was for, so a late save writes to
// the application it was typed into rather than to whichever one is in front now. The
// folder box carries a revision as well — `folder:ab12@3` — because Browse is the one thing
// here that rewrites a box somebody may have been typing in, and the save still in flight
// from before it has to be recognisable as belonging to an era that has ended.

var STORE_KEY = "apps";
var LAST_KEY = "last";
var FORMAT = 1;

// One line of ready-made example, so an empty panel says what a command is supposed to
// look like rather than asking for one.
var EXAMPLE = "npm start";

// What the panel knows that the store does not.
var state = {
    // The application whose section was opened by being added, so it starts open once. The
    // view owns every section after its first draw; this only decides how a new one arrives.
    justAdded: null,
    // A delete is two clicks. A plugin cannot put a question on the screen, and these three
    // boxes are the only copy of themselves.
    confirming: null,
    // application id -> how many times Browse has rewritten that folder box. It rides in
    // the field's id, which is the only way to tell a save typed *before* the panel opened
    // from one typed after it. See `onChange`.
    folderRev: {},
    // What went wrong last, as {title, text, settings} — the title because a store that
    // refused a write and a command that could not start are not the same news, and
    // `settings` because only one of them has a switch to go and turn on.
    problem: null,
    ranName: null,
    ranAt: null
};

// One read of the store per draw: the panel asks for the same list four or five times as it
// builds itself, and the store is a file.
var cache = null;

function invalidate() { cache = null; }

// MARK: - The store

// Everything in one value rather than a key each. An application is a name, a folder and a
// few lines — a hundred of them are still far inside the 256 KB a value may hold — and one
// value keeps the *order* the user put them in, which a key list does not have.
function readApps() {
    if (cache) { return cache; }
    cache = [];
    var raw = linelark.storeGet(STORE_KEY);
    if (!raw) { return cache; }
    var parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        // Kept rather than thrown away: something wrote this, and the panel saying so is
        // better than a launcher that is silently empty one morning.
        state.problem = { title: "Could not be read",
                          text: "The saved applications could not be read." };
        return cache;
    }
    var list = parsed && parsed.apps;
    if (!list || !list.length) { return cache; }
    for (var i = 0; i < list.length; i++) {
        var app = list[i];
        if (!app || !app.id) { continue; }
        cache.push({
            id: String(app.id),
            name: String(app.name || "Untitled"),
            folder: String(app.folder || ""),
            commands: String(app.commands || "")
        });
    }
    return cache;
}

// `storeSet` *returns* its refusal rather than throwing one, and a panel that ignores it is
// a panel that looks like it is saving and is not.
function writeApps(apps) {
    cache = apps;
    var refusal = linelark.storeSet(STORE_KEY, JSON.stringify({ format: FORMAT, apps: apps }));
    state.problem = refusal ? { title: "Not saved", text: refusal } : null;
    return !refusal;
}

var made = 0;

function newID() {
    // Unique among one person's applications, which is a handful. The counter is not
    // decoration: two added in the same millisecond would otherwise share an id, and an id
    // is what a field's late save is addressed to.
    made += 1;
    return Date.now().toString(36) + made.toString(36)
         + Math.floor(Math.random() * 1296).toString(36);
}

function appByID(id) {
    var apps = readApps();
    for (var i = 0; i < apps.length; i++) {
        if (apps[i].id === id) { return apps[i]; }
    }
    return null;
}

function addApp() {
    var apps = readApps().slice();
    var app = { id: newID(), name: "New application", folder: "", commands: "" };
    apps.push(app);
    if (!writeApps(apps)) { return null; }
    state.justAdded = app.id;
    state.confirming = null;
    return app;
}

function deleteApp(id) {
    var apps = readApps();
    var kept = [];
    for (var i = 0; i < apps.length; i++) {
        if (apps[i].id !== id) { kept.push(apps[i]); }
    }
    writeApps(kept);
    state.confirming = null;
}

// One field of one application, from a box that has just settled.
function updateApp(id, key, value) {
    var apps = readApps();
    var found = false;
    for (var i = 0; i < apps.length; i++) {
        if (apps[i].id === id) {
            apps[i][key] = value;
            found = true;
        }
    }
    // A save that arrives for something deleted while it was in flight is not an error, and
    // must not resurrect it.
    if (found) { writeApps(apps); }
}

// MARK: - Running

// The lines to type, from the box they were written in.
//
// They run in this order, each whether or not the one above it worked, which is why `npm ci
// && npm start` on one line is the way to say "only if that succeeded". The host types them
// as a single shell line for a reason worth knowing: typed one at a time, the later ones
// wait in the terminal's input buffer while the first runs, and `sudo` reads the next
// command as its password. Blank lines are spacing rather than commands.
function commandLines(text) {
    var lines = String(text || "").split("\n");
    var kept = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].replace(/^\s+|\s+$/g, "");
        if (line) { kept.push(line); }
    }
    return kept;
}

// Why nothing can be run, in the order the reader can do something about it.
//
// The two reasons cannot be told apart from here — `canRunInTerminal()` is one boolean, and
// a plugin has no way to ask which edition it is in — so the likelier one goes first and
// the other is named rather than left as a mystery.
function whyNotRunning() {
    return "Linelark will not run anything for this plugin yet. Turn on “Allow running "
         + "commands” for Launcher in Manage Plugins. The App Store edition has no terminal "
         + "at all, and there it cannot be turned on.";
}

function runApp(app) {
    state.problem = null;
    var lines = commandLines(app.commands);
    if (!lines.length) {
        state.problem = { title: "Nothing to run",
                          text: "“" + app.name + "” has no commands yet. Open its settings "
                              + "and write what starts it." };
        return;
    }
    if (!linelark.canRunInTerminal()) {
        state.problem = { title: "Not allowed to run", text: whyNotRunning(), settings: true };
        return;
    }
    try {
        // Called straight from the click. The host refuses this from a timer or a draw, and
        // an `await` anywhere above here would end the gesture it is checking for.
        linelark.runInTerminal({
            name: app.name,
            // Empty means the folder in front, which the host resolves. A launcher for the
            // project you are looking at is a reasonable thing to want, and a folder box
            // nobody filled in is how it is asked for.
            folder: app.folder,
            commands: lines
        });
    } catch (e) {
        // Everything the host refuses arrives here as an exception, and its message names
        // the thing to fix — a folder that is not there, a command with a newline in it,
        // a permission switched off since the panel was drawn.
        state.problem = { title: "Did not run", text: e.message, settings: true };
        return;
    }
    state.ranName = app.name;
    state.ranAt = new Date();
    // Which one ⌘-something means next time, kept in the store so it survives a relaunch.
    linelark.storeSet(LAST_KEY, app.id);
}

// MARK: - Drawing

function clock(date) {
    var hours = String(date.getHours());
    var minutes = String(date.getMinutes());
    return (hours.length < 2 ? "0" : "") + hours + ":"
         + (minutes.length < 2 ? "0" : "") + minutes;
}

function plural(count, one) {
    return count + " " + one + (count === 1 ? "" : "s");
}

function lastComponent(path) {
    var trimmed = String(path).replace(/\/+$/, "");
    if (!trimmed) { return ""; }
    return trimmed.split("/").pop() || trimmed;
}

// What a row says about itself under its name: the first command, which is what people
// actually recognise an application by, and how many more there are behind it.
function rowDetail(app) {
    var lines = commandLines(app.commands);
    if (!lines.length) { return "No commands yet"; }
    if (lines.length === 1) { return lines[0]; }
    return lines[0] + " · " + plural(lines.length - 1, "more line");
}

function appRows() {
    var apps = readApps();
    var rows = [];
    for (var i = 0; i < apps.length; i++) {
        var app = apps[i];
        var empty = !commandLines(app.commands).length;
        rows.push({
            id: "run:" + app.id,
            title: app.name,
            detail: rowDetail(app),
            symbol: empty ? "exclamationmark.triangle" : "play.fill",
            // The folder is the other half of what an application is, and the part that
            // decides whether the right project is about to be started.
            badge: lastComponent(app.folder) || "in front",
            badgeTint: empty ? "warning" : "neutral"
        });
    }
    return rows;
}

// The folder box's id, with the revision that says which era of it a save belongs to.
// Browse is the one thing here that writes into a box somebody may be typing in, and
// `onChange` is delivered late enough to arrive afterwards holding the old text.
function folderFieldID(app) { return "folder:" + app.id + "@" + (state.folderRev[app.id] || 0); }

function appSection(app) {
    var deleting = state.confirming === app.id;
    return {
        type: "section",
        // Stable across draws and across a rename: it is what the view remembers "this one
        // is open" against.
        id: "app:" + app.id,
        title: app.name,
        // How it *starts*, and only the once. A newly added application opens itself,
        // because it was added in order to be filled in; everything else arrives folded and
        // is then owned by whoever clicks it.
        collapsed: app.id !== state.justAdded,
        children: [
            // The identity rides in every id. `onChange` can be delivered after the panel
            // has moved on, and it comes back with the id it was scheduled with — so a late
            // save lands on the application it was typed into.
            { type: "field", id: "name:" + app.id, label: "Name",
              placeholder: "What you will call it here",
              // The *stored* value, every draw. Never the live text: handing back what was
              // just typed rewrites the box under the cursor. While somebody types this
              // does not change, so the view leaves the box alone; the moment a save lands
              // it is equal to what the box already holds.
              value: app.name, multiline: false, submit: "Save now", enabled: true },
            { type: "field", id: folderFieldID(app), label: "Folder",
              placeholder: linelark.folderRoot() || "The folder in front",
              value: app.folder, multiline: false, submit: "Save now", enabled: true },
            // Under the box it fills in, and labelled. It was an icon in the strip at the
            // bottom, where nothing said which of the three boxes it was about.
            { type: "button", id: "browse:" + app.id, title: "Choose a folder…",
              symbol: "folder", prominent: false },
            { type: "field", id: "commands:" + app.id, label: "Commands, one per line",
              placeholder: EXAMPLE,
              value: app.commands, multiline: true, submit: "Save now", enabled: true },
            {
                type: "actions",
                actions: [
                    { id: "run:" + app.id, title: "Run " + app.name, symbol: "play.fill" },
                    { id: "copy:" + app.id, title: "Copy these commands",
                      symbol: "doc.on.doc" },
                    { id: "delete:" + app.id,
                      title: deleting ? "Click again to delete " + app.name + " for good"
                                      : "Delete " + app.name,
                      symbol: deleting ? "trash.fill" : "trash", tint: "negative" }
                ]
            }
        ]
    };
}

function panelNodes() {
    invalidate();
    var apps = readApps();
    var nodes = [];

    // Always drawn, whatever it has to say. Its words change; its existence does not,
    // because a line that comes and goes slides every box below it onto another
    // application's contents while somebody is typing into one of them.
    var status = apps.length ? plural(apps.length, "application") : "Nothing to run yet";
    if (state.ranAt) { status += " · ran " + state.ranName + " at " + clock(state.ranAt); }
    nodes.push({ type: "text", text: status });

    if (state.problem) {
        nodes.push({ type: "heading", text: state.problem.title });
        nodes.push({ type: "text", text: state.problem.text, style: "primary" });
        // Where the switch is, since naming a sheet is not the same as opening it.
        if (state.problem.settings) {
            nodes.push({ type: "button", id: "settings",
                         title: "Open Launcher's permissions", symbol: "lock.open",
                         prominent: false });
        }
    }

    if (apps.length) {
        nodes.push({ type: "rows", rows: appRows() });
        nodes.push({ type: "text", text: "Click one to run it in the terminal." });
    } else {
        nodes.push({ type: "text", style: "primary",
                     text: "Add the things this project runs — a server, a worker, a test "
                         + "run — and each becomes one click and its own terminal." });
    }

    nodes.push({ type: "button", id: "add", title: "Add an application", symbol: "plus",
                 // The single obvious next step, and only while it is the only one.
                 prominent: !apps.length });

    if (apps.length) {
        nodes.push({ type: "heading", text: "Settings" });
        for (var i = 0; i < apps.length; i++) { nodes.push(appSection(apps[i])); }
    }
    return nodes;
}

// The folder panel, and what has to happen around it.
//
// Writing the chosen path into the store rewrites the box — and a save typed a moment
// before the panel opened is still in flight, holding what the box said then. Bumping the
// revision is what makes that one recognisable when it lands: it names an era that has
// ended, and the pick the user just made wins over the typing it replaced.
function chooseFolderFor(app) {
    var chosen = linelark.chooseFolder({
        message: "Where should “" + app.name + "” run?"
    });
    // Cancelled. Not an error, and not a reason to clear what is already there.
    if (!chosen) { return; }
    state.folderRev[app.id] = (state.folderRev[app.id] || 0) + 1;
    updateApp(app.id, "folder", chosen);
}

// Which box a delivered id belongs to, and — for the folder box — which era of it.
//
// Shared by `onChange` and `onSubmit` because the host draws a submit button beside every
// field whether or not a plugin asks for one: a panel that handles only the debounce has a
// button on screen that does nothing.
function fieldTarget(id) {
    var cut = id.indexOf(":");
    if (cut === -1) { return null; }
    var key = id.slice(0, cut);
    var rest = id.slice(cut + 1);
    if (key !== "name" && key !== "folder" && key !== "commands") { return null; }
    if (key !== "folder") { return { key: key, appID: rest, rev: null }; }
    var at = rest.lastIndexOf("@");
    return {
        key: key,
        appID: at === -1 ? rest : rest.slice(0, at),
        rev: at === -1 ? 0 : Number(rest.slice(at + 1))
    };
}

function saveField(target, value) {
    // A name is what the row and the section are called, so an empty one would leave a
    // nameless entry nobody can tell from another. The rest may be empty: no folder means
    // the folder in front, and no commands means an application still being written down.
    var text = target.key === "name" ? value.replace(/^\s+|\s+$/g, "") : value;
    if (target.key === "name" && !text) { text = "Untitled"; }
    updateApp(target.appID, target.key, text);
}

// MARK: - The panel

linelark.addPanel({
    id: "launcher",
    title: "Launcher",
    symbol: "play.rectangle",
    side: "right",
    // Deliberately not `followsCaret`: what this panel shows is not a function of where the
    // caret is, and redrawing it on every keystroke would fight the person typing into it.
    render: panelNodes,

    // A row, or one of the icons under an open section.
    onSelect: function (id) {
        invalidate();
        // Rows, actions and buttons all arrive here, with nothing to tell them apart but
        // the id — which is why every one of them is written verb-first.
        var cut = id.indexOf(":");
        var verb = cut === -1 ? id : id.slice(0, cut);
        var appID = cut === -1 ? "" : id.slice(cut + 1);
        // Last time's bad news is not this click's. Whatever goes wrong now says so again.
        state.problem = null;
        // A newly added section opens itself once. Any other click means the panel has been
        // used since, and the view has owned that section from its first draw anyway.
        if (verb !== "add") { state.justAdded = null; }

        if (verb === "add") {
            addApp();
        } else if (verb === "settings") {
            linelark.openPluginSettings();
            return;
        } else if (verb === "run") {
            var app = appByID(appID);
            if (app) { runApp(app); }
        } else if (verb === "browse") {
            var picking = appByID(appID);
            // Straight from the click: the host refuses to put a panel on screen for a
            // timer or a draw, and an `await` above this would end the gesture.
            if (picking) { chooseFolderFor(picking); }
        } else if (verb === "copy") {
            var copying = appByID(appID);
            if (copying) { linelark.copyToClipboard(commandLines(copying.commands).join("\n")); }
        } else if (verb === "delete") {
            if (state.confirming === appID) { deleteApp(appID); }
            else { state.confirming = appID; }
        } else {
            return;
        }
        // A click that changed something is a click the panel has to redraw for: the
        // sections are drawn from the store, and the store has just moved.
        linelark.refreshPanels();
    },

    // Delivered roughly 0.6 s after typing stops, and sometimes after the panel has been
    // shown something else entirely. The id says which application it was typed into.
    onChange: function (id, value) {
        invalidate();
        var target = fieldTarget(id);
        if (!target) { return; }
        // Typed before a Browse rewrote this box, delivered after it. Taking it at face
        // value would undo the folder the user has just chosen — so the era it was
        // scheduled in is what decides, not the order it arrived in.
        if (target.rev !== null && target.rev !== (state.folderRev[target.appID] || 0)) {
            return;
        }
        saveField(target, value);
        // As soon as the save lands. Without this the next redraw hands the box the value
        // as it was *before* the save, and what was just typed appears to vanish. It is
        // safe only because the node list does not change shape when something is saved —
        // a row's words change, its existence does not.
        linelark.refreshPanels();
    },

    // The button beside a box. The debounce has already saved; this is for the people who
    // do not believe it — and it is delivered with what the box holds *now*, so no revision
    // can make it stale the way a scheduled call can.
    onSubmit: function (id, value) {
        invalidate();
        var target = fieldTarget(id);
        if (!target) { return; }
        saveField(target, value);
        linelark.refreshPanels();
    }
});

// MARK: - Commands
//
// The Plugins menu, which is also how these get keyboard shortcuts: macOS binds any menu
// item under System Settings ▸ Keyboard ▸ Keyboard Shortcuts ▸ App Shortcuts, and a menu
// item is the only thing a plugin can offer to be bound.

// What "again" means when nothing has run in this session: the one that ran last time the
// app was open, and otherwise the first, which is the only reasonable guess left.
function lastApp() {
    var apps = readApps();
    if (!apps.length) { return null; }
    return appByID(linelark.storeGet(LAST_KEY) || "") || apps[0];
}

linelark.addCommand("run", "Run the Last Application", function () {
    invalidate();
    var app = lastApp();
    if (!app) { return linelark.log("Nothing is configured to run yet."); }
    state.problem = null;
    runApp(app);
    // A command has no panel in front of it, so the log is where it can say what happened.
    if (state.problem) { linelark.log(state.problem.text); }
    linelark.refreshPanels();
});
