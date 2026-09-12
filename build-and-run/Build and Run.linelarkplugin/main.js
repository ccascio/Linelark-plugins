// Build and Run — a scheme, a destination, and a command you can watch.
//
// Xcode's own build is not reimplemented here and could not be. What this panel does is the
// small part that was missing: find out what the project contains, let you choose from it,
// and hand the resulting `xcodebuild` line to the terminal panel where it runs in front of
// you. The command is the product, not a hidden side effect — you can read it, stop it with
// ⌃C, scroll back through it, and copy it into a script when you want it in CI.
//
// Four things shape the whole file.
//
// **Discovery is a query; doing anything is a shell.** `linelark.runQuery` runs one command
// out of sight and hands back what it printed, which is the only way a panel can know that
// this project has two schemes called what they are called. `linelark.runInTerminal` types
// a line at a visible shell and tells you nothing, which is right for a build: the output
// *is* the point, and a build that failed is something to read rather than a boolean. Using
// either one for the other's job would be worse in both directions.
//
// **A click is the unit of permission, and an `await` ends it.** Both calls are refused
// unless they are the direct result of the user pressing something, so every query this
// panel makes is issued *synchronously* inside one handler — see `scan`, which fires three
// at once with `Promise.all` rather than awaiting them one after another. The second of two
// awaited queries would simply be refused, and correctly: a plugin that could go on asking
// after the click is a plugin that runs commands when nobody is at the machine.
//
// **The panel never queries to draw itself.** `render()` reads only what a previous scan
// put in `state`. A panel is redrawn whenever the workspace changes — a keystroke, a tab
// switch, a file saved — and `xcodebuild -list` takes the better part of a second, so a
// render that asked would make the sidebar unusable and the machine hot. Scanning is a
// button, and what it found is remembered per folder across launches.
//
// **The scheme list and the simulator list are the project's words, not ours.** Nothing
// here has a table of device names or a guess at what a scheme is called. That matters more
// than it sounds: the vocabulary of an Xcode project changes with every Xcode release, and
// a plugin that shipped a list of it would be wrong by the following autumn.

var PANEL = "build";
var STORE_PREFIX = "project:";
// Where builds go. Deliberately not inside the project: a `-derivedDataPath` under the
// folder being edited puts a large build directory into somebody's repository, and the
// first they would know of it is their version control showing a thousand new files.
var DERIVED = '"$TMPDIR/linelark-build"';

// Everything the panel draws. Redraws are frequent and none of this survives them on its
// own, so it lives here rather than being worked out again each time.
var state = {
    // The workspace folder this panel is about. Null means "whichever folder holds the tab
    // in front", which is the right default and the only one a single-folder window needs.
    project: null,
    // What `xcodebuild` should be pointed at: {flag: "-workspace"|"-project", name: "…"}.
    // Null means it worked that out for itself, which it can whenever it is not ambiguous.
    container: null,
    // What it resolved to, in its own answer: {kind: "workspace"|"project", name: "…"}.
    // Worth keeping rather than inferring, because with both a project and a workspace in
    // one folder `xcodebuild` picks one without being asked and without saying which — and
    // "which of these am I building" is exactly the question a panel is there to answer.
    resolved: null,
    // The candidates, when there were several and it could not. Shown so the answer can be
    // given by pressing one, which is a click, which is what a second query needs.
    containers: [],
    schemes: [],
    destinations: [],
    scheme: null,
    destination: null,
    scanning: false,
    scanned: false,
    // The last thing that happened, in the tool's own words where there are any. A panel
    // that fails silently is indistinguishable from one that is broken.
    note: null,
    noteTint: null
};

// MARK: - Shell quoting
//
// The one thing this plugin is responsible for that the host cannot do for it. `runQuery`
// takes an argument list and has no shell at all, so nothing there needs quoting — but
// `runInTerminal` types a line *at* a shell, and a scheme called `My App (Beta)` is three
// words and a subshell unless it is quoted. Single quotes, with the one escape that works
// inside them: end the quoting, add an escaped quote, start it again.
function sh(value) {
    return "'" + String(value).split("'").join("'\\''") + "'";
}

// MARK: - Remembering a choice
//
// Per folder, because a window can hold several projects and the scheme chosen for one says
// nothing about the other. Stored rather than kept in memory so that reopening the project
// tomorrow does not mean scanning it again before anything can be pressed.
function storageKey() {
    return STORE_PREFIX + (state.project || linelark.folderRoot() || "");
}

