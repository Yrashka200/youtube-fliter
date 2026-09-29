const DEFAULT_SETTINGS = {
  enabled: true,
  blockedCategories: [],
  customKeywords: [],
  videoSize: "default",
  hideShorts: false,
  hideWatched: true,
  hideRussian: false,
  hideEnglish: false,
  blockAds: true,
  blockAdsVideo: true,
  blockAdsBanners: true,
  blockAdsPopups: true,
  blockAdsNetwork: true,
  optimize: false,
  optimizeAnimations: true,
  optimizeVideos: true,
  optimizeEffects: true,
  optimizeScan: true,
  optimizeDom: true
};

const PRESETS = {
  work: {
    icon: "💼",
    name: "Work",
    settings: {
      ...DEFAULT_SETTINGS,
      blockedCategories: ["music", "games", "movies", "kids", "sports"],
      hideShorts: true,
      hideWatched: true
    }
  },
  relax: {
    icon: "🌴",
    name: "Relax",
    settings: {
      ...DEFAULT_SETTINGS,
      blockedCategories: ["work", "politics", "news"],
      hideShorts: false,
      hideWatched: true
    }
  },
  kids: {
    icon: "🧸",
    name: "Kids",
    settings: {
      ...DEFAULT_SETTINGS,
      blockedCategories: ["politics", "news", "crypto", "sports"],
      hideShorts: false,
      hideWatched: false
    }
  },
  study: {
    icon: "📚",
    name: "Study",
    settings: {
      ...DEFAULT_SETTINGS,
      blockedCategories: ["games", "music", "movies", "sports", "news", "politics"],
      hideShorts: true,
      hideWatched: true,
      optimize: true
    }
  },
  night: {
    icon: "🌙",
    name: "Night",
    settings: {
      ...DEFAULT_SETTINGS,
      blockedCategories: ["news", "politics", "sports"],
      hideShorts: false,
      hideWatched: true
    }
  }
};

const GITHUB_URL = "https://github.com/Yrashka200/youtube-fliter";

let settings = { ...DEFAULT_SETTINGS };
let profiles = [];
let activeProfileId = null;

let modalState = {
  mode: "new",
  presetKey: "custom",
  icon: "⭐",
  profileId: null
};

function uid() {
  return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
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

  saveCurrentToProfile();

  settings = { ...DEFAULT_SETTINGS, ...deepClone(p.settings) };
  activeProfileId = id;
  save();
  render();
  showToast(`${p.icon || "⭐"} Switched to "${p.name}"`, "ok");
}

