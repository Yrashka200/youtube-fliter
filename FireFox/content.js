const CATEGORY_KEYWORDS = {
  games:     ["game", "gaming", "gameplay", "let's play", "стрим", "игр", "геймплей", "прохождение", "steam", "ps5", "xbox", "minecraft", "fortnite", "gta", "dota", "cs2", "valorant"],
  sports:    ["sport", "football", "soccer", "basketball", "nba", "nfl", "ufc", "boxing", "спорт", "футбол", "хоккей", "бокс", "мма", "олимпиад"],
  politics:  ["politic", "election", "government", "president", "parliament", "политик", "выборы", "правительств", "президент", "дума", "митинг", "война"],
  music: [
    "music", "song", "album", "official video", "lyrics", "feat.",
    "музык", "песн", "клип", "альбом", "концерт",
    "nightcore", "slowed", "phonk", "remix", "mix", "instrumental",
    "cover", "pop", "rock", "hip-hop", "rap", "edm", "lofi",
    "beat", "trap", "bass", "chill", "aesthetic", "sped up"
  ],
  news:      ["news", "breaking", "новост", "срочно", "репортаж"],
  movies:    ["movie", "trailer", "film", "cinema", "кино", "фильм", "трейлер", "сериал", "netflix"],
  tech:      ["review", "unboxing", "iphone", "android", "обзор", "распаковка", "технолог"],
  crypto:    ["crypto", "bitcoin", "blockchain", "nft", "крипт", "биткоин"],
  kids:      ["kids", "cartoon", "children", "мультик", "для детей"],
  shorts:    ["#shorts", "shorts"]
};

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

let settings = { ...DEFAULT_SETTINGS };
let settingsReady = false;
let activeTheme = null;
let focusState = { active: false, endsAt: 0, profileId: null };
let fakePremiumLogoElement = null;
let fakePremiumLogoDisplay = null;
let fakePremiumBadge = null;
let fakePremiumShadowStyle = null;
let fakePremiumFavicon = null;

const PROCESSED_ATTR = "data-yt-filter-processed";
const HIDDEN_ATTR = "data-yt-filter-hidden";
const AD_HIDDEN_ATTR = "data-yt-ad-hidden";
const VIRTUAL_ATTR = "data-yt-virtual";
const PLACEHOLDER_ATTR = "data-yt-placeholder";
const FOCUS_BANNER_ID = "yt-filter-focus-banner";

const VIRTUAL_BUFFER_BOTTOM = 4;
const VIRTUAL_BUFFER_TOP = 1;
const VIRTUAL_BATCH_LIMIT = 30;

const ITEM_SELECTOR = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-rich-grid-media",
  "ytd-compact-video-renderer",
  "ytd-compact-playlist-renderer",
  "ytd-compact-radio-renderer",
  "ytd-playlist-panel-video-renderer",
  "yt-lockup-view-model",
  "ytm-shorts-lockup-view-model",
  "ytd-reel-item-renderer"
].join(", ");

const GRID_CONTAINER_SELECTOR = [
  "ytd-rich-grid-renderer #contents",
  "ytd-rich-grid-renderer",
  "ytd-grid-renderer #items",
  "ytd-item-section-renderer #contents"
].join(", ");

const PAGE_START_TIME = Date.now();
const WARMUP_MS = 2000;
const VIRTUALIZATION_DELAY_MS = 3000;
const PIP_VIDEO_SELECTOR = ".html5-video-player video, video.html5-main-video";
const PIP_BUTTON_ATTR = "data-yt-filter-pip";

let pictureInPictureObserver = null;
let pictureInPictureSyncPending = false;
const pictureInPictureVideos = new WeakSet();

function isPictureInPictureSupported(video) {
  return document.pictureInPictureEnabled &&
    typeof video.requestPictureInPicture === "function" &&
    !video.disablePictureInPicture;
}

function updatePictureInPictureButtons() {
  document.querySelectorAll(`[${PIP_BUTTON_ATTR}]`).forEach(button => {
    const player = button.closest(".html5-video-player");
    const video = player?.querySelector("video.html5-main-video, video");
    if (!video) return;

    const active = document.pictureInPictureElement === video;
    button.setAttribute("aria-pressed", String(active));
    button.title = active ? "Exit Picture-in-Picture" : "Picture-in-Picture";
  });
}

function togglePictureInPicture(button) {
  if (settings.pipEnabled === false) return;

  const player = button.closest(".html5-video-player");
  const video = player?.querySelector("video.html5-main-video, video");
  if (!video || !isPictureInPictureSupported(video)) {
    button.title = "Picture-in-Picture is not supported by this browser";
    return;
  }

  try {
    const operation = document.pictureInPictureElement === video
      ? document.exitPictureInPicture()
      : video.requestPictureInPicture();
    Promise.resolve(operation).catch(error => {
      button.title = `Picture-in-Picture failed: ${error.message}`;
      console.warn("Could not toggle YouTube Picture-in-Picture:", error);
    });
  } catch (error) {
    button.title = `Picture-in-Picture failed: ${error.message}`;
    console.warn("Could not toggle YouTube Picture-in-Picture:", error);
  }
}

function ensurePictureInPictureButton(player) {
  const existingButton = player.querySelector(`[${PIP_BUTTON_ATTR}]`);
  if (settings.pipEnabled === false) {
    existingButton?.remove();
    return;
  }

  const controls = player.querySelector(".ytp-right-controls");
  if (!controls) return;
  if (player.querySelector(".ytp-pip-button")) {
    existingButton?.remove();
    return;
  }
  if (existingButton) return;

  const video = player.querySelector("video.html5-main-video, video");
  if (!video) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ytp-button yt-filter-pip-button";
  button.setAttribute(PIP_BUTTON_ATTR, "");
  button.setAttribute("aria-label", "Picture-in-Picture");
  button.setAttribute("aria-pressed", "false");
  button.title = "Picture-in-Picture";
  button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg>';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    togglePictureInPicture(button);
  });
  button.addEventListener("mousedown", event => event.stopPropagation());

  const settingsButton = controls.querySelector(".ytp-settings-button");
  controls.insertBefore(button, settingsButton || controls.firstChild);
  updatePictureInPictureButtons();
}

function syncPictureInPicture() {
  const enabled = settings.pipEnabled !== false;
  const root = document.documentElement;
  if (root) {
    if (enabled) root.removeAttribute("data-yt-pip-disabled");
    else root.setAttribute("data-yt-pip-disabled", "1");
  }

  document.querySelectorAll(PIP_VIDEO_SELECTOR).forEach(video => {
    if (enabled) {
      video.removeAttribute("disablepictureinpicture");
      video.disablePictureInPicture = false;
    }

    if (!pictureInPictureVideos.has(video)) {
      pictureInPictureVideos.add(video);
      video.addEventListener("enterpictureinpicture", updatePictureInPictureButtons);
      video.addEventListener("leavepictureinpicture", updatePictureInPictureButtons);
    }
  });

  document.querySelectorAll(".html5-video-player").forEach(ensurePictureInPictureButton);
}

