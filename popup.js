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
  optimizeDom: true,
  activeThemeId: "default"
};

const PRESETS = {
  work: {
    icon: "💼", name: "Work",
    settings: { ...DEFAULT_SETTINGS, blockedCategories: ["music","games","movies","kids","sports"], hideShorts: true, hideWatched: true }
  },
  relax: {
    icon: "🌴", name: "Relax",
    settings: { ...DEFAULT_SETTINGS, blockedCategories: ["work","politics","news"], hideShorts: false, hideWatched: true }
  },
  kids: {
    icon: "🧸", name: "Kids",
    settings: { ...DEFAULT_SETTINGS, blockedCategories: ["politics","news","crypto","sports"], hideShorts: false, hideWatched: false }
  },
  study: {
    icon: "📚", name: "Study",
    settings: { ...DEFAULT_SETTINGS, blockedCategories: ["games","music","movies","sports","news","politics"], hideShorts: true, hideWatched: true, optimize: true }
  },
  night: {
    icon: "🌙", name: "Night",
    settings: { ...DEFAULT_SETTINGS, blockedCategories: ["news","politics","sports"], hideShorts: false, hideWatched: true }
  }
};

const GITHUB_URL = "https://github.com/Yrashka200/youtube-fliter";

let settings = { ...DEFAULT_SETTINGS };
let profiles = [];
let activeProfileId = null;

let themes = [];
const DEFAULT_THEME = {
  id: "default",
  name: "Default (YouTube)",
  url: "",
  fileName: "",
  source: "none",
  dim: false,
  blur: false,
  isDefault: true
};

let modalState = {
  mode: "new",
  presetKey: "custom",
  icon: "⭐",
  profileId: null
};

let themeModalState = {
  mode: "new",
  themeId: null,
  url: "",
  fileName: "",
  source: "file"
};

let focusState = {
  active: false,
  endsAt: 0,
  profileId: null,
  prevProfileId: null
};
let focusTickTimer = null;