function remember() {
    var refusal = linelark.storeSet(storageKey(), JSON.stringify({
        container: state.container,
        resolved: state.resolved,
        schemes: state.schemes,
        destinations: state.destinations,
        scheme: state.scheme,
        destination: state.destination
    }));
    // `storeSet` returns its refusal rather than throwing, and a panel that ignores one
    // looks like it is saving and is not.
    if (refusal) linelark.log("could not remember this project: " + refusal);
}

function recall() {
    var raw = linelark.storeGet(storageKey());
    if (!raw) {
        state.container = null;
        state.resolved = null;
        state.containers = [];
        state.schemes = [];
        state.destinations = [];
        state.scheme = null;
        state.destination = null;
        state.scanned = false;
        return;
    }
    try {
        var saved = JSON.parse(raw);
        state.container = saved.container || null;
        state.resolved = saved.resolved || null;
        state.schemes = saved.schemes || [];
        state.destinations = saved.destinations || [];
        state.scheme = saved.scheme || null;
        state.destination = saved.destination || null;
        state.scanned = state.schemes.length > 0;
    } catch (e) {
        linelark.log("stored project details could not be read: " + e.message);
        state.scanned = false;
    }
}

// MARK: - Reading what the tools said

// `xcrun simctl list -j` groups devices by runtime identifier. The identifier is the only
// place the OS version appears, so it is parsed rather than ignored: "iPhone 17 Pro" on its
// own does not say which iOS it is, and a project that supports two of them shows the same
// name twice.
function runtimeName(identifier) {
    var tail = identifier.split(".").pop();          // iOS-26-5
    var parts = tail.split("-");
    var platform = parts.shift();
    return parts.length ? platform + " " + parts.join(".") : platform;
}

// Which product directory a build for this destination lands in. Derived from the platform
// rather than assumed to be iOS: a watchOS scheme builds into `Debug-watchsimulator`, and
// looking in the wrong one is an error whose message ("no such file") says nothing about
// the actual mistake.
function productDirectory(destination) {
    if (destination.kind === "mac") return "Debug";
    var platform = (destination.platform || "iOS").toLowerCase();
    if (platform.indexOf("watch") === 0) return "Debug-watchsimulator";
    if (platform.indexOf("tv") === 0) return "Debug-appletvsimulator";
    if (platform.indexOf("xr") === 0 || platform.indexOf("vision") === 0) return "Debug-xrsimulator";
    return "Debug-iphonesimulator";
}

function readSimulators(json) {
    var devices = [];
    var parsed;
    try {
        parsed = JSON.parse(json).devices || {};
    } catch (e) {
        return devices;
    }
    Object.keys(parsed).forEach(function (runtime) {
        var name = runtimeName(runtime);
        (parsed[runtime] || []).forEach(function (device) {
            if (device.isAvailable === false) return;
            devices.push({
                id: "sim:" + device.udid,
                kind: "sim",
                udid: device.udid,
                name: device.name,
                runtime: name,
                platform: name.split(" ")[0],
                booted: device.state === "Booted"
            });
        });
    });
    devices.sort(function (a, b) {
        if (a.runtime !== b.runtime) return a.runtime < b.runtime ? 1 : -1;
        return a.name < b.name ? -1 : 1;
    });
    // My Mac first and always: it needs no simulator, it is the destination for every
    // command-line and AppKit target, and it is the one that still works on a machine with
    // no simulator runtimes installed at all.
    devices.unshift({ id: "mac", kind: "mac", name: "My Mac", runtime: "macOS" });
    return devices;
}

// The `.xcodeproj` and `.xcworkspace` in the folder, from a plain directory listing. This
// is here for the ambiguous case: with both present, `xcodebuild` refuses to guess and says
// so, and the panel needs the names to be able to offer them.
function readContainers(listing) {
    var found = [];
    listing.split("\n").forEach(function (line) {
        var name = line.replace(/\/$/, "").trim();
        if (!name) return;
        if (/\.xcworkspace$/.test(name)) found.push({ flag: "-workspace", name: name });
        else if (/\.xcodeproj$/.test(name)) found.push({ flag: "-project", name: name });
    });
    // A workspace first: when a project has one, it is nearly always the thing to build,
    // because it is what carries the package dependencies and the other projects.
    found.sort(function (a, b) { return a.flag === b.flag ? 0 : (a.flag === "-workspace" ? -1 : 1); });
    return found;
}

// MARK: - Asking the project what it contains