function schedulePictureInPictureSync() {
  if (pictureInPictureSyncPending) return;
  pictureInPictureSyncPending = true;
  requestAnimationFrame(() => {
    pictureInPictureSyncPending = false;
    syncPictureInPicture();
  });
}

function containsPictureInPicturePlayer(node) {
  if (!(node instanceof Element)) return false;
  return node.matches(`${PIP_VIDEO_SELECTOR}, .html5-video-player, .ytp-right-controls, .ytp-pip-button`) ||
    !!node.querySelector(`${PIP_VIDEO_SELECTOR}, .html5-video-player, .ytp-right-controls, .ytp-pip-button`);
}

function startPictureInPictureObserver() {
  if (pictureInPictureObserver) return;
  const target = document.documentElement;
  if (!target) {
    document.addEventListener("DOMContentLoaded", startPictureInPictureObserver, { once: true });
    return;
  }

  syncPictureInPicture();
  pictureInPictureObserver = new MutationObserver(mutations => {
    if (mutations.some(mutation =>
      mutation.type === "attributes" ||
      Array.from(mutation.addedNodes).some(containsPictureInPicturePlayer) ||
      Array.from(mutation.removedNodes).some(containsPictureInPicturePlayer)
    )) {
      schedulePictureInPictureSync();
    }
  });

  try {
    pictureInPictureObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disablepictureinpicture"]
    });
  } catch (error) {
    pictureInPictureObserver = null;
    console.warn("Could not observe YouTube Picture-in-Picture players:", error);
  }
}

startPictureInPictureObserver();
window.addEventListener("yt-navigate-finish", syncPictureInPicture);
window.addEventListener("yt-page-data-updated", syncPictureInPicture);

function inWarmup() {
  return Date.now() - PAGE_START_TIME < WARMUP_MS;
}

function detectLanguage(text) {
  if (!text) return "unknown";
  const cyrillic = (text.match(/[а-яё]/gi) || []).length;
  const latin = (text.match(/[a-z]/gi) || []).length;
  const total = cyrillic + latin;
  if (total === 0) return "unknown";
  const cyrRatio = cyrillic / total;
  if (cyrRatio > 0.7) return "ru";
  if (cyrRatio < 0.2) return "en";
  const lower = " " + text.toLowerCase() + " ";
  const ruMarkers = [" и ", " в ", " на ", " с ", " как ", " это ", " что ", " не ", " для ", " по ", " из ", "или", "но "];
  const enMarkers = [" the ", " and ", " of ", " to ", " in ", " is ", " for ", " you ", " that ", " with ", " this ", " on "];
  let ruScore = ruMarkers.filter(w => lower.includes(w)).length;
  let enScore = enMarkers.filter(w => lower.includes(w)).length;
  if (ruScore > enScore) return "ru";
  if (enScore > ruScore) return "en";
  return "unknown";
}

function isMiniplayerFrame() {
  try {
    const href = window.location.href || "";
    if (href.includes("/embed/")) return true;
    if (href.includes("/miniplayer")) return true;
  } catch (e) {}
  return false;
}

function inMiniplayer() {
  if (isMiniplayerFrame()) return true;
  const mini = document.querySelector("ytd-miniplayer[active]") ||
               document.querySelector("ytd-miniplayer.active") ||
               document.querySelector("#miniplayer");
  if (mini) {
    const style = window.getComputedStyle(mini);
    if (style.display !== "none" && style.visibility !== "hidden") return true;
  }
  return false;
}

function applyEarlyAttributes() {
  const root = document.documentElement;
  if (!root) return;
  if (isMiniplayerFrame()) {
    if (settings.enabled && settings.blockAds !== false) {
      root.setAttribute("data-yt-block-ads", "1");
      if (settings.blockAdsVideo !== false) root.setAttribute("data-yt-block-video", "1");
    }
    return;
  }
  if (settings.videoSize && settings.videoSize !== "default") {
    root.setAttribute("data-yt-size", settings.videoSize);
  }
  if (settings.blockAds !== false) {
    root.setAttribute("data-yt-block-ads", "1");
    if (settings.blockAdsVideo !== false) root.setAttribute("data-yt-block-video", "1");
    if (settings.blockAdsBanners !== false) root.setAttribute("data-yt-block-banners", "1");
    if (settings.blockAdsPopups !== false) root.setAttribute("data-yt-block-popups", "1");
    if (settings.blockAdsNetwork !== false) root.setAttribute("data-yt-block-network", "1");
  }
  if (settings.optimize && !inMiniplayer()) {
    root.setAttribute("data-yt-optimize", "1");
    if (settings.optimizeAnimations !== false) root.setAttribute("data-yt-opt-anim", "1");
    if (settings.optimizeVideos !== false) root.setAttribute("data-yt-opt-video", "1");
    if (settings.optimizeEffects !== false) root.setAttribute("data-yt-opt-fx", "1");
  }
}

if (!isMiniplayerFrame()) {
  applyEarlyAttributes();
}

async function loadSettings() {
  try {
    const res = await browser.storage.sync.get(["settings"]);
    if (res.settings) settings = { ...DEFAULT_SETTINGS, ...res.settings };
  } catch (e) {}

  syncPictureInPicture();
  if (isMiniplayerFrame()) {
    applyAdBlockAttr();
    return;
  }

  try {
    const r = await browser.storage.local.get(["themes"]);
    const list = Array.isArray(r.themes) ? r.themes : [];
    activeTheme = list.find(t => t.id === settings.activeThemeId) || null;
  } catch (e) {
    activeTheme = null;
  }

  try {
    const r = await browser.storage.local.get(["focusState"]);
    focusState = r.focusState && r.focusState.active ? r.focusState : { active: false, endsAt: 0, profileId: null };
  } catch (e) {
    focusState = { active: false, endsAt: 0, profileId: null };
  }

  settingsReady = true;
  applyAll();
  renderFocusBanner();
}

loadSettings();

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    settings = { ...DEFAULT_SETTINGS, ...changes.settings.newValue };
    syncPictureInPicture();
    if (isMiniplayerFrame()) {
      applyAdBlockAttr();
      return;
    }
    browser.storage.local.get(["themes"], (r) => {
      const list = Array.isArray(r.themes) ? r.themes : [];
      activeTheme = list.find(t => t.id === settings.activeThemeId) || null;
      settingsReady = true;
      applyAll();
    });
    return;
  }

  if (isMiniplayerFrame()) return;

  if (area === "local" && changes.themes) {
    const list = Array.isArray(changes.themes.newValue) ? changes.themes.newValue : [];
    activeTheme = list.find(t => t.id === settings.activeThemeId) || null;
    applyTheme();
  }

  if (area === "local" && changes.focusState) {
    const fs = changes.focusState.newValue;
    focusState = fs && fs.active ? fs : { active: false, endsAt: 0, profileId: null };
    renderFocusBanner();
  }
});

