const SEEN_KEY = "seenNotifications";

async function loadNotifications() {
  
  try {
    const res = await browser.storage.local.get(["updateState"]);
    const state = res.updateState;
    if (state && Array.isArray(state.notifications) && state.notifications.length > 0) {
      return state.notifications;
    }
  } catch (e) {
    console.warn("updateState read failed:", e);
  }


  try {
    const res = await fetch(browser.runtime.getURL("notifications.json"), { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to load notifications");
    const data = await res.json();
    return Array.isArray(data.notifications) ? data.notifications : [];
  } catch (e) {
    console.warn("Notifications load failed:", e);
    return [];
  }
}

function appendNotificationMessage(container, text, link, linkText) {
  const message = String(text);
  const label = String(linkText || link || "");
  let url;
  try {
    url = new URL(link);
  } catch (error) {
    container.textContent = message;
    return;
  }

  const matchIndex = url.protocol === "https:" || url.protocol === "http:"
    ? message.indexOf(label)
    : -1;
  if (!label || matchIndex < 0) {
    container.textContent = message;
    return;
  }

  container.append(document.createTextNode(message.slice(0, matchIndex)));
  const anchor = document.createElement("a");
  anchor.href = url.href;
  anchor.target = "_blank";
  anchor.rel = "noopener";
  anchor.textContent = label;
  container.append(anchor, document.createTextNode(message.slice(matchIndex + label.length)));
}

async function getSeen() {
  return new Promise(resolve => {
    browser.storage.local.get([SEEN_KEY], res => {
      resolve(Array.isArray(res[SEEN_KEY]) ? res[SEEN_KEY] : []);
    });
  });
}

async function setSeen(ids) {
  return new Promise(resolve => {
    browser.storage.local.set({ [SEEN_KEY]: ids }, resolve);
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
    const empty = document.createElement("div");
    empty.className = "notif-empty";
    empty.textContent = "No messages.";
    panel.replaceChildren(empty);
    return;
  }

  const notificationNodes = items.map((notification) => {
    const item = document.createElement("div");
    item.className = "notif-item";

    const title = document.createElement("div");
    title.className = "n-title";
    title.appendChild(document.createTextNode(notification.title || "Message"));
    if (notification.date) {
      const date = document.createElement("span");
      date.className = "n-date";
      date.textContent = notification.date;
      title.appendChild(date);
    }

    const message = document.createElement("div");
    appendNotificationMessage(message, notification.message || "", notification.link, notification.linkText);
    item.append(title, message);
    return item;
  });
  panel.replaceChildren(...notificationNodes);
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


browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.updateState) {
    renderNotifications();
  }
});

renderNotifications();