// Every query this panel ever makes, and all three are issued here, synchronously, before
// anything is awaited. That is not a style choice: the click is the permission, an `await`
// ends it, and a fourth question asked after these have answered would be refused.
//
// It also happens to be the right shape. The three are independent — a directory listing, a
// device list and the scheme list — so asking them one after another would be three times
// as slow for no reason.
function scan(container) {
    if (state.scanning) return;
    if (!linelark.canRunQuery()) return;

    var folder = state.project || "";
    var chosen = container || state.container;
    var listing = linelark.runQuery({ command: "/bin/ls", arguments: ["-1"], folder: folder });
    var simulators = linelark.runQuery({
        command: "xcrun",
        arguments: ["simctl", "list", "-j", "devices", "available"],
        folder: folder,
        timeout: 60
    });
    var schemes = linelark.runQuery({
        command: "xcodebuild",
        arguments: containerArgumentsFor(chosen).concat(["-list", "-json"]),
        folder: folder,
        timeout: 120
    });

    state.scanning = true;
    state.note = null;
    state.noteTint = null;
    linelark.refreshPanels();

    Promise.all([listing, simulators, schemes]).then(function (answers) {
        state.scanning = false;
        state.containers = answers[0].status === 0 ? readContainers(answers[0].stdout) : [];
        state.destinations = answers[1].status === 0 ? readSimulators(answers[1].stdout) : [];

        var listed = answers[2];
        if (listed.status !== 0) {
            // Two very different failures wear the same non-zero status, and only one of
            // them is something the user can answer. Several containers in one folder means
            // xcodebuild would not guess — so the panel offers them instead. Anything else
            // is reported in xcodebuild's own words, which are usually exact.
            if (!chosen && state.containers.length > 1) {
                state.note = "There is more than one project here. Choose which to build.";
                state.noteTint = "info";
            } else {
                state.note = firstLine(listed.stderr || listed.stdout)
                    || "xcodebuild could not read this folder.";
                state.noteTint = "negative";
            }
            state.scanned = false;
            linelark.refreshPanels();
            return;
        }

        var parsed;
        try {
            parsed = JSON.parse(listed.stdout);
        } catch (e) {
            state.note = "xcodebuild's answer could not be read.";
            state.noteTint = "negative";
            state.scanned = false;
            linelark.refreshPanels();
            return;
        }
        var info = parsed.workspace || parsed.project || {};
        state.resolved = {
            kind: parsed.workspace ? "workspace" : "project",
            name: info.name || ""
        };
        state.container = chosen || null;
        state.schemes = info.schemes || [];
        state.scanned = true;
        if (!state.schemes.length) {
            state.note = "This project declares no schemes.";
            state.noteTint = "warning";
        }
        // A choice that is still valid is kept — rescanning after adding a target should
        // not throw away what was selected — and one that has gone falls back rather than
        // leaving the panel pointing at a scheme that no longer exists.
        if (state.schemes.indexOf(state.scheme) < 0) state.scheme = state.schemes[0] || null;
        if (!findDestination(state.destination)) {
            state.destination = state.destinations.length ? state.destinations[0].id : null;
        }
        remember();
        linelark.refreshPanels();
    }).catch(function (e) {
        state.scanning = false;
        state.note = String(e);
        state.noteTint = "negative";
        linelark.refreshPanels();
    });
}

function containerArgumentsFor(container) {
    return container ? [container.flag, container.name] : [];
}

function firstLine(text) {
    var lines = String(text || "").split("\n");
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim()) return lines[i].trim();
    }
    return "";
}

function findDestination(id) {
    for (var i = 0; i < state.destinations.length; i++) {
        if (state.destinations[i].id === id) return state.destinations[i];
    }
    return null;
}

// MARK: - Building the line that gets typed

function destinationArgument(destination) {
    return destination.kind === "mac" ? "platform=macOS" : "id=" + destination.udid;
}

function xcodebuildLine(action, destination) {
    var line = "xcodebuild";
    if (state.container) line += " " + state.container.flag + " " + sh(state.container.name);
    line += " -scheme " + sh(state.scheme);
    line += " -destination " + sh(destinationArgument(destination));
    line += " -derivedDataPath " + DERIVED;
    // Not passed to `test`: a scheme names its own configuration for testing, and
    // overriding it here would quietly run the tests in a way the project did not ask for.
    if (action !== "test") line += " -configuration Debug";
    return line + " " + action;
}