function applyAll() {
  if (isMiniplayerFrame()) return;
  if (!document.documentElement) return;

  if (!settings.enabled) {
    applyFakePremiumLogo();
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach(el => {
      el.style.display = "";
      el.removeAttribute(HIDDEN_ATTR);
    });
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => {
      el.removeAttribute(PROCESSED_ATTR);
    });
    restoreAllVirtual();
    document.querySelectorAll(`[${AD_HIDDEN_ATTR}]`).forEach(el => {
      el.style.display = "";
      el.removeAttribute(AD_HIDDEN_ATTR);
    });
    const root = document.documentElement;
    root.removeAttribute("data-yt-size");
    root.removeAttribute("data-yt-block-ads");
    root.removeAttribute("data-yt-block-video");
    root.removeAttribute("data-yt-block-banners");
    root.removeAttribute("data-yt-block-popups");
    root.removeAttribute("data-yt-block-network");
    root.removeAttribute("data-yt-optimize");
    root.removeAttribute("data-yt-opt-anim");
    root.removeAttribute("data-yt-opt-video");
    root.removeAttribute("data-yt-opt-fx");
    root.removeAttribute("data-yt-custom-bg");
    root.removeAttribute("data-yt-bg-dim");
    root.removeAttribute("data-yt-bg-blur");
    root.style.removeProperty("--yt-custom-bg-url");
    return;
  }

  applySize();
  applyFakePremiumLogo();
  applyTheme();
  applyAdBlockAttr();
  applyOptimization();

  if (!settings.blockAds) {
    document.querySelectorAll(`[${AD_HIDDEN_ATTR}]`).forEach(el => {
      el.style.display = "";
      el.removeAttribute(AD_HIDDEN_ATTR);
    });
  }

  resetProcessed();
  scanAndFilter();
}

function applySize() {
  const root = document.documentElement;
  if (!root) return;
  if (settings.videoSize === "default") {
    root.removeAttribute("data-yt-size");
  } else {
    root.setAttribute("data-yt-size", settings.videoSize);
  }
}

function applyFakePremiumLogo() {
  const root = document.documentElement;
  if (!root) return;

  if (!settings.enabled || !settings.fakePremium) {
    root.removeAttribute("data-yt-fake-premium");
    fakePremiumBadge?.remove();
    fakePremiumShadowStyle?.remove();
    fakePremiumFavicon?.remove();
    if (fakePremiumLogoElement && fakePremiumLogoDisplay) {
      const { value, priority } = fakePremiumLogoDisplay;
      if (value) fakePremiumLogoElement.style.setProperty("display", value, priority);
      else fakePremiumLogoElement.style.removeProperty("display");
    }
    fakePremiumLogoElement = null;
    fakePremiumLogoDisplay = null;
    fakePremiumBadge = null;
    fakePremiumShadowStyle = null;
    fakePremiumFavicon = null;
    return;
  }

  root.setAttribute("data-yt-fake-premium", "1");

  const faviconId = "yt-filter-premium-favicon";
  fakePremiumFavicon = document.getElementById(faviconId);
  if (!fakePremiumFavicon && document.head) {
    fakePremiumFavicon = document.createElement("link");
    fakePremiumFavicon.id = faviconId;
    fakePremiumFavicon.rel = "icon";
    fakePremiumFavicon.type = "image/svg+xml";
    fakePremiumFavicon.href = `data:image/svg+xml,${encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="9" width="60" height="46" rx="13" fill="#ff0033"/><path d="M27 19v26l21-13z" fill="#fff"/></svg>'
    )}`;
    document.head.appendChild(fakePremiumFavicon);
  }

  if (fakePremiumBadge?.isConnected) return;

  const topbarLogo = document.querySelector("ytd-topbar-logo");
  const shadowRoot = topbarLogo?.shadowRoot;
  const originalLogo = shadowRoot?.querySelector("#logo") ||
    document.querySelector("ytd-masthead #logo, #masthead #logo, #logo");
  if (!originalLogo?.parentElement) return;

  if (fakePremiumLogoElement !== originalLogo) {
    fakePremiumLogoElement = originalLogo;
    fakePremiumLogoDisplay = {
      value: originalLogo.style.getPropertyValue("display"),
      priority: originalLogo.style.getPropertyPriority("display")
    };
  }
  originalLogo.style.setProperty("display", "none", "important");

  if (shadowRoot) {
    fakePremiumShadowStyle = document.createElement("style");
    fakePremiumShadowStyle.textContent = `
      .yt-filter-premium-badge {
        display: inline-flex; align-items: center; gap: 5px; padding: 6px 0;
        color: var(--yt-spec-text-primary, #fff); font: 700 24px/1 Arial, sans-serif;
        white-space: nowrap; letter-spacing: -.055em;
      }
      .yt-filter-premium-icon {
        display: inline-flex; align-items: center; justify-content: center;
        width: 38px; height: 27px; flex: 0 0 38px; border-radius: 7px;
        background: #ff0033; color: #fff; font: 900 19px/1 Arial, sans-serif;
      }`;
    shadowRoot.appendChild(fakePremiumShadowStyle);
  }

  fakePremiumBadge = document.createElement("span");
  fakePremiumBadge.className = "yt-filter-premium-badge";
  fakePremiumBadge.setAttribute("aria-hidden", "true");
  const icon = document.createElement("span");
  icon.className = "yt-filter-premium-icon";
  icon.textContent = "▶";
  const text = document.createElement("span");
  text.className = "yt-filter-premium-text";
  text.textContent = "Premium";
  fakePremiumBadge.append(icon, text);
  originalLogo.parentElement.appendChild(fakePremiumBadge);
}

