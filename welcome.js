const DEFAULT_SETTINGS = {
  enabled: true,
  blockedCategories: [],
  customKeywords: [],
  videoSize: "default",
  pipEnabled: true,
  hideShorts: false,
  hideWatched: true,
  hideRussian: false,
  hideEnglish: false,
  fakePremium: false,
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

const setupSteps = ["tour", "topics", "language", "feed", "extras", "profile"];
const steps = Array.from(document.querySelectorAll(".step"));
const footer = document.getElementById("footer");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");
const progressFill = document.getElementById("progressFill");
const stepCount = document.getElementById("stepCount");
const guideNotes = document.querySelectorAll("[data-guide]");

let guided = true;
let currentStep = "question";
let selectedStepIndex = 0;
let activeSteps = setupSteps;
let saving = false;

document.getElementById("version").textContent = chrome.runtime.getManifest().version;

function showStep(stepName) {
  currentStep = stepName;
  steps.forEach((step) => {
    const active = step.dataset.step === stepName;
    step.classList.toggle("active", active);
    step.setAttribute("aria-hidden", String(!active));
  });

  if (stepName === "question" || stepName === "success") {
    footer.hidden = true;
    progressFill.style.width = stepName === "success" ? "100%" : "0";
    return;
  }

  const index = activeSteps.indexOf(stepName);
  if (index < 0) return;
  selectedStepIndex = index;
  footer.hidden = false;
  document.getElementById("eyebrow").textContent = guided ? "Your guided setup" : "Quick setup";
  document.getElementById("pageTitle").textContent = "Build your YouTube profile";
  document.getElementById("pageLead").textContent = guided
    ? "Choose what works for you. Each setting is explained as you go."
    : "Choose the settings you want. You can fine-tune them later in the extension popup.";
  guideNotes.forEach((note) => { note.hidden = !guided; });
  stepCount.textContent = `Step ${index + 1} of ${activeSteps.length}`;
  backBtn.disabled = saving;
  nextBtn.disabled = saving;
  nextBtn.textContent = stepName === "profile" ? "Save profile" : "Continue";
  progressFill.style.width = `${((index + 1) / activeSteps.length) * 100}%`;
  document.getElementById("saveError").textContent = "";
  if (stepName === "profile") renderSummary();
}

function startSetup(isGuided) {
  guided = isGuided;
  activeSteps = guided ? setupSteps : setupSteps.slice(1);
  document.getElementById("eyebrow").textContent = guided ? "Your guided setup" : "Quick setup";
  document.getElementById("pageTitle").textContent = "Build your YouTube profile";
  document.getElementById("pageLead").textContent = guided
    ? "Choose what works for you. Each setting is explained as you go."
    : "Choose the settings you want. You can fine-tune them later in the extension popup.";
  showStep(guided ? setupSteps[0] : "topics");
}

function readFormSettings() {
  const blockedCategories = Array.from(document.querySelectorAll("[data-category]:checked"))
    .map((input) => input.dataset.category);
  const customKeywords = document.getElementById("keywords").value
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter((keyword, index, list) => keyword && list.indexOf(keyword) === index);

  return {
    enabled: true,
    blockedCategories,
    customKeywords,
    videoSize: document.getElementById("videoSize").value,
    pipEnabled: document.getElementById("pipEnabled").checked,
    hideShorts: document.getElementById("hideShorts").checked,
    hideWatched: document.getElementById("hideWatched").checked,
    hideRussian: document.getElementById("hideRussian").checked,
    hideEnglish: document.getElementById("hideEnglish").checked,
    blockAds: document.getElementById("blockAds").checked,
    blockAdsVideo: document.getElementById("blockAdsVideo").checked,
    blockAdsBanners: document.getElementById("blockAdsBanners").checked,
    blockAdsPopups: document.getElementById("blockAdsPopups").checked,
    blockAdsNetwork: document.getElementById("blockAdsNetwork").checked,
    optimize: document.getElementById("optimize").checked,
    optimizeAnimations: document.getElementById("optimizeAnimations").checked,
    optimizeVideos: document.getElementById("optimizeVideos").checked,
    optimizeEffects: document.getElementById("optimizeEffects").checked,
    optimizeScan: document.getElementById("optimizeScan").checked,
    optimizeDom: document.getElementById("optimizeDom").checked
  };
}

function renderSummary() {
  const settings = readFormSettings();
  const categories = settings.blockedCategories.length
    ? settings.blockedCategories.map((category) => category[0].toUpperCase() + category.slice(1)).join(", ")
    : "None";
  const languages = [
    settings.hideRussian ? "Russian" : "",
    settings.hideEnglish ? "English" : ""
  ].filter(Boolean).join(", ") || "None";
  const keywords = settings.customKeywords.length
    ? settings.customKeywords.join(", ")
    : "None";
  const sizeLabels = {
    default: "Default",
    small: "Small",
    medium: "Medium",
    large: "Large",
    cinema: "Cinema"
  };

  document.getElementById("summary").innerHTML =
    `<strong>Topics to hide:</strong> ${escapeHtml(categories)}<br>` +
    `<strong>Languages:</strong> ${escapeHtml(languages)}<br>` +
    `<strong>Custom words:</strong> ${escapeHtml(keywords)}<br>` +
    `<strong>Shorts:</strong> ${settings.hideShorts ? "Hidden" : "Shown"} · ` +
    `<strong>Watched videos:</strong> ${settings.hideWatched ? "Hidden" : "Shown"}<br>` +
    `<strong>Layout:</strong> ${escapeHtml(sizeLabels[settings.videoSize])} · ` +
    `<strong>Ad filtering:</strong> ${settings.blockAds ? "On" : "Off"} · ` +
    `<strong>Performance mode:</strong> ${settings.optimize ? "On" : "Off"}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function makeProfileId() {
  return `p_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function makeThemeId() {
  return `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function normalizeSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const settings = { ...DEFAULT_SETTINGS };
  Object.keys(DEFAULT_SETTINGS).forEach((key) => {
    if (value[key] !== undefined) settings[key] = value[key];
  });
  if (!Array.isArray(settings.blockedCategories)) settings.blockedCategories = [];
  if (!Array.isArray(settings.customKeywords)) settings.customKeywords = [];
  return settings;
}

function importConfigFile(file) {
  const errorEl = document.getElementById("importError");
  errorEl.textContent = "";
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data || data._type !== "youtube-feed-filter-settings") {
        throw new Error("This is not a YouTube Feed Filter configuration file.");
      }

      const importedProfiles = Array.isArray(data.profiles)
        ? data.profiles.filter((profile) => profile && typeof profile === "object")
        : [];
      const importedSettings = normalizeSettings(data.settings);
      if (!importedSettings && !importedProfiles.length) {
        throw new Error("The configuration file does not contain settings or profiles.");
      }

      chrome.storage.sync.get(["profiles"], (stored) => {
        if (chrome.runtime.lastError) {
          errorEl.textContent = `Could not read existing profiles: ${chrome.runtime.lastError.message}`;
          return;
        }

        chrome.storage.local.get(["themes"], (local) => {
          if (chrome.runtime.lastError) {
            errorEl.textContent = `Could not read existing themes: ${chrome.runtime.lastError.message}`;
            return;
          }

          const profiles = Array.isArray(stored.profiles) ? stored.profiles.slice() : [];
          const themes = Array.isArray(local.themes)
            ? local.themes.filter((theme) => theme && theme.id !== "default")
            : [];
          const themeIds = new Map();
          const importedThemes = Array.isArray(data.themes) ? data.themes : [];

          importedThemes.forEach((theme) => {
            if (!theme || typeof theme !== "object" || theme.id === "default") return;
            const id = makeThemeId();
            if (theme.id) themeIds.set(theme.id, id);
            themes.push({
              id,
              name: String(theme.name || "Imported theme"),
              url: typeof theme.url === "string" ? theme.url : "",
              fileName: typeof theme.fileName === "string" ? theme.fileName : "",
              source: typeof theme.source === "string" ? theme.source : "none",
              dim: !!theme.dim,
              blur: !!theme.blur
            });
          });

          function settingsWithTheme(settings) {
            const normalized = normalizeSettings(settings) || { ...DEFAULT_SETTINGS };
            normalized.activeThemeId = themeIds.get(normalized.activeThemeId) || "default";
            return normalized;
          }

          let activeImportedId = null;
          let firstImportedId = null;
          importedProfiles.forEach((source) => {
            const sourceSettings = settingsWithTheme(source.settings);
            let name = String(source.name || "Imported");
            const baseName = name;
            let suffix = 2;
            while (profiles.some((profile) =>
              String(profile && profile.name || "").toLowerCase() === name.toLowerCase()
            )) {
              name = `${baseName} (${suffix})`;
              suffix += 1;
            }
            const id = makeProfileId();
            profiles.push({
              id,
              name,
              icon: String(source.icon || "⭐").replace(/[<>&]/g, "").slice(0, 8) || "⭐",
              settings: sourceSettings
            });
            if (!firstImportedId) firstImportedId = id;
            if (source.id === data.activeProfileId) activeImportedId = id;
          });

          if (!activeImportedId) activeImportedId = firstImportedId;
          let settings = importedSettings
            ? settingsWithTheme(importedSettings)
            : null;
          if (activeImportedId) {
            const activeProfile = profiles.find((profile) => profile.id === activeImportedId);
            if (settings) activeProfile.settings = settings;
            else settings = activeProfile.settings;
          } else if (!settings && profiles.length) {
            activeImportedId = profiles[profiles.length - 1].id;
            settings = profiles[profiles.length - 1].settings;
          }

          if (!importedProfiles.length && settings) {
            const id = makeProfileId();
            const name = "Imported config";
            profiles.push({ id, name, icon: "⭐", settings });
            activeImportedId = id;
          }

          chrome.storage.local.set({ themes }, () => {
            if (chrome.runtime.lastError) {
              errorEl.textContent = `Could not save imported themes: ${chrome.runtime.lastError.message}`;
              return;
            }
            chrome.storage.sync.set({
              settings,
              profiles,
              activeProfileId: activeImportedId
            }, () => {
              if (chrome.runtime.lastError) {
                errorEl.textContent = `Could not save the configuration: ${chrome.runtime.lastError.message}`;
                return;
              }

              chrome.runtime.sendMessage({
                type: "applyAdBlock",
                enabled: settings.blockAds && settings.blockAdsNetwork
              }, () => {
                if (chrome.runtime.lastError) {
                  console.warn("Could not update ad-filter rules:", chrome.runtime.lastError.message);
                }
              });
              document.getElementById("successMessage").textContent =
                "Your configuration has been imported and activated. Existing profiles were kept.";
              document.getElementById("eyebrow").textContent = "Setup complete";
              document.getElementById("pageTitle").textContent = "Configuration imported";
              document.getElementById("pageLead").textContent = "Your YouTube Feed Filter setup is ready.";
              showStep("success");
            });
          });
        });
      });
    } catch (error) {
      errorEl.textContent = error instanceof Error ? error.message : "Could not read this configuration file.";
    }
  };
  reader.onerror = () => {
    errorEl.textContent = "The selected file could not be read.";
  };
  reader.readAsText(file);
}

function saveProfile() {
  if (saving) return;
  const name = document.getElementById("profileName").value.trim();
  const error = document.getElementById("saveError");
  if (!name) {
    error.textContent = "Please enter a profile name.";
    document.getElementById("profileName").focus();
    return;
  }

  saving = true;
  nextBtn.disabled = true;
  backBtn.disabled = true;
  error.textContent = "";

  chrome.storage.sync.get(["settings", "profiles"], (stored) => {
    if (chrome.runtime.lastError) {
      showSaveError(chrome.runtime.lastError.message);
      return;
    }

    const currentSettings = { ...DEFAULT_SETTINGS, ...(stored.settings || {}) };
    const profileSettings = { ...currentSettings, ...readFormSettings() };
    const profiles = Array.isArray(stored.profiles) ? stored.profiles.slice() : [];
    let uniqueName = name;
    let suffix = 2;
    while (profiles.some((profile) =>
      String(profile && profile.name || "").toLowerCase() === uniqueName.toLowerCase()
    )) {
      uniqueName = `${name} (${suffix})`;
      suffix += 1;
    }

    const profile = {
      id: makeProfileId(),
      name: uniqueName,
      icon: "⭐",
      settings: profileSettings
    };
    profiles.push(profile);

    chrome.storage.sync.set({
      settings: profileSettings,
      profiles,
      activeProfileId: profile.id
    }, () => {
      if (chrome.runtime.lastError) {
        showSaveError(chrome.runtime.lastError.message);
        return;
      }

      chrome.runtime.sendMessage({
        type: "applyAdBlock",
        enabled: profileSettings.blockAds && profileSettings.blockAdsNetwork
      }, () => {
        if (chrome.runtime.lastError) {
          console.warn("Could not update ad-filter rules:", chrome.runtime.lastError.message);
        }
      });

      saving = false;
      document.getElementById("successMessage").textContent =
        `“${uniqueName}” is now your active profile. Your previous profiles are still available in the extension popup.`;
      document.getElementById("eyebrow").textContent = "Setup complete";
      document.getElementById("pageTitle").textContent = "You’re ready to go";
      document.getElementById("pageLead").textContent = "Your YouTube experience is set up just the way you like it.";
      showStep("success");
    });
  });
}

function showSaveError(message) {
  saving = false;
  nextBtn.disabled = false;
  backBtn.disabled = false;
  document.getElementById("saveError").textContent =
    `We couldn’t save your profile: ${message}. Please try again.`;
}

document.getElementById("newUser").addEventListener("click", () => startSetup(true));
document.getElementById("returningUser").addEventListener("click", () => {
  guided = false;
  activeSteps = [];
  document.getElementById("eyebrow").textContent = "Quick setup";
  document.getElementById("pageTitle").textContent = "Choose your setup";
  document.getElementById("pageLead").textContent = "Load a ready-made config or build a new one from scratch.";
  showStep("experienced");
});
document.getElementById("buildConfig").addEventListener("click", () => startSetup(false));
document.getElementById("uploadConfig").addEventListener("click", () => {
  document.getElementById("configFile").click();
});
document.getElementById("configFile").addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  event.target.value = "";
  if (file) importConfigFile(file);
});

backBtn.addEventListener("click", () => {
  if (saving || selectedStepIndex <= 0) return;
  showStep(activeSteps[selectedStepIndex - 1]);
});

nextBtn.addEventListener("click", () => {
  if (currentStep === "profile") {
    saveProfile();
    return;
  }
  if (selectedStepIndex < activeSteps.length - 1) {
    showStep(activeSteps[selectedStepIndex + 1]);
  }
});

document.getElementById("keywords").addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    showStep("feed");
  }
});

document.getElementById("openYoutube").addEventListener("click", () => {
  chrome.tabs.create({ url: "https://www.youtube.com/" });
});

document.getElementById("blockAds").addEventListener("change", (event) => {
  document.querySelectorAll(".sub-options input").forEach((input) => {
    if (input.id.startsWith("blockAds")) input.disabled = !event.target.checked;
  });
});

document.getElementById("optimize").addEventListener("change", (event) => {
  document.querySelectorAll(".sub-options input").forEach((input) => {
    if (input.id.startsWith("optimize")) input.disabled = !event.target.checked;
  });
});

document.getElementById("blockAds").dispatchEvent(new Event("change"));
document.getElementById("optimize").dispatchEvent(new Event("change"));
showStep("question");
