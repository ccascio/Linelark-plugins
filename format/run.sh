#!/bin/sh
# Runs this plugin's tests in JavaScriptCore — the same engine the editor gives a plugin.
#
# `jsc` ships inside the system JavaScriptCore framework and is not on PATH. Using it rather
# than node is the point: a plugin runs in a JSContext, and a test that passes under V8 says
# nothing about the engine the plugin will actually meet.
#
#   ./run.sh            the test suites
#   ./run.sh bench      the benchmarks, with the JIT off to match the app
set -e
JSC="/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc"
[ -x "$JSC" ] || { echo "jsc not found at $JSC"; exit 1; }
HERE="$(cd "$(dirname "$0")" && pwd)"
MAIN="$HERE/Format.linelarkplugin/main.js"

if [ "$1" = "bench" ]; then
    # The editor's JSContext does not JIT, so a benchmark that lets jsc JIT is measuring an
    # engine the plugin will never run in. `document-preview` measured ~2 ms/KB for marked
    # under the same conditions; that is the number to beat.
    for b in bench-json bench-markup bench-rest; do
        echo "--- $b ---"
        "$JSC" --useJIT=false "$HERE/tests/harness.js" "$MAIN" "$HERE/tests/$b.js"
    done
    exit 0
fi

status=0
for t in json markup css reindent-tidy fuzz-markup; do
    printf '%-14s ' "$t"
    "$JSC" "$HERE/tests/harness.js" "$MAIN" "$HERE/tests/$t.js" | grep -Ev '^round trip' || status=1
done
printf '%-14s ' "commands"
"$JSC" "$HERE/tests/harness-host.js" "$MAIN" "$HERE/tests/commands.js" | grep -Ev '^symbols' || status=1
exit $status