function applyTheme() {
  const root = document.documentElement;
  if (!root) return;

  const url = activeTheme && activeTheme.url ? activeTheme.url.trim() : "";
  const on = !!url;

  if (!on) {
    root.removeAttribute("data-yt-custom-bg");
    root.removeAttribute("data-yt-bg-dim");
    root.removeAttribute("data-yt-bg-blur");
    root.style.removeProperty("--yt-custom-bg-url");
    return;
  }

  const safeUrl = url.replace(/"/g, "%22");
  root.style.setProperty("--yt-custom-bg-url", `url("${safeUrl}")`);
  root.setAttribute("data-yt-custom-bg", "1");

  if (activeTheme.dim) root.setAttribute("data-yt-bg-dim", "1");
  else root.removeAttribute("data-yt-bg-dim");

  if (activeTheme.blur) root.setAttribute("data-yt-bg-blur", "1");
  else root.removeAttribute("data-yt-bg-blur");
}

function applyAdBlockAttr() {
  const root = document.documentElement;
  if (!root) return;
  const anyOn = settings.enabled !== false && settings.blockAds !== false;
  const videoOn = anyOn && settings.blockAdsVideo !== false;
  const bannersOn = anyOn && settings.blockAdsBanners !== false;
  const popupsOn = anyOn && settings.blockAdsPopups !== false;
  const networkOn = anyOn && settings.blockAdsNetwork !== false;

  if (anyOn) root.setAttribute("data-yt-block-ads", "1");
  else root.removeAttribute("data-yt-block-ads");

  if (videoOn) root.setAttribute("data-yt-block-video", "1");
  else root.removeAttribute("data-yt-block-video");

  if (bannersOn) root.setAttribute("data-yt-block-banners", "1");
  else root.removeAttribute("data-yt-block-banners");

  if (popupsOn) root.setAttribute("data-yt-block-popups", "1");
  else root.removeAttribute("data-yt-block-popups");

  if (networkOn) root.setAttribute("data-yt-block-network", "1");
  else root.removeAttribute("data-yt-block-network");
}

function applyOptimization() {
  const root = document.documentElement;
  if (!root) return;

  if (inMiniplayer()) {
    root.removeAttribute("data-yt-optimize");
    root.removeAttribute("data-yt-opt-anim");
    root.removeAttribute("data-yt-opt-video");
    root.removeAttribute("data-yt-opt-fx");
    return;
  }

  if (!settings.optimize) {
    root.removeAttribute("data-yt-optimize");
    root.removeAttribute("data-yt-opt-anim");
    root.removeAttribute("data-yt-opt-video");
    root.removeAttribute("data-yt-opt-fx");
    stopVirtualization();
    return;
  }

  root.setAttribute("data-yt-optimize", "1");

  if (settings.optimizeAnimations) root.setAttribute("data-yt-opt-anim", "1");
  else root.removeAttribute("data-yt-opt-anim");

  if (settings.optimizeVideos) {
    root.setAttribute("data-yt-opt-video", "1");
    stopPreviewVideos();
  } else {
    root.removeAttribute("data-yt-opt-video");
  }

  if (settings.optimizeEffects) root.setAttribute("data-yt-opt-fx", "1");
  else root.removeAttribute("data-yt-opt-fx");

  if (settings.optimizeDom) scheduleVirtualizationStart();
  else stopVirtualization();
}

function stopPreviewVideos() {
  if (!settings.optimize || !settings.optimizeVideos) return;
  if (isMiniplayerFrame()) return;
  try {
    document.querySelectorAll("video").forEach(v => {
      if (v.closest("#movie_player")) return;
      if (v.closest("ytd-miniplayer")) return;
      try {
        if (!v.paused) v.pause();
        v.removeAttribute("autoplay");
        v.preload = "none";
      } catch (e) {}
    });
    document.querySelectorAll("ytd-thumbnail video, ytd-moving-thumbnail-renderer video").forEach(v => {
      try {
        if (!v.paused) v.pause();
        v.preload = "none";
        v.removeAttribute("autoplay");
      } catch (e) {}
    });
  } catch (e) {}
}

let virtualObserver = null;
let virtualRoots = new WeakSet();
let virtualRootObserver = null;
let virtualRafPending = false;
let virtualizationPaused = false;
let virtualizationStartTimer = null;

function isViewportUsable() {
  if (document.hidden) return false;
  if (document.visibilityState !== "visible") return false;
  if (window.innerWidth === 0 || window.innerHeight === 0) return false;
  return true;
}

function scheduleVirtualizationStart() {
  if (virtualObserver) return;
  if (virtualizationStartTimer) return;
  if (inMiniplayer()) return;

  const wait = Math.max(0, VIRTUALIZATION_DELAY_MS - (Date.now() - PAGE_START_TIME));

  virtualizationStartTimer = setTimeout(() => {
    virtualizationStartTimer = null;
    if (settings.optimize && settings.optimizeDom && !inMiniplayer()) {
      startVirtualization();
    }
  }, wait);
}

function startVirtualization() {
  if (!settings.optimize || !settings.optimizeDom) return;
  if (virtualObserver) return;
  if (!isViewportUsable()) return;
  if (!document.body) return;
  if (inMiniplayer()) return;

  const topPx = VIRTUAL_BUFFER_TOP * window.innerHeight;
  const bottomPx = VIRTUAL_BUFFER_BOTTOM * window.innerHeight;

  virtualObserver = new IntersectionObserver(onVirtualIntersect, {
    root: null,
    rootMargin: `${topPx}px 0px ${bottomPx}px 0px`,
    threshold: 0
  });

  installRootObserver();
  scanVirtualRoots();
}

function stopVirtualization() {
  if (virtualizationStartTimer) {
    clearTimeout(virtualizationStartTimer);
    virtualizationStartTimer = null;
  }
  if (virtualObserver) {
    virtualObserver.disconnect();
    virtualObserver = null;
  }
  if (virtualRootObserver) {
    virtualRootObserver.disconnect();
    virtualRootObserver = null;
  }
  restoreAllVirtual();
}

function installRootObserver() {
  if (virtualRootObserver) return;
  if (!document.body) return;

  virtualRootObserver = new MutationObserver((mutations) => {
    if (!settings.optimize || !settings.optimizeDom) return;
    if (!isViewportUsable()) return;
    if (inWarmup()) return;
    if (inMiniplayer()) return;
    let touched = false;
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches?.(ITEM_SELECTOR) || node.querySelector?.(ITEM_SELECTOR)) {
          touched = true;
          break;
        }
      }
      if (touched) break;
    }
    if (touched && !virtualRafPending) {
      virtualRafPending = true;
      requestAnimationFrame(() => {
        virtualRafPending = false;
        scanVirtualRoots();
      });
    }
  });

  try {
    virtualRootObserver.observe(document.body, { childList: true, subtree: true });
  } catch (e) {
    virtualRootObserver = null;
  }
}

function scanVirtualRoots() {
  if (!settings.optimize || !settings.optimizeDom || !virtualObserver) return;
  if (!isViewportUsable()) return;
  if (inMiniplayer()) return;

  const roots = document.querySelectorAll(GRID_CONTAINER_SELECTOR);
  roots.forEach(root => {
    if (virtualRoots.has(root)) return;
    virtualRoots.add(root);

    root.querySelectorAll(ITEM_SELECTOR).forEach(el => {
      observeVirtual(el);
    });
  });
}

function observeVirtual(el) {
  if (!virtualObserver) return;
  if (!el || !el.isConnected) return;
  if (el.hasAttribute(VIRTUAL_ATTR) || el.hasAttribute(PLACEHOLDER_ATTR)) return;
  try {
    virtualObserver.observe(el);
  } catch (e) {}
}

