function appendMarkdownInline(container, text) {
  const tokenPattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let offset = 0;
  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index;
    if (index > offset) container.appendChild(document.createTextNode(text.slice(offset, index)));

    const element = document.createElement(token.startsWith("**") ? "b" : token.startsWith("*") ? "i" : "code");
    element.textContent = token.startsWith("**")
      ? token.slice(2, -2)
      : token.slice(1, -1);
    container.appendChild(element);
    offset = index + token.length;
  }
  if (offset < text.length) container.appendChild(document.createTextNode(text.slice(offset)));
}

function renderChangelog(state) {
  const container = document.getElementById("changelog");
  const entries = Array.isArray(state?.allChangelogEntries)
    ? state.allChangelogEntries
    : Array.isArray(state?.changelogEntries)
      ? state.changelogEntries
      : [];
  const releaseVersion = document.getElementById("newVersion").textContent;
  const entry = entries.find((item) => item.version === releaseVersion);
  if (!entry) {
    if (container.querySelector(".entry")) {
      const status = document.createElement("div");
      status.className = "status" + (state?.changelogError ? " error" : "");
      status.textContent = state?.changelogError
        ? `Could not load updated release notes. Showing bundled notes. (${state.changelogError})`
        : `No release notes found for v${releaseVersion}. Showing bundled notes.`;
      container.appendChild(status);
      return;
    }

    const status = document.createElement("div");
    status.className = "status" + (state?.changelogError ? " error" : "");
    status.textContent = state?.changelogError
      ? `Could not load release notes: ${state.changelogError}`
      : "No release notes are available right now.";
    container.replaceChildren(status);
    return;
  }

  const section = document.createElement("section");
  section.className = "entry";
  const body = document.createElement("div");
  body.className = "entry-body";
  let list;
  String(entry.body || "").split(/\r?\n/).forEach((line) => {
    const heading = line.match(/^###\s+(.+)$/);
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (heading) {
      list = null;
      const element = document.createElement("h2");
      appendMarkdownInline(element, heading[1]);
      body.appendChild(element);
    } else if (item) {
      if (!list) {
        list = document.createElement("ul");
        body.appendChild(list);
      }
      const element = document.createElement("li");
      appendMarkdownInline(element, item[1]);
      list.appendChild(element);
    } else if (line) {
      list = null;
      if (body.childNodes.length) body.appendChild(document.createElement("br"));
      appendMarkdownInline(body, line);
    } else {
      list = null;
      if (body.childNodes.length) body.appendChild(document.createElement("br"));
    }
  });
  section.append(body);
  container.replaceChildren(container.querySelector(".changes-title"), section);
}

const releaseParams = new URLSearchParams(location.search);
document.getElementById("oldVersion").textContent = releaseParams.get("from") || "Unknown";
document.getElementById("newVersion").textContent =
  releaseParams.get("to") || browser.runtime.getManifest().version;

browser.runtime.sendMessage({ type: "checkForUpdates" }).then(
  renderChangelog,
  (error) => renderChangelog({ changelogError: error.message })
);
