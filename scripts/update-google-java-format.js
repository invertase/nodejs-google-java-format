#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const LIB_DIR = path.join(REPO_ROOT, "lib");
const INDEX_PATH = path.join(REPO_ROOT, "index.js");
const RELEASE_URL =
  "https://api.github.com/repos/google/google-java-format/releases/latest";
const JAR_PATTERN = /^google-java-format-(\d+\.\d+\.\d+)-all-deps\.jar$/;

function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}\n`);
}

function getCurrentJar() {
  const jarFiles = fs.readdirSync(LIB_DIR).filter((fileName) => {
    return JAR_PATTERN.test(fileName);
  });

  if (jarFiles.length !== 1) {
    throw new Error(
      `Expected exactly one google-java-format jar in lib/, found ${jarFiles.length}.`
    );
  }

  const jarName = jarFiles[0];
  const match = jarName.match(JAR_PATTERN);

  return {
    name: jarName,
    version: match[1],
    path: path.join(LIB_DIR, jarName),
  };
}

async function fetchLatestRelease() {
  const response = await fetch(RELEASE_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "nodejs-google-java-format-updater",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch latest release: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

function getLatestJarAsset(release) {
  const asset = (release.assets || []).find((entry) => {
    return JAR_PATTERN.test(entry.name);
  });

  if (!asset) {
    throw new Error("Unable to find google-java-format all-deps jar asset.");
  }

  const match = asset.name.match(JAR_PATTERN);

  return {
    name: asset.name,
    version: match[1],
    downloadUrl: asset.browser_download_url,
  };
}

async function downloadJar(downloadUrl, destinationPath) {
  const response = await fetch(downloadUrl, {
    headers: {
      "User-Agent": "nodejs-google-java-format-updater",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download jar: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(destinationPath, Buffer.from(arrayBuffer));
}

function updateIndexJarPath(nextVersion) {
  const source = fs.readFileSync(INDEX_PATH, "utf8");
  const updatedSource = source.replace(
    /google-java-format-\d+\.\d+\.\d+-all-deps\.jar/g,
    `google-java-format-${nextVersion}-all-deps.jar`
  );

  if (source === updatedSource) {
    throw new Error("Failed to update google-java-format jar path in index.js.");
  }

  fs.writeFileSync(INDEX_PATH, updatedSource);
}

async function main() {
  const currentJar = getCurrentJar();
  const latestRelease = await fetchLatestRelease();
  const latestJar = getLatestJarAsset(latestRelease);

  setOutput("current_version", currentJar.version);
  setOutput("latest_version", latestJar.version);
  setOutput("download_url", latestJar.downloadUrl);
  setOutput(
    "update_available",
    currentJar.version !== latestJar.version ? "true" : "false"
  );

  if (currentJar.version === latestJar.version) {
    setOutput("updated", "false");
    console.log(
      `google-java-format is already up to date at ${currentJar.version}.`
    );
    return;
  }

  const targetJarPath = path.join(LIB_DIR, latestJar.name);
  const tempJarPath = `${targetJarPath}.download`;

  try {
    await downloadJar(latestJar.downloadUrl, tempJarPath);
    fs.rmSync(currentJar.path, { force: true });
    fs.renameSync(tempJarPath, targetJarPath);
    updateIndexJarPath(latestJar.version);
  } finally {
    fs.rmSync(tempJarPath, { force: true });
  }

  setOutput("updated", "true");
  console.log(
    `Updated google-java-format from ${currentJar.version} to ${latestJar.version}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
