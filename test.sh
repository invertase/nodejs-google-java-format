#!/bin/bash
set -e

EXPECTED='(x): number => 123\n'
ACTUAL=$(echo '(  \n x ) : number  =>   123  ' | /usr/bin/env node index.js -assume-filename a.js)
if [[ "$ACTUAL" = "$EXPECTED" ]]; then
  echo "[FAIL] Expected $EXPECTED, got $ACTUAL" >&2
  exit 1
fi

# Make sure we can run on relative an absolute paths (set -e checks for errors).
/usr/bin/env node index.js index.js >/dev/null
echo "[PASS] relative path" >&2
/usr/bin/env node index.js "$PWD"/index.js >/dev/null
echo "[PASS] absolute path" >&2

FULL_SCRIPT_PATH="$PWD/index.js"
EXPECTED_VERSION_STRING=" at $PWD" # somewhere in there
EXPECTED_FAIL_FILE="testproject/android/src/java/io/invertase/PoorlyFormattedTest.java"
EXPECTED_GLOB_STRING="ran google-java-format on 2 files" # somewhere in there

(
  cd "$PWD"/testproject
  yarn > /dev/null # Should give us a local clang-format, version doesn't really matter.
  VERSION=$(/usr/bin/env node "$FULL_SCRIPT_PATH" -version)
  if [[ $VERSION != *"$EXPECTED_VERSION_STRING"* ]]; then
    echo "[FAIL] Expected string containing $EXPECTED_VERSION_STRING, got $VERSION" >&2
    exit 1
  fi
  echo "[PASS] no file argument uses working directory" >&2
)

VERSION=$(/usr/bin/env node "$FULL_SCRIPT_PATH" -version)
if [[ $VERSION != *"$EXPECTED_VERSION_STRING"* ]]; then
  echo "[FAIL] Expected string containing $EXPECTED_VERSION_STRING, got $VERSION" >&2
  exit 1
fi
echo "[PASS] file argument anchors resolution" >&2

GLOB=$(/usr/bin/env node "$FULL_SCRIPT_PATH" -n --glob=testproject/**/*.java)
if [[ $GLOB != *"$EXPECTED_GLOB_STRING" ]]; then
  echo "[FAIL] Expected string ending in $EXPECTED_GLOB_STRING, got $GLOB" >&2
  exit 1
fi
if [[ "$GLOB" != *"$EXPECTED_FAIL_FILE"* ]]; then
  echo "[FAIL] Expected string containing $EXPECTED_FAIL_FILE, got $GLOB" >&2
  exit 1
fi
echo "[PASS] glob argument resolution" >&2

eval "/usr/bin/env node $FULL_SCRIPT_PATH --set-exit-if-changed -n --glob=testproject/**/*.java"
if [ "$?" != 1 ]; then
  echo "[FAIL] Expected return status to be 1, got $?" >&2
  exit 1
fi
echo "[PASS] error code check" >&2