function uid() {
  return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function themeUid() {
  return "t_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function save() {
  chrome.storage.sync.set({ settings, profiles, activeProfileId });
  chrome.storage.local.set({ themes });
  chrome.storage.local.set({ focusState });
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

/* ===== Focus Mode ===== */

function startFocusMode(profileId, minutes) {
  const p = profiles.find(x => x.id === profileId);
  if (!p) { showToast("⚠ Pick a profile", "err"); return; }
  const mins = Math.max(1, Math.min(600, parseInt(minutes, 10) || 60));

  focusState.active = true;
  focusState.endsAt = Date.now() + mins * 60 * 1000;
  focusState.profileId = profileId;
  focusState.prevProfileId = activeProfileId || null;

  applyProfile(profileId);

  chrome.alarms.create("focus-end", { when: focusState.endsAt });

  save();
  startFocusTick();
  renderFocusBanner();
  document.body.classList.add("focus-active");
  showToast(`🎯 Focus: "${p.name}" for ${mins} min`, "ok");
}

function stopFocusMode(restore = true) {
  if (!focusState.active) return;
  const prev = focusState.prevProfileId;

  focusState.active = false;
  focusState.endsAt = 0;
  focusState.profileId = null;
  focusState.prevProfileId = null;

  chrome.alarms.clear("focus-end");

  if (restore && prev && profiles.find(p => p.id === prev)) {
    applyProfile(prev);
  } else {
    save();
  }

  stopFocusTick();
  renderFocusBanner();
  document.body.classList.remove("focus-active");
  showToast("🎯 Focus mode ended", "ok");
}

function startFocusTick() {
  stopFocusTick();
  focusTickTimer = setInterval(() => {
    if (!focusState.active) { stopFocusTick(); return; }
    if (Date.now() >= focusState.endsAt) {
      stopFocusMode(true);
      return;
    }
    renderFocusBanner();
  }, 1000);
  renderFocusBanner();
}

function stopFocusTick() {
  if (focusTickTimer) {
    clearInterval(focusTickTimer);
    focusTickTimer = null;
  }
}

function fmtTime(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function renderFocusBanner() {
  const banner = document.getElementById("focusBanner");
  const timeEl = document.getElementById("focusTime");
  const label = document.getElementById("focusLabel");
  if (!banner || !timeEl) return;

  if (!focusState.active) {
    banner.classList.remove("open");
    document.body.classList.remove("focus-active");
    return;
  }

  banner.classList.add("open");
  document.body.classList.add("focus-active");
  timeEl.textContent = fmtTime(focusState.endsAt - Date.now());

  const p = profiles.find(x => x.id === focusState.profileId);
  if (label) label.textContent = p ? `Focus: ${p.name}` : "Focus mode";
}

function populateFocusProfiles() {
  const sel = document.getElementById("focusProfile");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = "";
  profiles.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = `${p.icon || "⭐"} ${p.name}`;
    sel.appendChild(opt);
  });
  if (cur && profiles.find(p => p.id === cur)) sel.value = cur;
  else if (activeProfileId && profiles.find(p => p.id === activeProfileId)) sel.value = activeProfileId;
  else if (profiles[0]) sel.value = profiles[0].id;
}

/* ===== Themes ===== */

function ensureThemes() {
  if (!Array.isArray(themes)) themes = [];
  themes = themes.filter(t => t && t.id !== "default");
  themes = themes.map(t => ({
    id: t.id || themeUid(),
    name: t.name || "Theme",
    url: t.url || "",
    fileName: t.fileName || "",
    source: t.source || (t.url ? "file" : "none"),
    dim: !!t.dim,
    blur: !!t.blur
  }));
  themes = [DEFAULT_THEME, ...themes];
}

function getActiveTheme() {
  ensureThemes();
  return themes.find(t => t.id === settings.activeThemeId) || themes[0];
}

function renderThemes() {
  ensureThemes();

  const list = document.getElementById("themeList");
  if (!list) return;
  list.innerHTML = "";

  themes.forEach(t => {
    const item = document.createElement("div");
    item.className = "theme-item" + (t.id === settings.activeThemeId ? " active" : "");

    const thumb = document.createElement("div");
    thumb.className = "theme-thumb" + (t.isDefault ? " default" : "");
    if (t.isDefault) {
      thumb.textContent = "🎬";
    } else if (t.url) {
      thumb.style.backgroundImage = `url("${t.url}")`;
    } else {
      thumb.textContent = "🖼";
    }
    item.appendChild(thumb);

    const info = document.createElement("div");
    info.className = "theme-info";

    const name = document.createElement("div");
    name.className = "theme-name";
    name.textContent = t.name;
    info.appendChild(name);

    const sub = document.createElement("div");
    sub.className = "theme-sub";
    if (t.isDefault) sub.textContent = "No custom background";
    else {
      const bits = [];
      if (t.source === "url") bits.push("URL");
      else if (t.source === "file") bits.push("File");
      if (t.dim) bits.push("Dim");
      if (t.blur) bits.push("Blur");
      sub.textContent = bits.join(" · ") || "No image";
    }
    info.appendChild(sub);

    item.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "theme-actions";

    if (!t.isDefault) {
      const edit = document.createElement("button");
      edit.className = "theme-act";
      edit.title = "Edit";
      edit.textContent = "✎";
      edit.onclick = (e) => {
        e.stopPropagation();
        openThemeModal("edit", t.id);
      };
      actions.appendChild(edit);

      const del = document.createElement("button");
      del.className = "theme-act del";
      del.title = "Delete";
      del.textContent = "🗑";
      del.onclick = (e) => {
        e.stopPropagation();
        deleteTheme(t.id);
      };
      actions.appendChild(del);
    }

    item.appendChild(actions);

    item.onclick = () => {
      if (focusState.active) {
        showToast("🎯 Focus mode active", "err");
        return;
      }
      settings.activeThemeId = t.id;
      save();
      renderThemes();
      showToast(`🎨 Theme: ${t.name}`, "ok");
    };

    list.appendChild(item);
  });
}

function openThemeModal(mode, themeId) {
  themeModalState.mode = mode;
  themeModalState.themeId = themeId || null;

  const titleEl = document.getElementById("tmTitle");
  const subEl = document.getElementById("tmSub");
  const nameEl = document.getElementById("tmName");
  const urlEl = document.getElementById("tmUrl");
  const delBtn = document.getElementById("tmDelete");
  const dimEl = document.getElementById("tmDim");
  const blurEl = document.getElementById("tmBlur");

  if (mode === "new") {
    titleEl.textContent = "New theme";
    subEl.textContent = "Give it a name and pick a background.";
    nameEl.value = "";
    urlEl.value = "";
    dimEl.checked = false;
    blurEl.checked = false;
    delBtn.style.display = "none";
    themeModalState.url = "";
    themeModalState.fileName = "";
    themeModalState.source = "file";
  } else {
    const t = themes.find(x => x.id === themeId);
    if (!t) return;
    titleEl.textContent = "Edit theme";
    subEl.textContent = `Editing "${t.name}"`;
    nameEl.value = t.name;
    urlEl.value = t.source === "url" ? t.url : "";
    dimEl.checked = !!t.dim;
    blurEl.checked = !!t.blur;
    delBtn.style.display = "block";
    themeModalState.url = t.url || "";
    themeModalState.fileName = t.fileName || "";
    themeModalState.source = t.source || "file";
  }

  renderThemeModalPreview();
  setThemeSrcTab(themeModalState.source);

  document.getElementById("themeModal").classList.add("open");
  setTimeout(() => nameEl.focus(), 100);
}

function closeThemeModal() {
  document.getElementById("themeModal").classList.remove("open");
}

function setThemeSrcTab(src) {
  themeModalState.source = src;
  document.querySelectorAll("#themeModal .bg-src-tab").forEach(t =>
    t.classList.toggle("active", t.dataset.src === src)
  );
  document.querySelectorAll("#themeModal .bg-src-panel").forEach(p =>
    p.classList.toggle("active", p.dataset.srcPanel === src)
  );
}

function renderThemeModalPreview() {
  const wrap = document.getElementById("tmPreviewWrap");
  const img = document.getElementById("tmPreviewImg");
  const empty = document.getElementById("tmPreviewEmpty");
  const nameEl = document.getElementById("tmFileName");

  const url = themeModalState.url;

  if (url) {
    img.src = url;
    wrap.style.display = "block";
    empty.style.display = "none";
  } else {
    img.removeAttribute("src");
    wrap.style.display = "none";
    empty.style.display = "block";
  }

  if (themeModalState.source === "file") {
    nameEl.textContent = themeModalState.fileName || "No file selected.";
  }
}

function deleteTheme(id) {
  const t = themes.find(x => x.id === id);
  if (!t || t.isDefault) return;
  if (!confirm(`Delete theme "${t.name}"?`)) return;

  themes = themes.filter(x => x.id !== id);
  if (settings.activeThemeId === id) settings.activeThemeId = "default";
  save();
  renderThemes();
  showToast(`✔ Deleted "${t.name}"`, "ok");
}

document.querySelectorAll("#themeModal .bg-src-tab").forEach(tab => {
  tab.onclick = () => setThemeSrcTab(tab.dataset.src);
});

document.getElementById("tmPickFile").onclick = () => {
  document.getElementById("tmFile").click();
};

document.getElementById("tmFile").onchange = (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("⚠ Not an image", "err");
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showToast("⚠ Image too big (max 8 MB)", "err");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    themeModalState.url = String(reader.result);
    themeModalState.fileName = file.name;
    themeModalState.source = "file";
    renderThemeModalPreview();
  };
  reader.onerror = () => showToast("⚠ Failed to read file", "err");
  reader.readAsDataURL(file);
};