function renderProfilesBar() {
  const scroll = document.getElementById("profilesScroll");
  const label = document.getElementById("activeProfileLabel");
  if (!scroll) return;

  scroll.innerHTML = "";

  profiles.forEach(p => {
    const chip = document.createElement("button");
    chip.className = "profile-chip" + (p.id === activeProfileId ? " active" : "");
    chip.innerHTML = `<span class="pc-icon">${p.icon || "⭐"}</span><span>${escapeHtml(p.name)}</span>`;
    chip.title = p.name;
    chip.onclick = () => applyProfile(p.id);
    scroll.appendChild(chip);
  });

  if (activeProfileId) {
    const editChip = document.createElement("button");
    editChip.className = "profile-chip edit";
    editChip.innerHTML = "✎";
    editChip.title = "Edit active profile";
    editChip.onclick = () => openProfileModal("edit", activeProfileId);
    scroll.appendChild(editChip);
  }

  const newChip = document.createElement("button");
  newChip.className = "profile-chip new";
  newChip.innerHTML = "＋ New";
  newChip.onclick = () => openProfileModal("new");
  scroll.appendChild(newChip);

  if (label) {
    const active = profiles.find(p => p.id === activeProfileId);
    if (active) {
      label.textContent = `active: ${active.name}`;
    } else {
      label.textContent = profiles.length ? "custom" : "no profiles yet";
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOptSubs() {
  const subs = document.getElementById("optSubs");
  if (subs) subs.classList.toggle("open", !!settings.optimize);

  const adSubs = document.getElementById("adSubs");
  if (adSubs) adSubs.classList.toggle("open", settings.blockAds !== false);
}

function renderMaster() {
  document.body.classList.toggle("filter-off", !settings.enabled);
}

function renderSizeGrid() {
  document.querySelectorAll(".size-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.size === settings.videoSize);
  });
}

function renderChips() {
  document.querySelectorAll("#catChips .chip").forEach(chip => {
    const cat = chip.dataset.cat;
    const active = settings.blockedCategories.includes(cat);
    chip.classList.toggle("active", active);
    const cb = chip.querySelector("input");
    if (cb) cb.checked = active;
  });
}

function render() {
  document.getElementById("enabled").checked = settings.enabled;
  document.getElementById("blockAds").checked = settings.blockAds !== false;
  document.getElementById("blockAdsVideo").checked = settings.blockAdsVideo !== false;
  document.getElementById("blockAdsBanners").checked = settings.blockAdsBanners !== false;
  document.getElementById("blockAdsPopups").checked = settings.blockAdsPopups !== false;
  document.getElementById("blockAdsNetwork").checked = settings.blockAdsNetwork !== false;
  document.getElementById("optimize").checked = !!settings.optimize;
  document.getElementById("optimizeAnimations").checked = settings.optimizeAnimations !== false;
  document.getElementById("optimizeVideos").checked = settings.optimizeVideos !== false;
  document.getElementById("optimizeEffects").checked = settings.optimizeEffects !== false;
  document.getElementById("optimizeScan").checked = settings.optimizeScan !== false;
  document.getElementById("optimizeDom").checked = settings.optimizeDom !== false;
  document.getElementById("hideShorts").checked = settings.hideShorts;
  document.getElementById("hideWatched").checked = settings.hideWatched;
  document.getElementById("hideRussian").checked = settings.hideRussian;
  document.getElementById("hideEnglish").checked = settings.hideEnglish;

  renderOptSubs();
  renderMaster();
  renderSizeGrid();
  renderChips();
  renderProfilesBar();

  const list = document.getElementById("kwList");
  list.innerHTML = "";
  if (!settings.customKeywords.length) {
    list.innerHTML = `<div class="kw-empty">No custom words yet.</div>`;
  } else {
    settings.customKeywords.forEach((kw, i) => {
      const el = document.createElement("div");
      el.className = "kw";
      el.innerHTML = `${escapeHtml(kw)} <span data-i="${i}">×</span>`;
      list.appendChild(el);
    });
  }
  list.querySelectorAll("span").forEach(s => {
    s.onclick = () => {
      settings.customKeywords.splice(parseInt(s.dataset.i), 1);
      saveCurrentToProfile();
      save();
      render();
    };
  });
}

function renderUpdate(state) {
  const versionEl = document.getElementById("versionInfo");
  const statusEl = document.getElementById("updateStatus");
  const btn = document.getElementById("updateBtn");
  const localV = chrome.runtime.getManifest().version;

  versionEl.textContent = `v${localV}`;
  statusEl.className = "update-status";

  if (!state) {
    statusEl.textContent = "Checking for updates…";
    btn.style.display = "none";
    return;
  }

  if (state.error) {
    statusEl.textContent = "⚠ Update check failed";
    statusEl.title = state.error;
    statusEl.classList.add("error");
    btn.style.display = "none";
    return;
  }

  if (state.hasUpdate) {
    statusEl.textContent = `🎉 Update available: v${state.remoteVersion}`;
    statusEl.classList.add("available");
    btn.style.display = "block";
  } else {
    statusEl.textContent = "✔ You're up to date";
    statusEl.classList.add("ok");
    btn.style.display = "none";
  }

  const content = document.getElementById("changelogContent");
  if (state.changelogHtml) {
    content.innerHTML = state.changelogHtml;
  } else {
    content.innerHTML = `<div class="changelog-empty">No changelog available.</div>`;
  }
}

function showToast(text, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.className = "toast show " + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.className = "toast " + type;
  }, 2200);
}

function openProfileModal(mode, profileId) {
  modalState.mode = mode;
  modalState.profileId = profileId || null;

  const titleEl = document.getElementById("pmTitle");
  const subEl = document.getElementById("pmSub");
  const nameInput = document.getElementById("pmName");
  const deleteBtn = document.getElementById("pmDelete");
  const presetGrid = document.getElementById("presetGrid");
  const presetBtns = presetGrid.querySelectorAll(".preset-btn");

  presetBtns.forEach(b => b.classList.remove("active"));

  if (mode === "new") {
    titleEl.textContent = "New profile";
    subEl.textContent = "Pick a preset or start custom. You can tweak every setting after.";
    nameInput.value = "";
    deleteBtn.style.display = "none";
    modalState.presetKey = "custom";
    modalState.icon = "⭐";
    presetGrid.querySelector('[data-preset="custom"]').classList.add("active");
  } else {
    const p = profiles.find(x => x.id === profileId);
    if (!p) return;
    titleEl.textContent = "Edit profile";
    subEl.textContent = `Editing "${p.name}"`;
    nameInput.value = p.name;
    deleteBtn.style.display = "block";
    modalState.icon = p.icon || "⭐";
    modalState.presetKey = null;
  }

  document.querySelectorAll("#iconGrid .icon-opt").forEach(el => {
    el.classList.toggle("active", el.dataset.icon === modalState.icon);
  });

  document.getElementById("profileModal").classList.add("open");
  setTimeout(() => nameInput.focus(), 100);
}

