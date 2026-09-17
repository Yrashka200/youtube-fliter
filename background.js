importScripts("updater.js");

const ALARM_NAME = "check-updates";
const CHECK_INTERVAL_MINUTES = 60;


chrome.runtime.onInstalled.addListener((details) => {
  // Создаём alarm
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

  
  if (details.reason === "update") {
    const newVersion = chrome.runtime.getManifest().version;
    chrome.notifications.create({
      type: "basic",
      iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      title: "YouTube Feed Filter updated",
      message: `Now running v${newVersion}`
    });
  }
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
    return true;
  }
});