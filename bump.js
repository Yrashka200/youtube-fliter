#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const readline = require("readline");

const ROOT = __dirname;
const MANIFEST_PATH = path.join(ROOT, "manifest.json");
const CHANGELOG_PATH = path.join(ROOT, "CHANGELOG.md");

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  bold: "\x1b[1m"
};

function log(msg, color = "reset") {
  console.log(`${COLORS[color]}${msg}${COLORS.reset}`);
}

function readManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    log(`✖ manifest.json not found at ${MANIFEST_PATH}`, "red");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function writeManifest(manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
}

function readChangelog() {
  if (!fs.existsSync(CHANGELOG_PATH)) {
    return "# Changelog\n\n";
  }
  return fs.readFileSync(CHANGELOG_PATH, "utf8");
}

function writeChangelog(content) {
  fs.writeFileSync(CHANGELOG_PATH, content, "utf8");
}

function parseVersion(v) {
  const parts = v.split(".").map(n => parseInt(n, 10) || 0);
  while (parts.length < 3) parts.push(0);
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(current, type) {
  const v = parseVersion(current);
  if (type === "major") {
    return formatVersion({ major: v.major + 1, minor: 0, patch: 0 });
  }
  if (type === "minor") {
    return formatVersion({ major: v.major, minor: v.minor + 1, patch: 0 });
  }
  return formatVersion({ major: v.major, minor: v.minor, patch: v.patch + 1 });
}

function today() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function insertChangelogEntry(changelog, version, date, body) {
  const headerMatch = changelog.match(/^#\s+Changelog\s*\n/);
  const header = headerMatch ? headerMatch[0] : "# Changelog\n\n";
  const rest = headerMatch ? changelog.slice(header.length) : changelog;

  const entry = `## [${version}] - ${date}\n${body.trim()}\n\n`;

  return header + entry + rest.replace(/^\s+/, "");
}

function run(cmd, silent = false) {
  if (!silent) log(`  $ ${cmd}`, "gray");
  return execSync(cmd, { cwd: ROOT, stdio: silent ? "pipe" : "inherit" })
    .toString()
    .trim();
}

function isGitRepo() {
  try {
    run("git rev-parse --is-inside-work-tree", true);
    return true;
  } catch (e) {
    return false;
  }
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const type = args[0] || null;
  const message = args.slice(1).join(" ").trim() || null;
  const noCommit = args.includes("--no-commit");
  const noTag = args.includes("--no-tag");
  const push = args.includes("--push");
  return { type, message, noCommit, noTag, push };
}

async function main() {
  log("\n🎬 YouTube Feed Filter — Version Bumper\n", "bold");

  const { type: typeArg, message: msgArg, noCommit, noTag, push } = parseArgs();

  const manifest = readManifest();
  const currentVersion = manifest.version;

  log(`Current version: ${COLORS.cyan}${currentVersion}${COLORS.reset}\n`);

  let type = typeArg;

  if (!type || !["patch", "minor", "major"].includes(type)) {
    log("Select bump type:", "yellow");
    log("  1) patch  (1.2.0 → 1.2.1)  — bug fixes", "gray");
    log("  2) minor  (1.2.0 → 1.3.0)  — new features", "gray");
    log("  3) major  (1.2.0 → 2.0.0)  — breaking changes", "gray");
    const choice = (await prompt("\nEnter 1/2/3 or patch/minor/major: ")).trim().toLowerCase();
    if (choice === "1" || choice === "patch") type = "patch";
    else if (choice === "2" || choice === "minor") type = "minor";
    else if (choice === "3" || choice === "major") type = "major";
    else {
      log("✖ Invalid choice", "red");
      process.exit(1);
    }
  }

  const newVersion = bumpVersion(currentVersion, type);
  const date = today();

  log(`\nBumping ${type}: ${currentVersion} → ${COLORS.green}${newVersion}${COLORS.reset}\n`);

  let changelogBody = msgArg;
  if (!changelogBody) {
    log("Enter changelog body (Markdown).", "yellow");
    log("Example:", "gray");
    log("  ### Added", "gray");
    log("  - New feature X", "gray");
    log("  ### Fixed", "gray");
    log("  - Bug Y", "gray");
    log("\nFinish with an empty line, then type END on a new line.\n", "gray");

    const lines = [];
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    await new Promise(resolve => {
      rl.on("line", line => {
        if (line.trim() === "END") {
          rl.close();
          resolve();
          return;
        }
        lines.push(line);
      });
    });

    changelogBody = lines.join("\n").trim();
  }

  if (!changelogBody) {
    changelogBody = `### Changed\n- Bumped to v${newVersion}`;
  }

  manifest.version = newVersion;
  writeManifest(manifest);
  log(`✔ Updated manifest.json → ${newVersion}`, "green");

  const changelog = readChangelog();
  const newChangelog = insertChangelogEntry(changelog, newVersion, date, changelogBody);
  writeChangelog(newChangelog);
  log(`✔ Updated CHANGELOG.md (added v${newVersion})`, "green");

  if (!noCommit && isGitRepo()) {
    log("\n📦 Git operations:\n", "bold");

    try {
      run("git add manifest.json CHANGELOG.md");
      run(`git commit -m "v${newVersion}"`);

      if (!noTag) {
        run(`git tag v${newVersion}`);
        log(`✔ Created tag v${newVersion}`, "green");
      }

      if (push) {
        log("\n⬆ Pushing to remote…\n", "bold");
        run("git push origin main");
        if (!noTag) run(`git push origin v${newVersion}`);
        log("\n✔ Pushed to GitHub!", "green");
      } else {
        log("\n✔ Committed. Next steps:", "green");
        log(`  git push origin main`, "cyan");
        if (!noTag) log(`  git push origin v${newVersion}`, "cyan");
      }
    } catch (e) {
      log(`⚠ Git error: ${e.message}`, "yellow");
      log("Files were updated but not committed.", "yellow");
    }
  } else if (noCommit) {
    log("\n⚠ Skipped git commit (--no-commit)", "yellow");
  } else if (!isGitRepo()) {
    log("\n⚠ Not a git repository — skipping commit", "yellow");
  }

  log(`\n🎉 Done! New version: ${COLORS.green}${COLORS.bold}${newVersion}${COLORS.reset}\n`);
}

main().catch(err => {
  log(`\n✖ Error: ${err.message}`, "red");
  process.exit(1);
});