function closeProfileModal() {
  document.getElementById("profileModal").classList.remove("open");
}

document.getElementById("iconGrid").onclick = (e) => {
  const opt = e.target.closest(".icon-opt");
  if (!opt) return;
  modalState.icon = opt.dataset.icon;
  document.querySelectorAll("#iconGrid .icon-opt").forEach(el => {
    el.classList.toggle("active", el === opt);
  });
};

document.getElementById("presetGrid").onclick = (e) => {
  const btn = e.target.closest(".preset-btn");
  if (!btn) return;
  const key = btn.dataset.preset;
  modalState.presetKey = key;

  document.querySelectorAll("#presetGrid .preset-btn").forEach(el => {
    el.classList.toggle("active", el === btn);
  });

  const preset = PRESETS[key];
  if (preset) {
    modalState.icon = preset.icon;
    document.querySelectorAll("#iconGrid .icon-opt").forEach(el => {
      el.classList.toggle("active", el.dataset.icon === preset.icon);
    });
    if (!document.getElementById("pmName").value.trim()) {
      document.getElementById("pmName").value = preset.name;
    }
  }
};

document.getElementById("pmCancel").onclick = closeProfileModal;

document.getElementById("profileModal").onclick = (e) => {
  if (e.target.id === "profileModal") closeProfileModal();
};

document.getElementById("pmSave").onclick = () => {
  const name = document.getElementById("pmName").value.trim();
  if (!name) {
    showToast("⚠ Enter a profile name", "err");
    return;
  }

  if (modalState.mode === "new") {
    let baseSettings;
    if (modalState.presetKey && PRESETS[modalState.presetKey]) {
      baseSettings = deepClone(PRESETS[modalState.presetKey].settings);
    } else {
      baseSettings = { ...settings };
    }

    const p = {
      id: uid(),
      name,
      icon: modalState.icon,
      settings: baseSettings
    };
    profiles.push(p);
    activeProfileId = p.id;
    settings = { ...DEFAULT_SETTINGS, ...deepClone(baseSettings) };
    save();
    render();
    showToast(`✔ Created "${name}"`, "ok");
  } else {
    const p = profiles.find(x => x.id === modalState.profileId);
    if (p) {
      p.name = name;
      p.icon = modalState.icon;
      save();
      render();
      showToast(`✔ Updated "${name}"`, "ok");
    }
  }

  closeProfileModal();
};

document.getElementById("pmDelete").onclick = () => {
  const p = profiles.find(x => x.id === modalState.profileId);
  if (!p) return;
  if (!confirm(`Delete profile "${p.name}"?`)) return;

  profiles = profiles.filter(x => x.id !== p.id);
  if (activeProfileId === p.id) {
    activeProfileId = null;
  }
  save();
  render();
  closeProfileModal();
  showToast(`✔ Deleted "${p.name}"`, "ok");
};

document.querySelectorAll(".tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    const panel = document.querySelector(`[data-panel="${tab.dataset.tab}"]`);
    if (panel) panel.classList.add("active");
  };
});

document.querySelectorAll("#catChips .chip").forEach(chip => {
  chip.onclick = (e) => {
    e.preventDefault();
    const cat = chip.dataset.cat;
    const isActive = settings.blockedCategories.includes(cat);
    if (isActive) {
      settings.blockedCategories = settings.blockedCategories.filter(c => c !== cat);
    } else {
      settings.blockedCategories.push(cat);
    }
    chip.classList.toggle("active", !isActive);
    const cb = chip.querySelector("input");
    if (cb) cb.checked = !isActive;
    saveCurrentToProfile();
    save();
  };
});

document.querySelectorAll(".size-btn").forEach(btn => {
  btn.onclick = () => {
    settings.videoSize = btn.dataset.size;
    renderSizeGrid();
    saveCurrentToProfile();
    save();
  };
});

document.querySelectorAll(".donate-fake-btn").forEach(btn => {
  btn.onclick = () => {
    document.getElementById("jokeOverlay").classList.add("open");
  };
});

