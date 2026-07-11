#!/usr/bin/env node
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const resolve = require("resolve").sync;
const spawn = require("child_process").spawn;
const { globSync } = require("glob");
const async = require("async");

const VERSION = require("./package.json").version;
const LOCATION = __dirname;

// Glob pattern option name
const GLOB_OPTION = "--glob=";
const CHUNK_SIZE = 30;

function errorFromExitCode(exitCode) {
  return new Error(`google-java-format exited with exit code ${exitCode}.`);
}

function isJavaFile(arg) {
  return !arg.startsWith("-") && arg.endsWith(".java");
}

function splitJarArgs(args) {
  if (args[0] === "-jar") {
    return {
      prefix: args.slice(0, 2),
      rest: args.slice(2),
    };
  }
  return { prefix: [], rest: args };
}

function splitFlagsAndFiles(args) {
  const flags = [];
  const files = [];
  for (const arg of args) {
    if (isJavaFile(arg)) files.push(arg);
    else flags.push(arg);
  }
  return { flags, files };
}

function runSpawn(nativeBinary, args, stdio, done) {
  const proc = spawn(nativeBinary, args, { stdio: stdio });
  proc.on("close", function (exit) {
    if (exit) done(errorFromExitCode(exit));
    else done();
  });
  return proc;
}

function runChunks(nativeBinary, prefix, flags, files, stdio, done) {
  const chunks = [];
  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    chunks.push(files.slice(i, i + CHUNK_SIZE));
  }

  async.series(
    chunks.map((chunk) => (callback) => {
      runSpawn(nativeBinary, prefix.concat(flags, chunk), stdio, callback);
    }),
    (err) => {
      if (err) {
        done(err);
        return;
      }
      if (files.length > 1) {
        console.log("\n");
        console.log(
          `ran google-java-format on ${files.length} ${
            files.length === 1 ? "file" : "files"
          }`
        );
      }
      done();
    }
  );
}

/**
 * Starts a child process running the native google-java-format binary.
 */
function googleJavaFormat(file, enc, style, done) {
  let args = [`-style=${style}`, file.path];
  let result = spawnGoogleJavaFormat(args, done, [
    "ignore",
    "pipe",
    process.stderr,
  ]);
  if (result) {
    result.stdout.setEncoding(enc);
    return result.stdout;
  }
  throw new Error("Can't get output stream when --glob flag is set");
}

/**
 * Spawn the google-java-format binary with given arguments.
 */
function spawnGoogleJavaFormat(args, done, stdio) {
  let nativeBinary;

  try {
    nativeBinary = getNativeBinary();
  } catch (e) {
    setImmediate(() => done(e));
    return;
  }

  if (args.find((a) => a === "-version" || a === "--version")) {
    console.log(`google-java-format NPM version ${VERSION} at ${LOCATION}`);
    args = ["--version"];
  }

  args = [
    "-jar",
    `${LOCATION}/lib/google-java-format-1.35.0-all-deps.jar`,
  ].concat(args);

  const filesGlob = getGlobArg(args);
  if (filesGlob) {
    args = args.filter((arg) => arg.indexOf(GLOB_OPTION) === -1);
    const files = globSync(filesGlob);
    const { prefix, rest } = splitJarArgs(args);
    const { flags } = splitFlagsAndFiles(rest);
    runChunks(nativeBinary, prefix, flags, files, stdio, done);
    return;
  }

  const { prefix, rest } = splitJarArgs(args);
  const { flags, files } = splitFlagsAndFiles(rest);

  if (files.length > CHUNK_SIZE) {
    runChunks(nativeBinary, prefix, flags, files, stdio, done);
    return;
  }

  return runSpawn(nativeBinary, prefix.concat(flags, files), stdio, done);
}

function main() {
  const nonDashArgs = process.argv.filter(
    (arg, idx) => idx > 1 && arg[0] != "-"
  );

  const lastFileArg = nonDashArgs[nonDashArgs.length - 1];
  const basedir = lastFileArg ? path.dirname(lastFileArg) : process.cwd();
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

  try {
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

function getNativeBinary() {
  let nativeBinary = "java";
  if (os.platform() === "win32") {
    nativeBinary = "java.exe";
  }
  return nativeBinary;
}

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
