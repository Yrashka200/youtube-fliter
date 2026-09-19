const GITHUB_USER = "Yrashka200";
const GITHUB_REPO = "youtube-fliter";
const GITHUB_BRANCH = "main";

const MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`;
const CHANGELOG_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/CHANGELOG.md`;
const ZIP_URL = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`;

function isNewerVersion(remote, local) {
  const r = remote.split(".").map(n => parseInt(n, 10) || 0);
  const l = local.split(".").map(n => parseInt(n, 10) || 0);
  const len = Math.max(r.length, l.length);
  for (let i = 0; i < len; i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

function getLocalVersion() {
  return chrome.runtime.getManifest().version;
}

function parseChangelog(md) {
  if (!md) return [];

  const lines = md.split(/\r?\n/);
  const entries = [];
  let current = null;

  for (const line of lines) {
    const versionMatch = line.match(/^##\s+\[?([0-9]+\.[0-9]+\.[0-9]+[^\]]*)\]?(?:\s*-\s*(.+))?/);
    if (versionMatch) {
      if (current) entries.push(current);
      current = {
        version: versionMatch[1].trim(),
        date: (versionMatch[2] || "").trim(),
        body: ""
      };
      continue;
    }

    if (!current) continue;
    if (/^#\s+Changelog/i.test(line)) continue;

    current.body += line + "\n";
  }

  if (current) entries.push(current);

  return entries.map(e => ({ ...e, body: e.body.trim() }));
}

function mdToHtml(md) {
  if (!md) return "";
  return md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^###\s+(.+)$/gm, "<h5>$1</h5>")
    .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .replace(/\n{2,}/g, "<br>")
    .replace(/\n/g, "");
}

async function fetchRemoteManifest() {
  const res = await fetch(MANIFEST_URL + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("Manifest fetch failed: " + res.status);
  return await res.json();
}

async function fetchChangelog() {
  const res = await fetch(CHANGELOG_URL + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) return "";
  return await res.text();
}

async function checkForUpdates() {
  try {
    const localVersion = getLocalVersion();
    const remote = await fetchRemoteManifest();
    const remoteVersion = remote.version;
    const hasUpdate = isNewerVersion(remoteVersion, localVersion);

    const md = await fetchChangelog();
    const entries = parseChangelog(md);

    const localIdx = entries.findIndex(e => e.version === localVersion);
    const visibleEntries = hasUpdate
      ? entries.slice(0, Math.max(localIdx, 0) + 1).filter(e => isNewerVersion(e.version, localVersion) || e.version === remoteVersion)
      : entries.slice(0, 3);

    const changelogHtml = visibleEntries.length
      ? visibleEntries.map(e => `
          <div class="changelog-entry">
            <div class="changelog-head">
              <span class="changelog-ver">v${e.version}</span>
              ${e.date ? `<span class="changelog-date">${e.date}</span>` : ""}
            </div>
            <div class="changelog-body">${mdToHtml(e.body)}</div>
          </div>
        `).join("")
      : `<div class="changelog-empty">No changelog available.</div>`;

    const state = {
      lastCheck: Date.now(),
      localVersion,
      remoteVersion,
      hasUpdate,
      downloadUrl: ZIP_URL,
      changelogHtml,
      error: null
    };

    await chrome.storage.local.set({ updateState: state });

    if (hasUpdate) {
      chrome.action.setBadgeText({ text: "NEW" });
      chrome.action.setBadgeBackgroundColor({ color: "#ff0000" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }

    return state;
  } catch (err) {
    const state = {
      lastCheck: Date.now(),
      localVersion: getLocalVersion(),
      remoteVersion: null,
      hasUpdate: false,
      downloadUrl: ZIP_URL,
      changelogHtml: `<div class="changelog-empty">⚠ ${err.message}</div>`,
      error: err.message
    };
    await chrome.storage.local.set({ updateState: state });
    return state;
  }
}
