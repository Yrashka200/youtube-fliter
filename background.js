importScripts("updater.js");

const ALARM_NAME = "check-updates";
const CHECK_INTERVAL_MINUTES = 60; 


chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  checkForUpdates();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });
  checkForUpdates();
});


chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkForUpdates();
  }
});


chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "checkForUpdates") {
    checkForUpdates().then(state => sendResponse(state));
    return true; // async response
  }
});