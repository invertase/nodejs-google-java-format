#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const resolve = require("resolve").sync;
const spawn = require("child_process").spawn;
const glob = require("glob");
const async = require("async");

const VERSION = require("./package.json").version;
const LOCATION = __dirname;

// Glob pattern option name
const GLOB_OPTION = "--glob=";

function errorFromExitCode(exitCode) {
  return new Error(`google-java-format exited with exit code ${exitCode}.`);
}

/**
 * Starts a child process running the native google-java-format binary.
 *
 * @param file a Vinyl virtual file reference
 * @param enc the encoding to use for reading stdout
 * @param style valid argument to google-java-format's '-style' flag
 * @param done callback invoked when the child process terminates
 * @returns {stream.Readable} the formatted code as a Readable stream
 */
function googleJavaFormat(file, enc, style, done) {
  let args = [`-style=${style}`, file.path];
  let result = spawnGoogleJavaFormat(args, done, [
    "ignore",
    "pipe",
    process.stderr,
  ]);
  if (result) {
    // must be ChildProcess
    result.stdout.setEncoding(enc);
    return result.stdout;
  } else {
    // We shouldn't be able to reach this line, because it's not possible to
    // set the --glob arg in this function.
    throw new Error("Can't get output stream when --glob flag is set");
  }
}

/**
 * Spawn the google-java-format binary with given arguments.
 */
function spawnGoogleJavaFormat(args, done, stdio) {
  // WARNING: This function's interface should stay stable across versions for the cross-version
  // loading below to work.
  let nativeBinary;

  try {
    nativeBinary = getNativeBinary();
  } catch (e) {
    setImmediate(() => done(e));
    return;
  }

  if (args.find((a) => a === "-version" || a === "--version")) {
    // Print our version.
    // This makes it impossible to format files called '-version' or '--version'. That's a feature.
    // minimist & Co don't support single dash args, which we need to match binary google-java-format.
    console.log(`google-java-format NPM version ${VERSION} at ${LOCATION}`);
    args = ["--version"];
  }

  // Add the library in, with java 16 compat
  args = [
    "-jar",
    `${LOCATION}/lib/google-java-format-1.26.0-all-deps.jar`,
  ].concat(args);

  // extract glob, if present
  const filesGlob = getGlobArg(args);

  if (filesGlob) {
    // remove glob from arg list
    args = args.filter((arg) => arg.indexOf(GLOB_OPTION) === -1);

    glob(filesGlob, function (err, files) {
      if (err) {
        done(err);
        return;
      }

      // split file array into chunks of 30
      let i,
        j,
        chunks = [],
        chunkSize = 30;

      for (i = 0, j = files.length; i < j; i += chunkSize) {
        chunks.push(files.slice(i, i + chunkSize));
      }

      // launch a new process for each chunk
      async.series(
        chunks.map(function (chunk) {
          return function (callback) {
            const googlejavaFormatProcess = spawn(
              nativeBinary,
              args.concat(chunk),
              { stdio: stdio }
            );
            googlejavaFormatProcess.on("close", function (exit) {
              if (exit !== 0) callback(errorFromExitCode(exit));
              else callback();
            });
          };
        }),
        function (err) {
          if (err) {
            done(err);
            return;
          }
          console.log("\n");
          console.log(
            `ran google-java-format on ${files.length} ${
              files.length === 1 ? "file" : "files"
            }`
          );
          done();
        }
      );
    });
  } else {
    const googlejavaFormatProcess = spawn(nativeBinary, args, { stdio: stdio });
    googlejavaFormatProcess.on("close", function (exit) {
      if (exit) {
        done(errorFromExitCode(exit));
      } else {
        done();
      }
    });
    return googlejavaFormatProcess;
  }
}

function main() {
  // Find google-java-format in node_modules of the project of the .js file, or cwd.
  const nonDashArgs = process.argv.filter(
    (arg, idx) => idx > 1 && arg[0] != "-"
  );

  // Using the last file makes it less likely to collide with google-java-format's argument parsing.
  const lastFileArg = nonDashArgs[nonDashArgs.length - 1];
  const basedir = lastFileArg
    ? path.dirname(lastFileArg) // relative to the last .js file given.
    : process.cwd(); // or relative to the cwd()
  let resolvedGoogleJavaFormat;
  let googleJavaFormatLocation;
  try {
    googleJavaFormatLocation = resolve("google-java-format", { basedir });
    resolvedGoogleJavaFormat = require(googleJavaFormatLocation);
  } catch (e) {
    // Ignore and use the google-java-format that came with this package.
  }
  let actualSpawnFn;
  if (!resolvedGoogleJavaFormat) {
    actualSpawnFn = spawnGoogleJavaFormat;
  } else if (resolvedGoogleJavaFormat.spawnGoogleJavaFormat) {
    actualSpawnFn = resolvedGoogleJavaFormat.spawnGoogleJavaFormat;
  } else {
    throw new Error(
      `Incompatible google-java-format loaded from ${googleJavaFormatLocation}`
    );
  }
  // Run google-java-format.
  try {
    // Pass all arguments to google-java-format, including e.g. -version etc.
    actualSpawnFn(
      process.argv.slice(2),
      function (e) {
        if (e instanceof Error) {
          console.error(e);
          process.exit(1);
        } else {
          process.exit(e);
        }
      },
      "inherit"
    );
  } catch (e) {
    process.stdout.write(e.message);
    process.exit(1);
  }
}

/**
 * @returns the native `java` binary for the current platform
 * @throws when the `java` executable can not be found
 */
function getNativeBinary() {
  let nativeBinary = "java";
  const platform = os.platform();
  const arch = os.arch();
  if (platform === "win32") {
    nativeBinary = "java.exe";
  }
  return nativeBinary;
}

/**
 * Filters the arguments to return the value of the `--glob=` option.
 *
 * @returns The value of the glob option or null if not found
 */
function getGlobArg(args) {
  const found = args.find((a) => a.startsWith(GLOB_OPTION));
  return found ? found.substring(GLOB_OPTION.length) : null;
}

module.exports = googleJavaFormat;
module.exports.version = VERSION;
module.exports.location = LOCATION;
module.exports.spawnGoogleJavaFormat = spawnGoogleJavaFormat;
module.exports.getNativeBinary = getNativeBinary;

if (require.main === module) main();
