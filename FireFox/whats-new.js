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
  const entries = Array.isArray(state?.changelogEntries) ? state.changelogEntries : [];
  if (!entries.length) {
    const status = document.createElement("div");
    status.className = "status" + (state?.changelogError ? " error" : "");
    status.textContent = state?.changelogError
      ? `Could not load release notes: ${state.changelogError}`
      : "No release notes are available right now.";
    container.replaceChildren(status);
    return;
  }

  const nodes = entries.map((entry) => {
    const section = document.createElement("section");
    section.className = "entry";

    const header = document.createElement("div");
    header.className = "entry-head";
    const version = document.createElement("span");
    version.className = "version";
    version.textContent = `v${entry.version}`;
    header.appendChild(version);
    if (entry.date) {
      const date = document.createElement("span");
      date.className = "date";
      date.textContent = entry.date;
      header.appendChild(date);
    }

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

    section.append(header, body);
    return section;
  });
  container.replaceChildren(...nodes);
}

browser.runtime.sendMessage({ type: "checkForUpdates" }).then(
  renderChangelog,
  (error) => renderChangelog({ changelogError: error.message })
);
