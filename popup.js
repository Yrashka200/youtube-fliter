const DEFAULT_SETTINGS = {
  enabled: true,
  blockedCategories: [],
  customKeywords: [],
  videoSize: "default",
  hideShorts: false,
  hideWatched: true,
  hideRussian: false,
  hideEnglish: false
};

let settings = { ...DEFAULT_SETTINGS };
let profiles = [];
let activeProfileId = null;

function uid() {
  return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function save() {
  chrome.storage.sync.set({ settings, profiles, activeProfileId });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "settingsUpdated" }).catch(() => {});
    }
  });
}

function saveCurrentToProfile() {
  if (!activeProfileId) return;
  const p = profiles.find(x => x.id === activeProfileId);
  if (!p) return;
  p.settings = { ...settings };
}

function applyProfile(id) {
  const p = profiles.find(x => x.id === id);
  if (!p) return;
  settings = { ...DEFAULT_SETTINGS, ...p.settings };
  activeProfileId = id;
  save();
  render();
}

function renderProfiles() {
  const sel = document.getElementById("profileSelect");
  if (!sel) return;
  sel.innerHTML = "";

  const none = document.createElement("option");
  none.value = "";
  none.textContent = activeProfileId ? "— Custom (unsaved) —" : "— Custom settings —";
  sel.appendChild(none);

  profiles.forEach(p => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.name;
    if (p.id === activeProfileId) o.selected = true;
    sel.appendChild(o);
  });

  if (!activeProfileId) sel.value = "";
}

function render() {
  document.getElementById("enabled").checked = settings.enabled;
  document.getElementById("hideShorts").checked = settings.hideShorts;
  document.getElementById("hideWatched").checked = settings.hideWatched;
  document.getElementById("hideRussian").checked = settings.hideRussian;
  document.getElementById("hideEnglish").checked = settings.hideEnglish;
  document.getElementById("videoSize").value = settings.videoSize;

  document.querySelectorAll("[data-cat]").forEach(cb => {
    cb.checked = settings.blockedCategories.includes(cb.dataset.cat);
  });

  const list = document.getElementById("kwList");
  list.innerHTML = "";
  settings.customKeywords.forEach((kw, i) => {
    const el = document.createElement("div");
    el.className = "kw";
    el.innerHTML = `${kw} <span data-i="${i}">×</span>`;
    list.appendChild(el);
  });
  list.querySelectorAll("span").forEach(s => {
    s.onclick = () => {
      settings.customKeywords.splice(parseInt(s.dataset.i), 1);
      saveCurrentToProfile();
      save();
      render();
    };
  });

  renderProfiles();
}

function renderUpdate(state) {
  const box = document.getElementById("updateBox");
  const versionEl = document.getElementById("versionInfo");
  const statusEl = document.getElementById("updateStatus");
  const btn = document.getElementById("updateBtn");
  const localV = chrome.runtime.getManifest().version;

  versionEl.textContent = `v${localV}`;

  if (!state) {
    statusEl.textContent = "Checking for updates…";
    statusEl.style.color = "#aaa";
    btn.style.display = "none";
    return;
  }

  if (state.error) {
    statusEl.textContent = "⚠ Update check failed";
    statusEl.title = state.error;
    statusEl.style.color = "#ffaa00";
    btn.style.display = "none";
    return;
  }

  if (state.hasUpdate) {
    statusEl.textContent = `🎉 Update available: v${state.remoteVersion}`;
    statusEl.style.color = "#4caf50";
    btn.style.display = "block";
    box.style.borderColor = "#4caf50";
  } else {
    statusEl.textContent = "✔ You're up to date";
    statusEl.style.color = "#888";
    btn.style.display = "none";
    box.style.borderColor = "#333";
  }

  const content = document.getElementById("changelogContent");
  if (state.changelogHtml) {
    content.innerHTML = state.changelogHtml;
    if (state.hasUpdate) {
      document.getElementById("changelogBox").classList.add("open");
    }
  } else {
    content.innerHTML = `<div class="changelog-empty">No changelog available.</div>`;
  }
}

function showHint(text, color) {
  const hint = document.getElementById("backupHint");
  const original = "Save your settings to a file or restore them.";
  hint.textContent = text;
  hint.style.color = color || "#777";
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => {
    hint.textContent = original;
    hint.style.color = "#777";
  }, 2500);
}