function onVirtualIntersect(entries) {
  if (!settings.optimize || !settings.optimizeDom) return;
  if (!isViewportUsable()) return;
  if (virtualizationPaused) return;
  if (inMiniplayer()) return;

  const toCollapse = [];
  const toRestore = [];

  for (const entry of entries) {
    const el = entry.target;
    if (!el.isConnected) continue;

    if (entry.isIntersecting) {
      toRestore.push(el);
    } else {
      toCollapse.push(el);
    }
  }

  for (const el of toRestore) restoreVirtual(el);

  if (toCollapse.length > 0) {
    processChunked(toCollapse, collapseVirtual);
  }
}

function processChunked(items, fn) {
  let i = 0;

  function step() {
    if (!isViewportUsable()) return;
    if (inMiniplayer()) return;
    const end = Math.min(i + VIRTUAL_BATCH_LIMIT, items.length);
    for (; i < end; i++) {
      const el = items[i];
      if (el && el.isConnected) fn(el);
    }
    if (i < items.length) {
      if ("requestIdleCallback" in window) {
        requestIdleCallback(step, { timeout: 200 });
      } else {
        setTimeout(step, 16);
      }
    }
  }

  step();
}

function collapseVirtual(el) {
  if (!el || !el.isConnected) return;
  if (el.hasAttribute(PLACEHOLDER_ATTR)) return;
  if (el.hasAttribute(HIDDEN_ATTR)) return;
  if (el.style.display === "none") return;
  if (!isViewportUsable()) return;
  if (inMiniplayer()) return;

  const rect = el.getBoundingClientRect();
  if (rect.height === 0 || rect.width === 0) return;

  const ph = document.createElement("div");
  ph.setAttribute(PLACEHOLDER_ATTR, "1");
  ph.style.width = rect.width + "px";
  ph.style.height = rect.height + "px";
  ph.style.contain = "strict";
  ph.style.contentVisibility = "auto";

  el.setAttribute(VIRTUAL_ATTR, "1");
  el.style.display = "none";

  try {
    el.parentNode.insertBefore(ph, el);
    ph._ytOriginal = el;
    if (virtualObserver) virtualObserver.observe(ph);
  } catch (e) {
    el.removeAttribute(VIRTUAL_ATTR);
    el.style.display = "";
  }
}

function restoreVirtual(el) {
  if (!el) return;

  if (el.hasAttribute(PLACEHOLDER_ATTR)) {
    const original = el._ytOriginal;
    if (original && original.isConnected) {
      original.style.display = "";
      original.removeAttribute(VIRTUAL_ATTR);
      if (virtualObserver) virtualObserver.observe(original);
    }
    if (virtualObserver) virtualObserver.unobserve(el);
    el.remove();
    return;
  }

  if (el.hasAttribute(VIRTUAL_ATTR)) {
    el.style.display = "";
    el.removeAttribute(VIRTUAL_ATTR);
  }
}

function restoreAllVirtual() {
  try {
    document.querySelectorAll(`[${PLACEHOLDER_ATTR}]`).forEach(ph => {
      const original = ph._ytOriginal;
      if (original && original.isConnected) {
        original.style.display = "";
        original.removeAttribute(VIRTUAL_ATTR);
      }
      ph.remove();
    });
    document.querySelectorAll(`[${VIRTUAL_ATTR}]`).forEach(el => {
      el.style.display = "";
      el.removeAttribute(VIRTUAL_ATTR);
    });
  } catch (e) {}
  virtualRoots = new WeakSet();
}

document.addEventListener("visibilitychange", () => {
  if (isMiniplayerFrame()) return;
  if (!settings.optimize || !settings.optimizeDom) return;

  if (document.hidden) {
    virtualizationPaused = true;
    if (virtualObserver) virtualObserver.disconnect();
    restoreAllVirtual();
  } else {
    setTimeout(() => {
      if (isMiniplayerFrame() || inMiniplayer()) return;
      virtualizationPaused = false;
      if (settings.optimize && settings.optimizeDom && !virtualObserver) {
        startVirtualization();
      } else {
        scanVirtualRoots();
      }
    }, 400);
  }
});

window.addEventListener("blur", () => {
  if (isMiniplayerFrame()) return;
  if (!settings.optimize || !settings.optimizeDom) return;
  virtualizationPaused = true;
});

window.addEventListener("focus", () => {
  if (isMiniplayerFrame()) return;
  if (!settings.optimize || !settings.optimizeDom) return;
  setTimeout(() => {
    if (inMiniplayer()) return;
    virtualizationPaused = false;
    scanVirtualRoots();
  }, 300);
});

window.addEventListener("resize", () => {
  if (isMiniplayerFrame()) return;
  if (!settings.optimize || !settings.optimizeDom) return;
  if (!isViewportUsable()) return;
  if (inMiniplayer()) return;
  restoreAllVirtual();
  setTimeout(scanVirtualRoots, 250);
});

function resetProcessed() {
  try {
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => {
      el.removeAttribute(PROCESSED_ATTR);
    });
  } catch (e) {}
}

function getTitle(item) {
  const el =
    item.querySelector("yt-lockup-metadata-view-model h3") ||
    item.querySelector("h3 a") ||
    item.querySelector("h3") ||
    item.querySelector("#video-title") ||
    item.querySelector("a#video-title-link") ||
    item.querySelector("yt-formatted-string#video-title") ||
    item.querySelector("a[title]");
  return el?.textContent?.trim() || el?.getAttribute?.("title") || "";
}

function getChannelText(item) {
  const el =
    item.querySelector("ytd-channel-name #text") ||
    item.querySelector("ytd-channel-name a") ||
    item.querySelector("yt-content-metadata-view-model a") ||
    item.querySelector("#channel-name #text") ||
    item.querySelector("#channel-name a") ||
    item.querySelector("ytd-channel-name") ||
    item.querySelector("#byline a") ||
    item.querySelector("[class*='channel'] a");
  return el?.textContent?.trim() || "";
}

function getDescText(item) {
  const el =
    item.querySelector("#description-text") ||
    item.querySelector("ytd-video-meta-block #metadata-line") ||
    item.querySelector("yt-content-metadata-view-model");
  return el?.textContent?.trim() || "";
}