document.getElementById("tmUrl").oninput = (e) => {
  themeModalState.url = e.target.value.trim();
  themeModalState.fileName = "";
  themeModalState.source = "url";
  renderThemeModalPreview();
};

document.getElementById("tmClearImg").onclick = () => {
  themeModalState.url = "";
  themeModalState.fileName = "";
  document.getElementById("tmUrl").value = "";
  renderThemeModalPreview();
};

document.getElementById("tmCancel").onclick = closeThemeModal;

document.getElementById("themeModal").onclick = (e) => {
  if (e.target.id === "themeModal") closeThemeModal();
};

document.getElementById("tmSave").onclick = () => {
  const name = document.getElementById("tmName").value.trim();
  if (!name) {
    showToast("⚠ Enter a theme name", "err");
    return;
  }

  const dim = document.getElementById("tmDim").checked;
  const blur = document.getElementById("tmBlur").checked;

  if (themeModalState.mode === "new") {
    const t = {
      id: themeUid(),
      name,
      url: themeModalState.url || "",
      fileName: themeModalState.fileName || "",
      source: themeModalState.url ? themeModalState.source : "none",
      dim,
      blur
    };
    themes.push(t);
    settings.activeThemeId = t.id;
    save();
    renderThemes();
    showToast(`✔ Created "${name}"`, "ok");
  } else {
    const t = themes.find(x => x.id === themeModalState.themeId);
    if (!t) return;
    t.name = name;
    t.url = themeModalState.url || "";
    t.fileName = themeModalState.fileName || "";
    t.source = themeModalState.url ? themeModalState.source : "none";
    t.dim = dim;
    t.blur = blur;
    save();
    renderThemes();
    showToast(`✔ Updated "${name}"`, "ok");
  }

  closeThemeModal();
};