document.getElementById("jokeClose").onclick = () => {
  document.getElementById("jokeOverlay").classList.remove("open");
};

document.getElementById("jokeStar").onclick = () => {
  chrome.tabs.create({ url: GITHUB_URL });
  document.getElementById("jokeOverlay").classList.remove("open");
};

document.getElementById("jokeOverlay").onclick = (e) => {
  if (e.target.id === "jokeOverlay") {
    e.target.classList.remove("open");
  }
};

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

function exportSettings() {
  const data = {
    _type: "youtube-feed-filter-settings",
    _version: 6,
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

  showToast("✔ Settings exported", "ok");
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
          icon: p.icon || "⭐",
          settings: { ...DEFAULT_SETTINGS, ...(p.settings || {}) }
        }));
      }

      activeProfileId = data.activeProfileId || null;

      save();
      render();

      chrome.runtime.sendMessage({
        type: "applyAdBlock",
        enabled: settings.blockAds !== false
      });

      const ver = data._extensionVersion ? ` (from v${data._extensionVersion})` : "";
      showToast(`✔ Settings imported${ver}`, "ok");
    } catch (err) {
      showToast(`⚠ ${err.message}`, "err");
    }
  };

  reader.onerror = () => {
    showToast("⚠ Failed to read file", "err");
  };

  reader.readAsText(file);
}

document.getElementById("enabled").onchange = (e) => {
  settings.enabled = e.target.checked;
  renderMaster();
  saveCurrentToProfile();
  save();
};

document.getElementById("blockAds").onchange = (e) => {
  settings.blockAds = e.target.checked;
  saveCurrentToProfile();
  save();
  renderOptSubs();
  chrome.runtime.sendMessage({ type: "applyAdBlock", enabled: settings.blockAds });
};

document.getElementById("blockAdsVideo").onchange = (e) => {
  settings.blockAdsVideo = e.target.checked;
  saveCurrentToProfile();
  save();
};

document.getElementById("blockAdsBanners").onchange = (e) => {
  settings.blockAdsBanners = e.target.checked;
  saveCurrentToProfile();
  save();
};

document.getElementById("blockAdsPopups").onchange = (e) => {
  settings.blockAdsPopups = e.target.checked;
  saveCurrentToProfile();
  save();
};

document.getElementById("blockAdsNetwork").onchange = (e) => {
  settings.blockAdsNetwork = e.target.checked;
  saveCurrentToProfile();
  save();
  chrome.runtime.sendMessage({ type: "applyAdBlock", enabled: settings.blockAds });
};

document.getElementById("optimize").onchange = (e) => {
  settings.optimize = e.target.checked;
  saveCurrentToProfile();
  save();
  renderOptSubs();
};

document.getElementById("optimizeAnimations").onchange = (e) => {
  settings.optimizeAnimations = e.target.checked;
  saveCurrentToProfile();
  save();
};

document.getElementById("optimizeVideos").onchange = (e) => {
  settings.optimizeVideos = e.target.checked;
  saveCurrentToProfile();
  save();
};

document.getElementById("optimizeEffects").onchange = (e) => {
  settings.optimizeEffects = e.target.checked;
  saveCurrentToProfile();
  save();
};

document.getElementById("optimizeScan").onchange = (e) => {
  settings.optimizeScan = e.target.checked;
  saveCurrentToProfile();
  save();
};

document.getElementById("optimizeDom").onchange = (e) => {
  settings.optimizeDom = e.target.checked;
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

document.getElementById("reset").onclick = () => {
  if (!confirm("Reset ALL settings and delete all profiles?")) return;
  settings = { ...DEFAULT_SETTINGS };
  profiles = [];
  activeProfileId = null;
  save();
  render();
  chrome.runtime.sendMessage({ type: "applyAdBlock", enabled: true });
  showToast("✔ Reset complete", "ok");
};

chrome.storage.sync.get(["settings", "profiles", "activeProfileId"], (res) => {
  if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
  profiles = Array.isArray(res.profiles) ? res.profiles : [];
  activeProfileId = res.activeProfileId || null;

  if (!Array.isArray(res.profiles) && res.settings) {
    profiles = [{
      id: uid(),
      name: "Default",
      icon: "⭐",
      settings: { ...DEFAULT_SETTINGS, ...res.settings }
    }];
    activeProfileId = profiles[0].id;
    chrome.storage.sync.set({ profiles, activeProfileId });
  }

  render();
});