function shouldHideItem(item) {
  const titleText = getTitle(item);
  const channelText = getChannelText(item);
  const descText = getDescText(item);
  const text = [titleText, channelText, descText].join(" ").toLowerCase();

  const categoryMatch = (cat) => {
    const kws = CATEGORY_KEYWORDS[cat] || [];
    return kws.some(kw => text.includes(kw));
  };

  for (const cat of settings.blockedCategories) {
    if (categoryMatch(cat)) return true;
  }

  if (settings.customKeywords.length) {
    if (settings.customKeywords.some(kw => kw && text.includes(kw.toLowerCase()))) {
      return true;
    }
  }

  const lang = detectLanguage(titleText + " " + channelText);
  if (settings.hideRussian && lang === "ru") return true;
  if (settings.hideEnglish && lang === "en") return true;

  if (settings.hideShorts) {
    const tag = item.tagName.toLowerCase();
    if (tag === "ytd-reel-item-renderer") return true;
    if (tag === "ytm-shorts-lockup-view-model") return true;
    if (tag === "ytd-rich-item-renderer" &&
        item.querySelector("ytm-shorts-lockup-view-model, a[href*='/shorts/']")) {
      return true;
    }
    if (text.includes("#shorts")) return true;
  }

  if (settings.hideWatched) {
    const progress = item.querySelector("#progress") ||
                     item.querySelector("ytd-thumbnail-overlay-resume-playback-renderer #progress");
    if (progress && parseFloat(progress.style.width || "0") > 90) {
      return true;
    }
  }

  if (settings.blockedCategories.includes("music")) {
    const badge = item.querySelector("ytd-badge-supported-renderer, .badge-shape-wiz__text");
    if (badge && /mix/i.test(badge.textContent)) {
      return true;
    }
  }

  return false;
}

function processItem(item) {
  if (!item || !item.isConnected) return;
  if (item.hasAttribute(PROCESSED_ATTR)) return;
  item.setAttribute(PROCESSED_ATTR, "1");

  if (shouldHideItem(item)) {
    item.style.display = "none";
    item.setAttribute(HIDDEN_ATTR, "1");
  } else if (item.hasAttribute(HIDDEN_ATTR)) {
    item.style.display = "";
    item.removeAttribute(HIDDEN_ATTR);
  }

  if (settings.optimize && settings.optimizeDom && virtualObserver && !inMiniplayer()) {
    observeVirtual(item);
  }
}

function findCardFromLink(link) {
  let node = link;
  let depth = 0;
  while (node && depth < 10) {
    node = node.parentElement;
    depth++;
    if (!node) break;
    if (node.id === "secondary" || node.id === "related") break;

    const hasImg = node.querySelector("img, yt-image, ytd-thumbnail");
    const hasTitle = node.querySelector("h3, [id='video-title'], a[title], yt-formatted-string");
    const hasLink = node.querySelector('a[href*="/watch?v="]');

    if (hasImg && hasTitle && hasLink) {
      return node;
    }
  }
  return null;
}

function processByLinks() {
  if (!settings.enabled) return;
  if (isMiniplayerFrame()) return;

  const containers = [
    document.querySelector("#secondary"),
    document.querySelector("#related"),
    document.querySelector("ytd-watch-next-secondary-results-renderer")
  ].filter(Boolean);

  const seen = new Set();

  containers.forEach(container => {
    container.querySelectorAll('a[href*="/watch?v="]').forEach(link => {
      const card = findCardFromLink(link);
      if (!card) return;
      if (seen.has(card)) return;
      if (card.id === "secondary" || card.id === "related") return;
      seen.add(card);
      processItem(card);
    });
  });
}

function scanAndFilter() {
  if (!settings.enabled) return;
  if (!document.body) return;
  if (isMiniplayerFrame()) return;

  document.querySelectorAll(ITEM_SELECTOR).forEach(processItem);
  processByLinks();

  if (settings.hideShorts) {
    document.querySelectorAll("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]").forEach(el => {
      el.style.display = "none";
      el.setAttribute(HIDDEN_ATTR, "1");
    });
  }

  if (settings.optimize && settings.optimizeDom && virtualObserver && !inMiniplayer()) {
    scanVirtualRoots();
  }
}

let pending = new Set();
let scheduled = false;

function scheduleProcess(el) {
  pending.add(el);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const batch = Array.from(pending);
    pending.clear();
    for (const el of batch) {
      if (el.isConnected) processItem(el);
    }
  });
}

const observer = new MutationObserver((mutations) => {
  if (!settings.enabled) return;
  if (inWarmup()) return;
  if (isMiniplayerFrame()) return;

  let sidebarTouched = false;
  let newVideos = false;

  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;

      if (settings.optimize && settings.optimizeVideos) {
        if (node.matches?.("video") || node.querySelector?.("video")) {
          newVideos = true;
        }
      }

      if (node.matches?.(ITEM_SELECTOR)) {
        scheduleProcess(node);
      } else {
        const nested = node.querySelectorAll?.(ITEM_SELECTOR);
        if (nested?.length) {
          nested.forEach(el => scheduleProcess(el));
        }
      }

      if (node.id === "secondary" ||
          node.id === "related" ||
          node.closest?.("#secondary, #related, ytd-watch-next-secondary-results-renderer")) {
        sidebarTouched = true;
      }
    }
  }

  if (newVideos) {
    clearTimeout(observer._vidTimer);
    observer._vidTimer = setTimeout(stopPreviewVideos, 200);
  }

  if (sidebarTouched) {
    setTimeout(processByLinks, 50);
    setTimeout(processByLinks, 300);
    setTimeout(processByLinks, 800);
  }
});

function startObserver() {
  if (observer._started) return;
  const target = document.body || document.documentElement;
  if (!target) {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    return;
  }
  observer._started = true;
  try {
    observer.observe(target, { childList: true, subtree: true });
  } catch (e) {
    console.warn("Observer start failed:", e);
  }
}

function bootstrapObserver() {
  if (isMiniplayerFrame()) return;
  if (document.body) {
    startObserver();
  } else {
    document.addEventListener("DOMContentLoaded", startObserver, { once: true });
    window.addEventListener("load", startObserver, { once: true });
  }
}

bootstrapObserver();

let scrollThrottle = null;
window.addEventListener("scroll", () => {
  if (!settings.enabled) return;
  if (!isViewportUsable()) return;
  if (isMiniplayerFrame()) return;
  if (scrollThrottle) return;
  const fast = settings.optimize && settings.optimizeScan;
  const delay = fast ? 900 : 400;
  scrollThrottle = setTimeout(() => {
    scrollThrottle = null;
    scanAndFilter();
  }, delay);
}, { passive: true });

function retryScans() {
  if (!settings.enabled) return;
  if (isMiniplayerFrame()) return;
  const delays = [0, 200, 500, 1000, 1800, 3000, 5000];
  delays.forEach(d => {
    setTimeout(() => {
      if (!isViewportUsable()) return;
      scanAndFilter();
      processByLinks();
    }, d);
  });
}

let secondaryWatchTimer = null;

function watchSecondary() {
  clearInterval(secondaryWatchTimer);

  if (isMiniplayerFrame()) return;

  const fast = settings.optimize && settings.optimizeScan;
  const interval = fast ? 1600 : 800;

  secondaryWatchTimer = setInterval(() => {
    if (!settings.enabled) return;
    if (!isViewportUsable()) return;
    if (isMiniplayerFrame()) return;

    const sec = document.querySelector("#secondary") ||
                document.querySelector("#related");
    if (!sec) return;

    const links = sec.querySelectorAll('a[href*="/watch?v="]');
    if (links.length === 0) return;

    processByLinks();
  }, interval);
}