// Run is the one that is more than a build, and it is written as a single shell line on
// purpose — `runInTerminal` joins several commands with `;`, which would carry on
// installing after a build that failed. `&&` is how "and only if that worked" is said, so
// the whole sequence is one command and the plugin owns the operators.
function runLine(destination) {
    var build = xcodebuildLine("build", destination);
    var products = DERIVED + "/Build/Products/" + productDirectory(destination);
    var app = 'APP="$(ls -d ' + products + '/*.app | head -1)"';

    if (destination.kind === "mac") {
        return build + " && " + app + ' && open "$APP"';
    }
    var udid = sh(destination.udid);
    // `boot` fails when the device is already booted, which is the ordinary case after the
    // first run, so it is allowed to fail and the chain restarts after it. Everything else
    // is `&&`: installing into a simulator that never booted, or launching something that
    // never installed, produces a confusing error rather than a useful one.
    return build + " && " + app
        + " && xcrun simctl boot " + udid + " 2>/dev/null; open -a Simulator"
        + " && xcrun simctl install " + udid + ' "$APP"'
        + " && xcrun simctl launch " + udid
        + ' "$(/usr/libexec/PlistBuddy -c \'Print CFBundleIdentifier\' "$APP/Info.plist")"';
}

function perform(action) {
    var destination = findDestination(state.destination);
    if (!state.scheme || !destination) return;
    if (!linelark.canRunInTerminal()) {
        state.note = "Running commands is switched off for this plugin.";
        state.noteTint = "negative";
        linelark.refreshPanels();
        return;
    }
    var line = action === "run" ? runLine(destination) : xcodebuildLine(action, destination);
    // Called straight from the click, with nothing awaited in between — the same rule the
    // queries follow, and the reason this function does no work of its own first.
    linelark.runInTerminal({
        name: "Build and Run",
        folder: state.project || "",
        commands: [line]
    });
    state.note = null;
    linelark.refreshPanels();
}

// MARK: - Drawing it

// What `xcodebuild` picked when it was not told, spelled the way the rows below spell it.
// Its own answer carries the bare name — "Linelark" — and the extension is the whole of the
// difference between the two things it could have meant.
function resolvedName() {
    if (!state.resolved) return "automatic";
    return state.resolved.name
        + (state.resolved.kind === "workspace" ? ".xcworkspace" : ".xcodeproj");
}

function describeDestination(destination) {
    if (destination.kind === "mac") return "macOS";
    return destination.runtime + (destination.booted ? " · booted" : "");
}