document.getElementById("tmDelete").onclick = () => {
  if (themeModalState.themeId) deleteTheme(themeModalState.themeId);
  closeThemeModal();
};

document.getElementById("themeAdd").onclick = () => openThemeModal("new");

/* ===== Profiles ===== */

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

  if (activeProfileId && !focusState.active) {
    const editChip = document.createElement("button");
    editChip.className = "profile-chip edit";
    editChip.innerHTML = "✎";
    editChip.title = "Edit active profile";
    editChip.onclick = () => openProfileModal("edit", activeProfileId);
    scroll.appendChild(editChip);
  }

  if (!focusState.active) {
    const newChip = document.createElement("button");
    newChip.className = "profile-chip new";
    newChip.innerHTML = "＋ New";
    newChip.onclick = () => openProfileModal("new");
    scroll.appendChild(newChip);
  }

  if (label) {
    const active = profiles.find(p => p.id === activeProfileId);
    if (active) label.textContent = `active: ${active.name}`;
    else label.textContent = profiles.length ? "custom" : "no profiles yet";
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
  renderThemes();
  renderProfilesBar();
  populateFocusProfiles();
  renderFocusBanner();

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
      if (focusState.active) return;
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
  content.innerHTML = state.changelogHtml || `<div class="changelog-empty">No changelog available.</div>`;
}

function showToast(text, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.className = "toast show " + type;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.className = "toast " + type; }, 2200);
}

/* ===== Profile modal ===== */

function openProfileModal(mode, profileId) {
  if (focusState.active) {
    showToast("🎯 Focus mode active", "err");
    return;
  }

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
  if (!name) { showToast("⚠ Enter a profile name", "err"); return; }

  if (modalState.mode === "new") {
    let baseSettings;
    if (modalState.presetKey && PRESETS[modalState.presetKey]) {
      baseSettings = deepClone(PRESETS[modalState.presetKey].settings);
    } else {
      baseSettings = { ...settings };
    }
    const p = { id: uid(), name, icon: modalState.icon, settings: baseSettings };
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
  if (activeProfileId === p.id) activeProfileId = null;
  save();
  render();
  closeProfileModal();
  showToast(`✔ Deleted "${p.name}"`, "ok");
};

/* ===== Tabs, chips, misc ===== */

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
    if (focusState.active) return;
    const cat = chip.dataset.cat;
    const isActive = settings.blockedCategories.includes(cat);
    if (isActive) settings.blockedCategories = settings.blockedCategories.filter(c => c !== cat);
    else settings.blockedCategories.push(cat);
    chip.classList.toggle("active", !isActive);
    const cb = chip.querySelector("input");
    if (cb) cb.checked = !isActive;
    saveCurrentToProfile();
    save();
  };
});

