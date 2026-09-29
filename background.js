importScripts("updater.js");

const ALARM_NAME = "check-updates";
const CHECK_INTERVAL_MINUTES = 60;
const UNINSTALL_URL = "https://goodbye-mocha.vercel.app";
const AD_RULESET_ID = "ad_rules";

async function applyAdBlock(enabled) {
  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enabled ? [AD_RULESET_ID] : [],
      disableRulesetIds: enabled ? [] : [AD_RULESET_ID]
    });
  } catch (e) {
    console.warn("Ad rules update failed:", e);
  }
}

chrome.runtime.onInstalled.addListener((details) => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });

  checkForUpdates();

  if (details.reason === "install") {
    chrome.tabs.create({
      url: chrome.runtime.getURL("welcome.html")
    });
  }

  chrome.runtime.setUninstallURL(UNINSTALL_URL);

  chrome.storage.sync.get(["settings"], (res) => {
    const s = res.settings || {};
    const master = s.blockAds !== false;
    const net = master && s.blockAdsNetwork !== false;
    applyAdBlock(net);
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  checkForUpdates();
  chrome.runtime.setUninstallURL(UNINSTALL_URL);

  chrome.storage.sync.get(["settings"], (res) => {
    const s = res.settings || {};
    const master = s.blockAds !== false;
    const net = master && s.blockAdsNetwork !== false;
    applyAdBlock(net);
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForUpdates();
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.settings) {
    const next = changes.settings.newValue || {};
    const master = next.blockAds !== false;
    const net = master && next.blockAdsNetwork !== false;
    applyAdBlock(net);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "checkForUpdates") {
    checkForUpdates().then(state => sendResponse(state));
    return true;
  }
  if (msg.type === "applyAdBlock") {
    applyAdBlock(!!msg.enabled).then(() => sendResponse({ ok: true }));
    return true;
  }
});