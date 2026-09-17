
document.getElementById("ver").textContent =
  chrome.runtime.getManifest().version;


document.getElementById("startBtn").addEventListener("click", () => {
  
  chrome.tabs.create({ url: "https://www.youtube.com/" });
  
  window.close();
});