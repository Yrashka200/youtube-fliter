importScripts("updater.js");

const ALARM_NAME = "check-updates";
const CHECK_INTERVAL_MINUTES = 60;
const UNINSTALL_URL = "https://yrashka200.github.io/youtube-fliter/goodbye.html";

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
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  checkForUpdates();
  chrome.runtime.setUninstallURL(UNINSTALL_URL);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForUpdates();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "checkForUpdates") {
    checkForUpdates().then(state => sendResponse(state));
    return true;
  }
});