window.addEventListener("yt-navigate-finish", () => {
  if (isMiniplayerFrame()) return;
  resetProcessed();
  restoreAllVirtual();
  retryScans();
  watchSecondary();
  handleMiniplayerState();
  renderFocusBanner();
});

window.addEventListener("yt-page-data-updated", () => {
  if (isMiniplayerFrame()) return;
  retryScans();
  handleMiniplayerState();
  renderFocusBanner();
});

window.addEventListener("yt-navigate-start", () => {
  if (isMiniplayerFrame()) return;
  resetProcessed();
  restoreAllVirtual();
});

if (!isMiniplayerFrame()) {
  if (document.readyState !== "loading") {
    retryScans();
    watchSecondary();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      retryScans();
      watchSecondary();
    });
  }
}

const AD_SELECTORS = [
  "ytd-promoted-sparkles-web-renderer",
  "ytd-promoted-video-renderer",
  "ytd-display-ad-renderer",
  "ytd-ad-slot-renderer",
  "ytd-in-feed-ad-layout-renderer",
  "ytd-banner-promo-renderer",
  "ytd-statement-banner-renderer",
  "ytd-brand-video-shelf-renderer",
  "ytd-brand-video-singleton-renderer",
  "ytd-compact-promoted-video-renderer",
  "ytd-compact-promoted-item-renderer",
  "ytm-promoted-sparkles-web-renderer",
  "ytm-promoted-video-renderer",
  "ad-slot-renderer",
  "ytd-engagement-panel-section-list-renderer[target-id='engagement-panel-ads']",
  "ytd-merch-shelf-renderer",
  "#player-ads",
  "#masthead-ad",
  "#offer-module",
  "tp-yt-paper-dialog.ytd-popup-container[aria-label*='Ad']"
];

function removeAdElements() {
  if (!settings.blockAds) return;
  if (!settings.blockAdsBanners) return;
  if (!isViewportUsable()) return;
  if (isMiniplayerFrame()) return;
  if (!document.body) return;
  try {
    for (const sel of AD_SELECTORS) {
      document.querySelectorAll(sel).forEach(el => {
        el.style.display = "none";
        el.setAttribute(AD_HIDDEN_ATTR, "1");
      });
    }
  } catch (e) {}
}

function skipVideoAd() {
  if (!settings.enabled || !settings.blockAds || !settings.blockAdsVideo) return;
  const player = document.querySelector("#movie_player");
  if (!player) return;

  const isAd = player.classList.contains("ad-showing") ||
               player.classList.contains("ad-interrupting");
  if (!isAd) return;

  const video = player.querySelector("video");
  if (video) {
    try {
      video.muted = true;
      video.playbackRate = 16;
      if (isFinite(video.duration) && video.duration > 0) {
        video.currentTime = Math.max(0, video.duration - 0.1);
      }
    } catch (e) {}
  }

  const skipBtn = player.querySelector(
    ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button"
  );
  if (skipBtn) {
    skipBtn.click();
  }

  const overlayClose = player.querySelector(
    ".ytp-ad-overlay-close-button, .ytp-ad-overlay-close-container"
  );
  if (overlayClose) overlayClose.click();
}

function blockAntiAdblockPopup() {
  if (!settings.blockAds) return;
  if (!settings.blockAdsPopups) return;
  if (!isViewportUsable()) return;
  if (isMiniplayerFrame()) return;
  const popup = document.querySelector("ytd-enforcement-message-view-model");
  if (popup) {
    const close = popup.querySelector("#dismiss-button, tp-yt-paper-button#dismiss-button");
    if (close) close.click();
    else popup.remove();
  }
  const dialog = document.querySelector("tp-yt-paper-dialog.ytd-popup-container");
  if (dialog && /ad block/i.test(dialog.textContent || "")) {
    dialog.remove();
  }
}

function startAdWatcher() {
  setInterval(() => {
    if (!settings.enabled || !settings.blockAds) return;
    skipVideoAd();
  }, 250);

  setInterval(() => {
    if (!settings.enabled || !settings.blockAds) return;
    if (isMiniplayerFrame()) return;
    removeAdElements();
    blockAntiAdblockPopup();
  }, 1000);

  setInterval(() => {
    if (!settings.enabled || !settings.optimize || !settings.optimizeVideos) return;
    if (!isViewportUsable()) return;
    if (isMiniplayerFrame()) return;
    if (inMiniplayer()) return;
    stopPreviewVideos();
  }, 3000);
}

startAdWatcher();

let lastMiniplayerState = false;
let miniplayerCooldown = null;

function handleMiniplayerState() {
  if (isMiniplayerFrame()) return;

  const inMini = inMiniplayer();

  if (inMini === lastMiniplayerState) return;
  lastMiniplayerState = inMini;

  if (inMini) {
    if (virtualizationStartTimer) {
      clearTimeout(virtualizationStartTimer);
      virtualizationStartTimer = null;
    }
    virtualizationPaused = true;
    if (virtualObserver) virtualObserver.disconnect();
    restoreAllVirtual();

    const root = document.documentElement;
    if (root) {
      root.removeAttribute("data-yt-optimize");
      root.removeAttribute("data-yt-opt-anim");
      root.removeAttribute("data-yt-opt-video");
      root.removeAttribute("data-yt-opt-fx");
    }
  } else {
    clearTimeout(miniplayerCooldown);
    miniplayerCooldown = setTimeout(() => {
      if (!settings.optimize) return;
      virtualizationPaused = false;
      applyAll();
    }, 1200);
  }
}

const miniplayerObserver = new MutationObserver(() => {
  if (isMiniplayerFrame()) return;
  handleMiniplayerState();
});

function bootMiniplayerObserver() {
  if (isMiniplayerFrame()) return;
  const target = document.body || document.documentElement;
  if (!target) {
    document.addEventListener("DOMContentLoaded", bootMiniplayerObserver, { once: true });
    return;
  }
  try {
    miniplayerObserver.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["active", "class", "style"]
    });
  } catch (e) {}
}

if (!isMiniplayerFrame()) {
  bootMiniplayerObserver();
  handleMiniplayerState();
}

document.addEventListener("keydown", (e) => {
  if (isMiniplayerFrame()) return;
  if (e.key === "i" || e.key === "I") {
    setTimeout(handleMiniplayerState, 50);
    setTimeout(handleMiniplayerState, 400);
    setTimeout(handleMiniplayerState, 1200);
  }
}, true);

/* ===== Focus banner on YouTube page ===== */

let focusTickInterval = null;