document.querySelectorAll(".size-btn").forEach(btn => {
  btn.onclick = () => {
    if (focusState.active) return;
    settings.videoSize = btn.dataset.size;
    renderSizeGrid();
    saveCurrentToProfile();
    save();
  };
});

document.querySelectorAll(".donate-fake-btn").forEach(btn => {
  btn.onclick = () => { document.getElementById("jokeOverlay").classList.add("open"); };
});
document.getElementById("jokeClose").onclick = () => {
  document.getElementById("jokeOverlay").classList.remove("open");
};
document.getElementById("jokeStar").onclick = () => {
  chrome.tabs.create({ url: GITHUB_URL });
  document.getElementById("jokeOverlay").classList.remove("open");
};
document.getElementById("jokeOverlay").onclick = (e) => {
  if (e.target.id === "jokeOverlay") e.target.classList.remove("open");
};

/* ===== Updates ===== */

chrome.storage.local.get(["updateState"], (res) => renderUpdate(res.updateState));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.updateState) renderUpdate(changes.updateState.newValue);
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

/* ===== Backup ===== */

document.getElementById("exportBtn").onclick = exportSettings;
document.getElementById("importBtn").onclick = () => document.getElementById("importFile").click();
document.getElementById("importFile").onchange = (e) => {
  const file = e.target.files?.[0];
  if (file) importSettings(file);
  e.target.value = "";
};

function exportSettings() {
  const exportThemes = themes.map(t =>
    t.url && t.url.startsWith("data:")
      ? { ...t, url: "", fileName: "", source: "none" }
      : t
  );

  const data = {
    _type: "youtube-feed-filter-settings",
    _version: 9,
    _exportedAt: new Date().toISOString(),
    _extensionVersion: chrome.runtime.getManifest().version,
    settings,
    profiles,
    activeProfileId,
    themes: exportThemes
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
      if (!data || data._type !== "youtube-feed-filter-settings") throw new Error("Invalid settings file");

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

      if (Array.isArray(data.themes)) {
        const imported = data.themes.filter(t => t.id !== "default").map(t => ({
          id: t.id || themeUid(),
          name: t.name || "Theme",
          url: t.url || "",
          fileName: t.fileName || "",
          source: t.source || (t.url ? "url" : "none"),
          dim: !!t.dim,
          blur: !!t.blur
        }));
        themes = imported;
      }

      activeProfileId = data.activeProfileId || null;

      save();
      render();
      chrome.runtime.sendMessage({ type: "applyAdBlock", enabled: settings.blockAds !== false });

      const ver = data._extensionVersion ? ` (from v${data._extensionVersion})` : "";
      showToast(`✔ Settings imported${ver}`, "ok");
    } catch (err) {
      showToast(`⚠ ${err.message}`, "err");
    }
  };
  reader.onerror = () => showToast("⚠ Failed to read file", "err");
  reader.readAsText(file);
}

/* ===== Basic toggles ===== */

document.getElementById("enabled").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.enabled; return; }
  settings.enabled = e.target.checked;
  renderMaster(); saveCurrentToProfile(); save();
};
document.getElementById("blockAds").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.blockAds !== false; return; }
  settings.blockAds = e.target.checked;
  saveCurrentToProfile(); save(); renderOptSubs();
  chrome.runtime.sendMessage({ type: "applyAdBlock", enabled: settings.blockAds });
};
document.getElementById("blockAdsVideo").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.blockAdsVideo !== false; return; }
  settings.blockAdsVideo = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("blockAdsBanners").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.blockAdsBanners !== false; return; }
  settings.blockAdsBanners = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("blockAdsPopups").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.blockAdsPopups !== false; return; }
  settings.blockAdsPopups = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("blockAdsNetwork").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.blockAdsNetwork !== false; return; }
  settings.blockAdsNetwork = e.target.checked; saveCurrentToProfile(); save();
  chrome.runtime.sendMessage({ type: "applyAdBlock", enabled: settings.blockAds });
};
document.getElementById("optimize").onchange = (e) => {
  if (focusState.active) { e.target.checked = !!settings.optimize; return; }
  settings.optimize = e.target.checked; saveCurrentToProfile(); save(); renderOptSubs();
};
document.getElementById("optimizeAnimations").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.optimizeAnimations !== false; return; }
  settings.optimizeAnimations = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("optimizeVideos").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.optimizeVideos !== false; return; }
  settings.optimizeVideos = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("optimizeEffects").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.optimizeEffects !== false; return; }
  settings.optimizeEffects = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("optimizeScan").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.optimizeScan !== false; return; }
  settings.optimizeScan = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("optimizeDom").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.optimizeDom !== false; return; }
  settings.optimizeDom = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("hideShorts").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.hideShorts; return; }
  settings.hideShorts = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("hideWatched").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.hideWatched; return; }
  settings.hideWatched = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("hideRussian").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.hideRussian; return; }
  settings.hideRussian = e.target.checked; saveCurrentToProfile(); save();
};
document.getElementById("hideEnglish").onchange = (e) => {
  if (focusState.active) { e.target.checked = settings.hideEnglish; return; }
  settings.hideEnglish = e.target.checked; saveCurrentToProfile(); save();
};

