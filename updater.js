	const GITHUB_USER = "Yrashka200";
const GITHUB_REPO = "youtube-fliter";  
const GITHUB_BRANCH = "main";        


const MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}/manifest.json`;
const RELEASES_API = `https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/releases/latest`;
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


async function fetchRemoteManifest() {
  const res = await fetch(MANIFEST_URL + "?t=" + Date.now(), { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch remote manifest: " + res.status);
  return await res.json();
}


async function checkForUpdates() {
  try {
    const localVersion = getLocalVersion();
    const remote = await fetchRemoteManifest();
    const remoteVersion = remote.version;

    const hasUpdate = isNewerVersion(remoteVersion, localVersion);

    const state = {
      lastCheck: Date.now(),
      localVersion,
      remoteVersion,
      hasUpdate,
      downloadUrl: ZIP_URL,
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
      error: err.message
    };
    await chrome.storage.local.set({ updateState: state });
    return state;
  }
}