function fmtFocusTime(ms) {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function renderFocusBanner() {
  if (isMiniplayerFrame()) return;
  if (!document.body) return;

  let banner = document.getElementById(FOCUS_BANNER_ID);

  if (!focusState || !focusState.active || Date.now() >= focusState.endsAt) {
    if (banner) banner.remove();
    if (focusTickInterval) {
      clearInterval(focusTickInterval);
      focusTickInterval = null;
    }
    return;
  }

  if (!banner) {
    banner = document.createElement("div");
    banner.id = FOCUS_BANNER_ID;
    banner.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 2147483600;
      background: linear-gradient(135deg, #2a1a1a, #3a1f1f);
      border: 1px solid #4a2020;
      border-radius: 10px;
      padding: 8px 12px;
      font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #ff9999;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
      pointer-events: none;
      user-select: none;
    `;
    banner.innerHTML = `
      <span style="font-size:14px;">🎯</span>
      <span style="color:#fff;">Focus</span>
      <span data-focus-time style="font-variant-numeric: tabular-nums; color:#fff; letter-spacing:0.5px;">--:--</span>
    `;
    document.body.appendChild(banner);
  }

  const timeEl = banner.querySelector("[data-focus-time]");
  if (timeEl) timeEl.textContent = fmtFocusTime(focusState.endsAt - Date.now());

  if (!focusTickInterval) {
    focusTickInterval = setInterval(() => {
      if (!focusState.active || Date.now() >= focusState.endsAt) {
        clearInterval(focusTickInterval);
        focusTickInterval = null;
        const b = document.getElementById(FOCUS_BANNER_ID);
        if (b) b.remove();
        return;
      }
      const b = document.getElementById(FOCUS_BANNER_ID);
      if (b) {
        const t = b.querySelector("[data-focus-time]");
        if (t) t.textContent = fmtFocusTime(focusState.endsAt - Date.now());
      }
    }, 1000);
  }
}

/* ===== Local YouTube watch-time tracking ===== */

function isTopLevelYouTubePage() {
  try {
    return window.top === window && !isMiniplayerFrame();
  } catch (error) {
    return false;
  }
}

function getWatchVideo() {
  let pageUrl;
  try {
    pageUrl = new URL(window.location.href);
  } catch (error) {
    return null;
  }

  let videoId = pageUrl.pathname === "/watch"
    ? pageUrl.searchParams.get("v")
    : pageUrl.pathname.match(/^\/(?:shorts|live)\/([\w-]+)/)?.[1];
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;

  const video = document.querySelector("#movie_player video.html5-main-video") ||
    document.querySelector("video.html5-main-video");
  if (!video) return null;

  const titleElement = document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
    document.querySelector("h1 yt-formatted-string") ||
    document.querySelector("h1");
  const title = (titleElement?.textContent || document.title.replace(/\s+-\s+YouTube$/, "")).trim();

  return {
    id: videoId,
    title: title.slice(0, 500) || "Untitled video",
    url: `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    video
  };
}

function isWatchVideoPlaying(video) {
  const player = document.querySelector("#movie_player");
  if (document.visibilityState !== "visible" || video.paused || video.ended) return false;
  if (player?.classList.contains("ad-showing") || player?.classList.contains("ad-interrupting")) return false;
  return true;
}

const watchTimePending = Object.create(null);
let watchTimeCurrentId = null;
let watchTimeLastTick = Date.now();
let watchTimeWasPlaying = false;
let watchTimeLastFlush = Date.now();
let watchTimeFlushInFlight = false;

function watchTimeDate(timestamp) {
  const date = new Date(timestamp);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addWatchTime(videoInfo, timestamp, elapsedMs) {
  const dateKey = watchTimeDate(timestamp);
  if (!watchTimePending[dateKey]) watchTimePending[dateKey] = Object.create(null);
  const day = watchTimePending[dateKey];
  if (!day[videoInfo.id]) {
    day[videoInfo.id] = {
      videoId: videoInfo.id,
      title: videoInfo.title,
      url: videoInfo.url,
      seconds: 0,
      remainderMs: 0
    };
  }
  const pending = day[videoInfo.id];
  pending.title = videoInfo.title;
  pending.remainderMs += elapsedMs;
  pending.seconds += Math.floor(pending.remainderMs / 1000);
  pending.remainderMs %= 1000;
}

function flushWatchTime() {
  if (watchTimeFlushInFlight) return;

  const snapshot = [];
  Object.entries(watchTimePending).forEach(([date, day]) => {
    Object.values(day).forEach((entry) => {
      if (entry.seconds > 0) snapshot.push({ date, ...entry });
    });
  });
  if (!snapshot.length) return;

  watchTimeFlushInFlight = true;
  Promise.all(snapshot.map(async (entry) => {
    try {
      const response = await browser.runtime.sendMessage({
        type: "recordWatchTime",
        entry: {
          date: entry.date,
          videoId: entry.videoId,
          title: entry.title,
          url: entry.url,
          seconds: entry.seconds
        }
      });
      if (!response?.ok) {
        console.warn("Could not save YouTube watch time:", response?.error || "Unknown error");
        return;
      }
      const pending = watchTimePending[entry.date]?.[entry.videoId];
      if (pending) {
        pending.seconds = Math.max(0, pending.seconds - entry.seconds);
        if (pending.seconds === 0 && pending.remainderMs === 0) {
          delete watchTimePending[entry.date][entry.videoId];
        }
        if (Object.keys(watchTimePending[entry.date]).length === 0) {
          delete watchTimePending[entry.date];
        }
      }
    } catch (error) {
      console.warn("Could not save YouTube watch time:", error);
    }
  })).finally(() => {
    watchTimeFlushInFlight = false;
  });
}

function trackWatchTime() {
  if (!isTopLevelYouTubePage()) return;

  const now = Date.now();
  const current = getWatchVideo();
  const currentId = current?.id || null;
  if (currentId !== watchTimeCurrentId) {
    flushWatchTime();
    watchTimeCurrentId = currentId;
    watchTimeWasPlaying = false;
    watchTimeLastTick = now;
  } else if (current && watchTimeWasPlaying && isWatchVideoPlaying(current.video)) {
    addWatchTime(current, now, Math.max(0, Math.min(now - watchTimeLastTick, 1500)));
  }

  watchTimeWasPlaying = !!current && isWatchVideoPlaying(current.video);
  watchTimeLastTick = now;
  if (now - watchTimeLastFlush >= 10000) {
    flushWatchTime();
    watchTimeLastFlush = now;
  }
}

if (isTopLevelYouTubePage()) {
  setInterval(trackWatchTime, 1000);
  trackWatchTime();
  document.addEventListener("visibilitychange", trackWatchTime);
  window.addEventListener("pagehide", flushWatchTime);
  window.addEventListener("yt-navigate-finish", trackWatchTime);
  window.addEventListener("yt-page-data-updated", trackWatchTime);
}