function render() {
    var nodes = [];

    if (!linelark.canRunQuery()) {
        nodes.push({ type: "heading", text: "Build and Run" });
        nodes.push({ type: "text", style: "primary",
                     text: "This panel needs to run xcodebuild to find out what the project "
                         + "contains." });
        nodes.push({ type: "text",
                     text: "Turn on “Allow reading command output” for Build and Run in "
                         + "Plugins ▸ Manage Plugins. It is Studio only — the App Store "
                         + "edition cannot run commands at all." });
        return nodes;
    }

    var folders = linelark.workspaceFolders();
    if (folders.length > 1) {
        nodes.push({
            type: "section", id: "folders", title: "Project", collapsed: false,
            children: [{
                type: "rows",
                rows: folders.map(function (folder) {
                    var active = (state.project || "") === folder.path
                        || (!state.project && folder.isActive);
                    return {
                        id: "folder:" + folder.path,
                        title: folder.name,
                        symbol: active ? "largecircle.fill.circle" : "circle",
                        detail: folder.path
                    };
                })
            }]
        });
    }

    if (state.scanning) {
        nodes.push({ type: "text", style: "primary", text: "Reading the project…" });
        return nodes;
    }

    if (state.note) {
        // A row rather than a text node, for the symbol: a tint needs a badge to sit in,
        // and a warning that reads as ordinary prose is one nobody notices.
        nodes.push({ type: "rows", rows: [{
            id: "note",
            title: state.note,
            symbol: state.noteTint === "negative" ? "exclamationmark.triangle"
                  : (state.noteTint === "warning" ? "exclamationmark.circle" : "info.circle")
        }] });
    }

    // Only when there is genuinely a choice — two containers in one folder — and then in
    // one of two quite different moods. Unscanned means `xcodebuild` refused to guess and
    // the panel is asking, so it is open. Scanned means it guessed, and the section exists
    // to *say which* and let that be overridden, so it starts shut with the answer in its
    // title. Drawing the asking version in both places is what this did first, and it put
    // an unexplained question above a list of schemes that had already been found.
    if (state.containers.length > 1) {
        nodes.push({
            type: "section",
            id: "containers",
            title: state.scanned
                ? "Project file · " + (state.container ? state.container.name : resolvedName())
                : "Which project",
            collapsed: state.scanned,
            children: [{
                type: "rows",
                rows: state.containers.map(function (container) {
                    var chosen = state.container && state.container.name === container.name;
                    return {
                        id: "container:" + container.name,
                        title: container.name,
                        symbol: chosen ? "largecircle.fill.circle" : "circle",
                        detail: container.flag === "-workspace" ? "Workspace" : "Project"
                    };
                })
            }]
        });
    }

    if (!state.scanned) {
        nodes.push({ type: "button", id: "scan", title: "Scan project",
                     symbol: "magnifyingglass", prominent: true, enabled: true });
        nodes.push({ type: "text",
                     text: "Reads the schemes with xcodebuild and the available simulators "
                         + "with simctl. Nothing is built." });
        return nodes;
    }

    nodes.push({
        type: "section", id: "schemes", title: "Scheme", collapsed: false,
        children: [{
            type: "rows",
            rows: state.schemes.map(function (scheme) {
                return {
                    id: "scheme:" + scheme,
                    title: scheme,
                    symbol: scheme === state.scheme ? "largecircle.fill.circle" : "circle"
                };
            })
        }]
    });

    var destination = findDestination(state.destination);
    nodes.push({
        type: "section", id: "destinations",
        title: "Destination" + (destination ? " · " + destination.name : ""),
        // Collapsed to start, because the list is every simulator on the machine and the
        // one being used is already named in the title. A section that starts shut is the
        // only way a panel with fifty rows in it is still a panel.
        collapsed: true,
        children: [{
            type: "rows",
            rows: state.destinations.map(function (entry) {
                return {
                    id: "dest:" + entry.id,
                    title: entry.name,
                    detail: describeDestination(entry),
                    symbol: entry.id === state.destination ? "largecircle.fill.circle" : "circle"
                };
            })
        }]
    });

    var ready = !!(state.scheme && destination);
    nodes.push({ type: "button", id: "run", title: "Run", symbol: "play.fill",
                 prominent: true, enabled: ready });
    nodes.push({
        type: "actions",
        actions: [
            { id: "build", title: "Build", symbol: "hammer", enabled: ready },
            { id: "test", title: "Test", symbol: "checkmark.diamond", enabled: ready },
            { id: "rescan", title: "Scan again", symbol: "arrow.clockwise", enabled: true }
        ]
    });
    nodes.push({ type: "text",
                 text: "The command is typed into the terminal panel, where you can read "
                     + "it, stop it with ⌃C, and copy it." });
    return nodes;
}

// One argument, not two: the host calls a selector with the item's id alone, because a
// panel's handler already knows which panel it was registered for.
function onSelect(itemID) {
    if (itemID === "scan" || itemID === "rescan") {
        if (itemID === "rescan") state.scanned = false;
        scan(null);
        return;
    }
    if (itemID === "build" || itemID === "test" || itemID === "run") {
        perform(itemID);
        return;
    }
    if (itemID.indexOf("folder:") === 0) {
        state.project = itemID.slice("folder:".length);
        recall();
        linelark.refreshPanels();
        return;
    }
    if (itemID.indexOf("container:") === 0) {
        var name = itemID.slice("container:".length);
        for (var i = 0; i < state.containers.length; i++) {
            if (state.containers[i].name === name) {
                // A click, so the second query this needs is allowed — which is why the
                // ambiguous case is offered as rows to press rather than resolved behind
                // the scenes.
                scan(state.containers[i]);
                return;
            }
        }
        return;
    }
    if (itemID.indexOf("scheme:") === 0) {
        state.scheme = itemID.slice("scheme:".length);
        remember();
        linelark.refreshPanels();
        return;
    }
    if (itemID.indexOf("dest:") === 0) {
        state.destination = itemID.slice("dest:".length);
        remember();
        linelark.refreshPanels();
    }
}

recall();

linelark.addPanel({
    id: PANEL,
    title: "Build and Run",
    symbol: "hammer",
    // Left, with the things that describe the project. The right dock is for what sits
    // beside the work — an assistant, an outline, test results — and this is a set of
    // controls about what is in the folder.
    side: "left",
    render: render,
    onSelect: onSelect
});