document.getElementById("addKw").onclick = () => {
  if (focusState.active) return;
  const input = document.getElementById("kwInput");
  const val = input.value.trim().toLowerCase();
  if (val && !settings.customKeywords.includes(val)) {
    settings.customKeywords.push(val);
    input.value = "";
    saveCurrentToProfile(); save(); render();
  }
};
document.getElementById("kwInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addKw").click();
});

document.getElementById("reset").onclick = () => {
  if (focusState.active) { showToast("🎯 Focus mode active", "err"); return; }
  if (!confirm("Reset ALL settings, delete all profiles and themes?")) return;
  settings = { ...DEFAULT_SETTINGS };
  profiles = [];
  activeProfileId = null;
  themes = [];
  ensureThemes();
  save();
  render();
  chrome.runtime.sendMessage({ type: "applyAdBlock", enabled: true });
  showToast("✔ Reset complete", "ok");
};

/* ===== Focus buttons ===== */

document.getElementById("focusStart").onclick = () => {
  if (focusState.active) { showToast("🎯 Already active", "err"); return; }
  const sel = document.getElementById("focusProfile");
  const durInput = document.getElementById("focusDuration");
  if (!sel || !sel.value) { showToast("⚠ Add a profile first", "err"); return; }
  startFocusMode(sel.value, durInput.value);
};

document.querySelectorAll(".focus-preset").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".focus-preset").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const inp = document.getElementById("focusDuration");
    if (inp) inp.value = btn.dataset.min;
  };
});

document.getElementById("focusStop").onclick = () => {
  stopFocusMode(true);
};

/* ===== Init ===== */

chrome.storage.local.get(["focusState"], (r) => {
  if (r.focusState && r.focusState.active) {
    if (Date.now() >= r.focusState.endsAt) {
      chrome.storage.local.remove("focusState");
      chrome.alarms.clear("focus-end");
    } else {
      focusState = r.focusState;
      startFocusTick();
    }
  }
});

chrome.storage.sync.get(["settings", "profiles", "activeProfileId"], (res) => {
  if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
  profiles = Array.isArray(res.profiles) ? res.profiles : [];
  activeProfileId = res.activeProfileId || null;

  if (!Array.isArray(res.profiles) && res.settings) {
    profiles = [{ id: uid(), name: "Default", icon: "⭐", settings: { ...DEFAULT_SETTINGS, ...res.settings } }];
    activeProfileId = profiles[0].id;
    chrome.storage.sync.set({ profiles, activeProfileId });
  }

  chrome.storage.local.get(["themes"], (r2) => {
    themes = Array.isArray(r2.themes) ? r2.themes : [];
    ensureThemes();
    if (!settings.activeThemeId || !themes.find(t => t.id === settings.activeThemeId)) {
      settings.activeThemeId = "default";
    }
    render();
    if (focusState.active) renderFocusBanner();
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.themes) {
    themes = Array.isArray(changes.themes.newValue) ? changes.themes.newValue : [];
    ensureThemes();
    renderThemes();
  }
});