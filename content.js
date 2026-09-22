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

let settings = {
  enabled: true,
  blockedCategories: [],
  customKeywords: [],
  videoSize: "default",
  hideShorts: false,
  hideWatched: true,
  hideRussian: false,
  hideEnglish: false
};

const PROCESSED_ATTR = "data-yt-filter-processed";
const HIDDEN_ATTR = "data-yt-filter-hidden";

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

chrome.storage.sync.get(["settings"], (res) => {
  if (res.settings) settings = { ...settings, ...res.settings };
  applyAll();
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    settings = { ...settings, ...changes.settings.newValue };
    applyAll();
  }
});

function applyAll() {
  if (!settings.enabled) {
    document.querySelectorAll(`[${HIDDEN_ATTR}]`).forEach(el => {
      el.style.display = "";
      el.removeAttribute(HIDDEN_ATTR);
    });
    document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => {
      el.removeAttribute(PROCESSED_ATTR);
    });
    document.documentElement.removeAttribute("data-yt-size");
    return;
  }
  applySize();
  resetProcessed();
  scanAndFilter();
}

function applySize() {
  if (settings.videoSize === "default") {
    document.documentElement.removeAttribute("data-yt-size");
  } else {
    document.documentElement.setAttribute("data-yt-size", settings.videoSize);
  }
}

function resetProcessed() {
  document.querySelectorAll(`[${PROCESSED_ATTR}]`).forEach(el => {
    el.removeAttribute(PROCESSED_ATTR);
  });
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

  document.querySelectorAll(ITEM_SELECTOR).forEach(processItem);
  processByLinks();

  if (settings.hideShorts) {
    document.querySelectorAll("ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]").forEach(el => {
      el.style.display = "none";
      el.setAttribute(HIDDEN_ATTR, "1");
    });
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

  let sidebarTouched = false;

  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;

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

  if (sidebarTouched) {
    setTimeout(processByLinks, 50);
    setTimeout(processByLinks, 300);
    setTimeout(processByLinks, 800);
  }
});

observer.observe(document.body, { childList: true, subtree: true });

let scrollThrottle = null;
window.addEventListener("scroll", () => {
  if (!settings.enabled) return;
  if (scrollThrottle) return;
  scrollThrottle = setTimeout(() => {
    scrollThrottle = null;
    scanAndFilter();
  }, 400);
}, { passive: true });

function retryScans() {
  if (!settings.enabled) return;
  const delays = [0, 200, 500, 1000, 1800, 3000, 5000];
  delays.forEach(d => {
    setTimeout(() => {
      scanAndFilter();
      processByLinks();
    }, d);
  });
}

let secondaryWatchTimer = null;

function watchSecondary() {
  clearInterval(secondaryWatchTimer);

  secondaryWatchTimer = setInterval(() => {
    if (!settings.enabled) return;

    const sec = document.querySelector("#secondary") ||
                document.querySelector("#related");
    if (!sec) return;

    const links = sec.querySelectorAll('a[href*="/watch?v="]');
    if (links.length === 0) return;

    processByLinks();
  }, 800);
}

window.addEventListener("yt-navigate-finish", () => {
  resetProcessed();
  retryScans();
  watchSecondary();
});

window.addEventListener("yt-page-data-updated", retryScans);

window.addEventListener("yt-navigate-start", () => {
  resetProcessed();
});

if (document.readyState !== "loading") {
  retryScans();
  watchSecondary();
} else {
  document.addEventListener("DOMContentLoaded", () => {
    retryScans();
    watchSecondary();
  });
}