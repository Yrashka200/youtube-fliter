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

function save() {
  chrome.storage.sync.set({ settings });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type: "settingsUpdated" }).catch(() => {});
    }
  });
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
      save(); render();
    };
  });
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


chrome.storage.sync.get(["settings"], (res) => {
  if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
  render();
});

document.getElementById("enabled").onchange = (e) => { settings.enabled = e.target.checked; save(); };
document.getElementById("hideShorts").onchange = (e) => { settings.hideShorts = e.target.checked; save(); };
document.getElementById("hideWatched").onchange = (e) => { settings.hideWatched = e.target.checked; save(); };
document.getElementById("hideRussian").onchange = (e) => { settings.hideRussian = e.target.checked; save(); };
document.getElementById("hideEnglish").onchange = (e) => { settings.hideEnglish = e.target.checked; save(); };
document.getElementById("videoSize").onchange = (e) => { settings.videoSize = e.target.value; save(); };

document.querySelectorAll("[data-cat]").forEach(cb => {
  cb.onchange = () => {
    const cat = cb.dataset.cat;
    if (cb.checked) {
      if (!settings.blockedCategories.includes(cat)) settings.blockedCategories.push(cat);
    } else {
      settings.blockedCategories = settings.blockedCategories.filter(c => c !== cat);
    }
    save();
  };
});

document.getElementById("addKw").onclick = () => {
  const input = document.getElementById("kwInput");
  const val = input.value.trim().toLowerCase();
  if (val && !settings.customKeywords.includes(val)) {
    settings.customKeywords.push(val);
    input.value = "";
    save(); render();
  }
};
document.getElementById("kwInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("addKw").click();
});

document.getElementById("reset").onclick = () => {
  settings = { ...DEFAULT_SETTINGS };
  save(); render();
};
