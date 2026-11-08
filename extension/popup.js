import { toMarkdown } from "./markdown.js";

const $ = (id) => document.getElementById(id);
const clipForm = $("clip-form");
const settingsForm = $("settings-form");
const status = $("status");

let page = null;
let settings = { origin: "", token: "" };

function say(message, tone = "") {
  status.className = tone;
  status.textContent = message;
}

/** Runs inside the page: metadata, the selection (if any) and the main content as HTML. */
function readPage() {
  const meta = (selector) =>
    document.querySelector(selector)?.getAttribute("content")?.trim() || null;
  const selection = window.getSelection();
  let selectionHtml = null;
  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const box = document.createElement("div");
    for (let i = 0; i < selection.rangeCount; i += 1) {
      box.appendChild(selection.getRangeAt(i).cloneContents());
    }
    selectionHtml = box.innerHTML;
  }
  const root =
    document.querySelector("article") ||
    document.querySelector("main, [role='main']") ||
    document.body;
  const clone = root.cloneNode(true);
  clone
    .querySelectorAll(
      "script, style, noscript, iframe, svg, canvas, form, button, nav, footer, aside, template, [hidden], [aria-hidden='true']",
    )
    .forEach((node) => node.remove());
  return {
    title: meta("meta[property='og:title']") || document.title || location.hostname,
    url: location.href,
    siteName: meta("meta[property='og:site_name']"),
    author: meta("meta[name='author']") || meta("meta[property='article:author']"),
    published: meta("meta[property='article:published_time']"),
    description: meta("meta[name='description']") || meta("meta[property='og:description']"),
    selectionHtml,
    pageHtml: clone.innerHTML,
  };
}

function markdownFrom(html, baseUrl) {
  // DOMParser builds an inert document: nothing in it runs or loads.
  const doc = new DOMParser().parseFromString(html, "text/html");
  return toMarkdown(doc.body, baseUrl);
}

async function api(path, init = {}) {
  let response;
  try {
    response = await fetch(`${settings.origin}/api/v1${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${settings.token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch {
    throw new Error("Ethos is unreachable. Check the address in Settings.");
  }
  if (response.status === 401) {
    throw new Error("Token rejected. Create a new one in Ethos → Settings → Capture.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = typeof body?.detail === "string" ? body.detail : `Ethos answered ${response.status}`;
    throw new Error(detail);
  }
  return body;
}

function showSettings() {
  clipForm.hidden = true;
  settingsForm.hidden = false;
  $("origin").value = settings.origin;
  $("token").value = settings.token;
  $("cancel-settings").hidden = !settings.origin;
  $("origin").focus();
}

async function loadFolders() {
  const select = $("folder");
  const { suggested_id: suggested, suggested_name: name, folders } = await api("/clip/folders");
  select.replaceChildren();
  if (!suggested) select.add(new Option(`${name} (new)`, ""));
  for (const folder of folders) select.add(new Option(folder.path, folder.id));
  select.value = suggested ?? "";
}

async function showClip() {
  settingsForm.hidden = true;
  clipForm.hidden = false;
  say("");
  if (!page) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: readPage,
      });
      page = result.result;
    } catch {
      clipForm.hidden = true;
      say("This page can't be clipped (browser pages and the web store are off limits).", "error");
      return;
    }
  }
  $("title").value = page.title.slice(0, 200);
  $("source").textContent = page.url;
  const hasSelection = Boolean(page.selectionHtml);
  $("mode-selection").disabled = !hasSelection;
  $(hasSelection ? "mode-selection" : "mode-page").checked = true;
  try {
    await loadFolders();
  } catch (error) {
    say(error.message, "error");
  }
}

async function clip(event) {
  event.preventDefault();
  const selection = $("mode-selection").checked;
  const markdown = markdownFrom(selection ? page.selectionHtml : page.pageHtml, page.url);
  if (!markdown.trim()) {
    say("Nothing readable to clip here.", "error");
    return;
  }
  $("clip").disabled = true;
  say("Clipping…");
  try {
    const published = page.published?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? page.published;
    const result = await api("/clip", {
      method: "POST",
      body: JSON.stringify({
        title: $("title").value.trim() || page.url,
        url: page.url,
        markdown,
        selection,
        note: $("note").value.trim() || null,
        folder_id: $("folder").value || null,
        site_name: page.siteName?.slice(0, 300) ?? null,
        author: page.author?.slice(0, 300) ?? null,
        published: published?.slice(0, 300) ?? null,
        description: page.description?.slice(0, 1000) ?? null,
      }),
    });
    const link = document.createElement("a");
    link.href = `${settings.origin}/notes/${result.note_id}`;
    link.target = "_blank";
    link.textContent = "Open";
    say(`Saved to ${result.folder} as “${result.title}”. `, "ok");
    status.append(link);
  } catch (error) {
    say(error.message, "error");
  } finally {
    $("clip").disabled = false;
  }
}

async function saveSettings(event) {
  event.preventDefault();
  let origin;
  try {
    origin = new URL($("origin").value.trim()).origin;
  } catch {
    say("Enter the full address, e.g. https://ethos.example.com", "error");
    return;
  }
  // Host access is granted per Ethos address, only when the owner asks for it.
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
  if (!granted) {
    say("The clipper needs permission to reach that address.", "error");
    return;
  }
  settings = { origin, token: $("token").value.trim() };
  try {
    await api("/clip/folders");
  } catch (error) {
    say(error.message, "error");
    return;
  }
  await chrome.storage.local.set(settings);
  await showClip();
  say("Connected.", "ok");
}

clipForm.addEventListener("submit", clip);
settingsForm.addEventListener("submit", saveSettings);
$("open-settings").addEventListener("click", showSettings);
$("cancel-settings").addEventListener("click", showClip);

const stored = await chrome.storage.local.get(["origin", "token"]);
settings = { origin: stored.origin ?? "", token: stored.token ?? "" };
if (settings.origin && settings.token) await showClip();
else showSettings();
