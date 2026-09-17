
const CATEGORY_KEYWORDS = {
  games:     ["game", "gaming", "gameplay", "let's play", "стрим", "игр", "геймплей", "прохождение", "steam", "ps5", "xbox", "minecraft", "fortnite", "gta", "dota", "cs2", "valorant"],
  sports:    ["sport", "football", "soccer", "basketball", "nba", "nfl", "ufc", "boxing", "спорт", "футбол", "хоккей", "бокс", "мма", "олимпиад"],
  politics:  ["politic", "election", "government", "president", "parliament", "политик", "выборы", "правительств", "президент", "дума", "митинг", "война"],
  music:     ["music", "song", "album", "official video", "lyrics", "feat.", "музык", "песн", "клип", "альбом", "концерт"],
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
    document.querySelectorAll("[data-yt-filter-hidden]").forEach(el => {
      el.style.display = "";
      el.removeAttribute("data-yt-filter-hidden");
    });
    document.documentElement.removeAttribute("data-yt-size");
    return;
  }
  applySize();
  filterFeed();
}

function applySize() {
  if (settings.videoSize === "default") {
    document.documentElement.removeAttribute("data-yt-size");
  } else {
    document.documentElement.setAttribute("data-yt-size", settings.videoSize);
  }
}


function filterFeed() {
  const items = document.querySelectorAll(
    "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer"
  );

  items.forEach(item => {
    const titleEl =
      item.querySelector("#video-title") ||
      item.querySelector("a#video-title-link") ||
      item.querySelector("h3");
    const channelEl = item.querySelector("ytd-channel-name, #channel-name");
    const descEl = item.querySelector("#description-text");

    const titleText = titleEl?.textContent || "";
    const channelText = channelEl?.textContent || "";
    const descText = descEl?.textContent || "";

    const text = [titleText, channelText, descText].join(" ").toLowerCase();

    let shouldHide = false;


    for (const cat of settings.blockedCategories) {
      const kws = CATEGORY_KEYWORDS[cat] || [];
      if (kws.some(kw => text.includes(kw))) {
        shouldHide = true;
        break;
      }
    }

  
    if (!shouldHide && settings.customKeywords.length) {
      if (settings.customKeywords.some(kw => kw && text.includes(kw.toLowerCase()))) {
        shouldHide = true;
      }
    }


  
    const lang = detectLanguage(titleText + " " + channelText);
    if (!shouldHide && settings.hideRussian && lang === "ru") shouldHide = true;
    if (!shouldHide && settings.hideEnglish && lang === "en") shouldHide = true;

    
    if (!shouldHide && settings.hideShorts) {
      if (item.tagName.toLowerCase() === "ytd-rich-item-renderer" &&
          item.querySelector("ytm-shorts-lockup-view-model, a[href*='/shorts/']")) {
        shouldHide = true;
      }
      if (text.includes("#shorts")) shouldHide = true;
    }


    if (!shouldHide && settings.hideWatched) {
      const progress = item.querySelector("#progress");
      if (progress && parseFloat(progress.style.width || "0") > 90) {
        shouldHide = true;
      }
    }

    if (shouldHide) {
      item.style.display = "none";
      item.setAttribute("data-yt-filter-hidden", "1");
    } else if (item.hasAttribute("data-yt-filter-hidden")) {
      item.style.display = "";
      item.removeAttribute("data-yt-filter-hidden");
    }
  });
}


let filterTimeout;
const observer = new MutationObserver(() => {
  clearTimeout(filterTimeout);
  filterTimeout = setTimeout(() => {
    if (settings.enabled) filterFeed();
  }, 300);
});

observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener("yt-navigate-finish", () => {
  if (settings.enabled) {
    setTimeout(filterFeed, 500);
  }
});
