const ALARM_NAME = "check-updates";
const CHECK_INTERVAL_MINUTES = 60;
const UNINSTALL_URL = "https://goodbye-mocha.vercel.app";
const AD_RULESET_ID = "ad_rules";
let watchStatsWriteQueue = Promise.resolve();

function recordWatchTime(entry) {
  const write = watchStatsWriteQueue.then(async () => {
    const result = await browser.storage.local.get("youtubeWatchStats");
    const stats = result.youtubeWatchStats &&
      typeof result.youtubeWatchStats === "object" &&
      !Array.isArray(result.youtubeWatchStats)
      ? result.youtubeWatchStats
      : {};
    const day = stats[entry.date] &&
      typeof stats[entry.date] === "object" &&
      !Array.isArray(stats[entry.date])
      ? stats[entry.date]
      : {};
    const previous = day[entry.videoId] || {};

    day[entry.videoId] = {
      title: entry.title || previous.title || "Untitled video",
      url: entry.url,
      seconds: (Number(previous.seconds) || 0) + entry.seconds
    };
    stats[entry.date] = day;
    await browser.storage.local.set({ youtubeWatchStats: stats });
  });

  watchStatsWriteQueue = write.catch((error) => {
    console.error("Failed to save YouTube watch time:", error);
  });
  return write;
}

function isValidWatchTimeEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || "")) return false;
  if (!/^[\w-]{11}$/.test(entry.videoId || "")) return false;
  if (!Number.isInteger(entry.seconds) || entry.seconds < 1 || entry.seconds > 60) return false;
  if (typeof entry.title !== "string" || entry.title.length > 500) return false;

  try {
    const url = new URL(entry.url);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com"));
  } catch (error) {
    return false;
  }
}

async function applyAdBlock(enabled) {
  try {
    await browser.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enabled ? [AD_RULESET_ID] : [],
      disableRulesetIds: enabled ? [] : [AD_RULESET_ID]
    });
  } catch (e) {
    console.warn("Ad rules update failed:", e);
  }
}

browser.runtime.onInstalled.addListener((details) => {
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });

  checkForUpdates();

  if (details.reason === "install") {
    browser.tabs.create({
      url: browser.runtime.getURL("welcome.html")
    });
  } else if (details.reason === "update") {
    const whatsNewUrl = new URL(browser.runtime.getURL("whats-new.html"));
    whatsNewUrl.searchParams.set("from", details.previousVersion || "Unknown");
    whatsNewUrl.searchParams.set("to", browser.runtime.getManifest().version);
    browser.tabs.create({
      url: whatsNewUrl.href
    }).catch((error) => {
      console.error("Could not open the What's New page:", error);
    });
  }

  browser.runtime.setUninstallURL(UNINSTALL_URL);

  browser.storage.sync.get(["settings"], (res) => {
    const s = res.settings || {};
    const master = s.blockAds !== false;
    const net = master && s.blockAdsNetwork !== false;
    applyAdBlock(net);
  });
});

browser.runtime.onStartup.addListener(() => {
  browser.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  checkForUpdates();
  browser.runtime.setUninstallURL(UNINSTALL_URL);

  browser.storage.sync.get(["settings"], (res) => {
    const s = res.settings || {};
    const master = s.blockAds !== false;
    const net = master && s.blockAdsNetwork !== false;
    applyAdBlock(net);
  });
});

browser.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForUpdates();
  }
});

browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    const next = changes.settings.newValue || {};
    const master = next.blockAds !== false;
    const net = master && next.blockAdsNetwork !== false;
    applyAdBlock(net);
  }
});

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "recordWatchTime") {
    if (!isValidWatchTimeEntry(msg.entry)) {
      sendResponse({ ok: false, error: "Invalid watch time entry" });
      return;
    }
    recordWatchTime(msg.entry).then(
      () => sendResponse({ ok: true }),
      () => sendResponse({ ok: false, error: "Could not save watch time" })
    );
    return true;
  }
  if (msg.type === "checkForUpdates") {
    checkForUpdates().then(state => sendResponse(state));
    return true;
  }
  if (msg.type === "applyAdBlock") {
    applyAdBlock(!!msg.enabled).then(() => sendResponse({ ok: true }));
    return true;
  }
});