function exportSettings() {
  const data = {
    _type: "youtube-feed-filter-settings",
    _version: 2,
    _exportedAt: new Date().toISOString(),
    _extensionVersion: chrome.runtime.getManifest().version,
    settings,
    profiles,
    activeProfileId
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  a.href = url;
  a.download = `youtube-feed-filter-settings-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showHint("✔ Settings exported", "#4caf50");
}

function importSettings(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!data || data._type !== "youtube-feed-filter-settings") {
        throw new Error("Invalid settings file");
      }

      if (data.settings) {
        const merged = { ...DEFAULT_SETTINGS };
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          if (data.settings[key] !== undefined) merged[key] = data.settings[key];
        }
        if (!Array.isArray(merged.blockedCategories)) merged.blockedCategories = [];
        if (!Array.isArray(merged.customKeywords)) merged.customKeywords = [];
        settings = merged;
      }

      if (Array.isArray(data.profiles)) {
        profiles = data.profiles.map(p => ({
          id: p.id || uid(),
          name: p.name || "Imported",
          settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) }
        }));
      }

      activeProfileId = data.activeProfileId || null;

      save();
      render();

      const ver = data._extensionVersion ? ` (from v${data._extensionVersion})` : "";
      showHint(`✔ Settings imported${ver}`, "#4caf50");
    } catch (err) {
      showHint(`⚠ ${err.message}`, "#ff5555");
    }
  };

  reader.onerror = () => {
    showHint("⚠ Failed to read file", "#ff5555");
  };

  reader.readAsText(file);
}

chrome.storage.local.get(["updateState"], (res) => {
  renderUpdate(res.updateState);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.updateState) {
    renderUpdate(changes.updateState.newValue);
  }
});

document.getElementById("checkUpdate").onclick = () => {
  document.getElementById("updateStatus").textContent = "Checking…";
  chrome.runtime.sendMessage({ type: "checkForUpdates" });
};

document.getElementById("updateBtn").onclick = () => {
  chrome.storage.local.get(["updateState"], (res) => {
    const url = res.updateState?.downloadUrl;
    if (url) chrome.tabs.create({ url });
  });
};

document.getElementById("changelogToggle").onclick = () => {
  document.getElementById("changelogBox").classList.toggle("open");
};

document.getElementById("exportBtn").onclick = exportSettings;

document.getElementById("importBtn").onclick = () => {
  document.getElementById("importFile").click();
};

document.getElementById("importFile").onchange = (e) => {
  const file = e.target.files?.[0];
  if (file) importSettings(file);
  e.target.value = "";
};

document.getElementById("enabled").onchange = (e) => {
  settings.enabled = e.target.checked;
  saveCurrentToProfile();
  save();
};
document.getElementById("hideShorts").onchange = (e) => {
  settings.hideShorts = e.target.checked;
  saveCurrentToProfile();
  save();
};
document.getElementById("hideWatched").onchange = (e) => {
  settings.hideWatched = e.target.checked;
  saveCurrentToProfile();
  save();
};
document.getElementById("hideRussian").onchange = (e) => {
  settings.hideRussian = e.target.checked;
  saveCurrentToProfile();
  save();
};
document.getElementById("hideEnglish").onchange = (e) => {
  settings.hideEnglish = e.target.checked;
  saveCurrentToProfile();
  save();
};
document.getElementById("videoSize").onchange = (e) => {
  settings.videoSize = e.target.value;
  saveCurrentToProfile();
  save();
};

document.querySelectorAll("[data-cat]").forEach(cb => {
  cb.onchange = () => {
    const cat = cb.dataset.cat;
    if (cb.checked) {
      if (!settings.blockedCategories.includes(cat)) settings.blockedCategories.push(cat);
    } else {
      settings.blockedCategories = settings.blockedCategories.filter(c => c !== cat);
    }
    saveCurrentToProfile();
    save();
  };
});

document.getElementById("addKw").onclick = () => {
  const input = document.getElementById("kwInput");
  const val = input.value.trim().toLowerCase();
  if (val && !settings.customKeywords.includes(val)) {
    settings.customKeywords.push(val);
    input.value = "";
    saveCurrentToProfile();
    save();
    render();
  }
};

document.getElementById("kwInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addKw").click();
});

document.getElementById("profileSelect").onchange = (e) => {
  const id = e.target.value;
  if (!id) {
    activeProfileId = null;
    save();
    render();
    return;
  }
  applyProfile(id);
};

document.getElementById("profileNew").onclick = () => {
  const name = prompt("Profile name:", "New profile");
  if (!name) return;
  const p = {
    id: uid(),
    name: name.trim(),
    settings: { ...settings }
  };
  profiles.push(p);
  activeProfileId = p.id;
  save();
  renderProfiles();
};

document.getElementById("profileSave").onclick = () => {
  if (!activeProfileId) {
    const name = prompt("Save as new profile. Name:", "New profile");
    if (!name) return;
    const p = {
      id: uid(),
      name: name.trim(),
      settings: { ...settings }
    };
    profiles.push(p);
    activeProfileId = p.id;
    save();
    renderProfiles();
    return;
  }
  saveCurrentToProfile();
  save();
  const btn = document.getElementById("profileSave");
  const old = btn.textContent;
  btn.textContent = "✔ Saved";
  setTimeout(() => btn.textContent = old, 1200);
};

document.getElementById("profileDelete").onclick = () => {
  if (!activeProfileId) return;
  const p = profiles.find(x => x.id === activeProfileId);
  if (!p) return;
  if (!confirm(`Delete profile "${p.name}"?`)) return;
  profiles = profiles.filter(x => x.id !== activeProfileId);
  activeProfileId = null;
  save();
  render();
};

document.getElementById("reset").onclick = () => {
  if (!confirm("Reset ALL settings and delete all profiles?")) return;
  settings = { ...DEFAULT_SETTINGS };
  profiles = [];
  activeProfileId = null;
  save();
  render();
};

chrome.storage.sync.get(["settings", "profiles", "activeProfileId"], (res) => {
  if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
  profiles = Array.isArray(res.profiles) ? res.profiles : [];
  activeProfileId = res.activeProfileId || null;

  if (!Array.isArray(res.profiles) && res.settings) {
    profiles = [{
      id: uid(),
      name: "Default",
      settings: { ...DEFAULT_SETTINGS, ...res.settings }
    }];
    activeProfileId = profiles[0].id;
    chrome.storage.sync.set({ profiles, activeProfileId });
  }

  render();
});
