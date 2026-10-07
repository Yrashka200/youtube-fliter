const SEEN_KEY = "seenNotifications";

async function loadNotifications() {
  // 1. Основной источник — updateState (его обновляет updater.js с GitHub)
  try {
    const res = await chrome.storage.local.get(["updateState"]);
    const state = res.updateState;
    if (state && Array.isArray(state.notifications) && state.notifications.length > 0) {
      return state.notifications;
    }
  } catch (e) {
    console.warn("updateState read failed:", e);
  }

  // 2. Fallback — локальный notifications.json (первый запуск / офлайн)
  try {
    const res = await fetch(chrome.runtime.getURL("notifications.json"), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load notifications");
    const data = await res.json();
    return Array.isArray(data.notifications) ? data.notifications : [];
  } catch (e) {
    console.warn("Notifications load failed:", e);
    return [];
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function linkify(text, link, linkText) {
  const safe = escapeHtml(text);
  if (!link) return safe;
  const target = escapeHtml(linkText || link);
  const url = escapeHtml(link);
  const needle = escapeHtml(linkText || link);
  return safe.replace(needle, `<a href="${url}" target="_blank" rel="noopener">${target}</a>`);
}

async function getSeen() {
  return new Promise(resolve => {
    chrome.storage.local.get([SEEN_KEY], res => {
      resolve(Array.isArray(res[SEEN_KEY]) ? res[SEEN_KEY] : []);
    });
  });
}

async function setSeen(ids) {
  return new Promise(resolve => {
    chrome.storage.local.set({ [SEEN_KEY]: ids }, resolve);
  });
}

async function renderNotifications() {
  const panel = document.getElementById("notifPanel");
  const bell = document.getElementById("bellBtn");
  if (!panel || !bell) return;

  const items = await loadNotifications();
  const seen = await getSeen();

  const unseen = items.filter(n => !seen.includes(n.id));
  if (unseen.length > 0) {
    bell.classList.add("has-new");
  } else {
    bell.classList.remove("has-new");
  }

  if (items.length === 0) {
    panel.innerHTML = `<div class="notif-empty">No messages.</div>`;
    return;
  }

  panel.innerHTML = items
    .map(n => {
      const body = linkify(n.message || "", n.link, n.linkText);
      return `
        <div class="notif-item">
          <div class="n-title">
            ${escapeHtml(n.title || "Message")}
            ${n.date ? `<span class="n-date">${escapeHtml(n.date)}</span>` : ""}
          </div>
          <div>${body}</div>
        </div>
      `;
    })
    .join("");
}

document.getElementById("bellBtn").addEventListener("click", async () => {
  const panel = document.getElementById("notifPanel");
  const bell = document.getElementById("bellBtn");

  panel.classList.toggle("open");

  if (panel.classList.contains("open")) {
    const items = await loadNotifications();
    const ids = items.map(n => n.id);
    await setSeen(ids);
    bell.classList.remove("has-new");
  }
});

// Автообновление уведомлений, когда background перезапишет updateState
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.updateState) {
    renderNotifications();
  }
});

renderNotifications();