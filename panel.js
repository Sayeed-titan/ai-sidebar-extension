const tabsEl = document.getElementById("tabs");
const framesEl = document.getElementById("frames");
const emptyEl = document.getElementById("empty");
const notebookEl = document.getElementById("notebook");
const modeBtns = document.querySelectorAll(".mode-btn");

const panes = new Map();
let activeAi = null;
let mode = "single";
let paneHeights = {}; // aiId -> px height for split mode

chrome.storage.local.get("paneHeights").then((data) => {
  paneHeights = data.paneHeights || {};
  for (const [id, h] of Object.entries(paneHeights)) {
    const entry = panes.get(id);
    if (entry) entry.pane.style.setProperty("--pane-h", `${h}px`);
  }
});

function getAi(id) { return window.AI_PROVIDERS.find((a) => a.id === id); }

function monoChip(ai) {
  const mono = (ai.logo && ai.logo.monogram) || ai.label[0];
  return `<span class="ai-mono" style="--ai-accent:${ai.color}">${mono}</span>`;
}

function renderTabs() {
  tabsEl.innerHTML = "";
  for (const ai of window.AI_PROVIDERS) {
    const btn = document.createElement("button");
    btn.className = "tab"
      + (activeAi === ai.id && mode !== "notebook" ? " active" : "")
      + (panes.has(ai.id) ? " loaded" : "")
      + (ai.noIframe ? " no-iframe" : "");
    btn.style.setProperty("--ai-accent", ai.color);
    btn.innerHTML = `${monoChip(ai)}<span class="dot"></span><span>${ai.label}</span>`;
    btn.title = ai.noIframe ? `${ai.label} (opens in new tab)` : ai.label;
    btn.addEventListener("click", () => {
      if (mode === "notebook") setMode("single");
      if (ai.noIframe) { openInTab(ai); return; }
      ensurePane(ai.id);
      activate(ai.id);
    });
    tabsEl.appendChild(btn);
  }
}

function renderModeButtons() {
  modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
}

function openInTab(ai, prompt) {
  let url = ai.url;
  if (prompt && ai.tabPromptParam) {
    const sep = url.includes("?") ? "&" : "?";
    url = `${url}${sep}${ai.tabPromptParam}=${encodeURIComponent(prompt)}`;
  }
  chrome.tabs.create({ url });
}

function ensurePane(aiId) {
  if (panes.has(aiId)) return panes.get(aiId);
  const ai = getAi(aiId);
  if (!ai || ai.noIframe) return null;

  const pane = document.createElement("div");
  pane.className = "pane";
  pane.dataset.aiId = aiId;

  const header = document.createElement("div");
  header.className = "pane-header";
  header.style.setProperty("--ai-accent", ai.color);
  header.innerHTML = `
    ${monoChip(ai)}
    <span class="pane-dot"></span>
    <span class="name">${ai.label}</span>
    <span class="spacer"></span>
    <button class="expand" title="Expand to full"><svg><use href="#i-maximize"/></svg></button>
    <button class="reload" title="Reload"><svg><use href="#i-refresh"/></svg></button>
    <button class="open-tab" title="Open in new tab (use this to log in)"><svg><use href="#i-external"/></svg></button>
  `;
  pane.appendChild(header);

  const iframe = document.createElement("iframe");
  iframe.src = ai.url;
  iframe.allow = "clipboard-read; clipboard-write";
  pane.appendChild(iframe);
  // Apply remembered height if any
  if (paneHeights[aiId]) pane.style.setProperty("--pane-h", `${paneHeights[aiId]}px`);

  // Drag handle that lives BELOW this pane (resizes this pane's height)
  const handle = document.createElement("div");
  handle.className = "pane-resize";
  handle.dataset.aiId = aiId;
  attachResize(handle, pane, aiId);

  framesEl.appendChild(pane);
  framesEl.appendChild(handle);

  const entry = { pane, header, iframe, handle, loaded: false, injectorReady: false };
  panes.set(aiId, entry);

  iframe.addEventListener("load", () => { entry.loaded = true; header.classList.add("loaded"); renderTabs(); });

  header.querySelector(".expand").addEventListener("click", () => { setMode("single"); activate(aiId); });
  header.querySelector(".reload").addEventListener("click", () => {
    entry.loaded = false; header.classList.remove("loaded");
    iframe.src = ai.url;
    const fb = pane.querySelector(".pane-fallback");
    if (fb) fb.remove();
  });
  header.querySelector(".open-tab").addEventListener("click", () => chrome.tabs.create({ url: ai.url }));

  // No auto-fallback timer. Many AI SPAs take 10–20s to fully boot and would
  // trigger a false positive. The user can hit Reload / Open-in-tab from the
  // pane header any time. (Iframes that actually refuse to load will show
  // the browser's own "refused to connect" screen, which is unambiguous.)
  return entry;
}

function attachResize(handle, pane, aiId) {
  let startY = 0;
  let startH = 0;
  let dragging = false;

  function onDown(e) {
    if (mode !== "split") return; // only drag in split mode
    dragging = true;
    startY = e.clientY;
    startH = pane.getBoundingClientRect().height;
    handle.classList.add("dragging");
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ns-resize";
    // Cover iframes so mousemove doesn't get lost inside them
    addIframeShield();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp, { once: true });
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    const next = Math.max(160, Math.min(2400, startH + (e.clientY - startY)));
    pane.style.setProperty("--pane-h", `${next}px`);
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove("dragging");
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
    removeIframeShield();
    window.removeEventListener("mousemove", onMove);
    const h = parseInt(pane.style.getPropertyValue("--pane-h"), 10);
    if (h > 0) {
      paneHeights[aiId] = h;
      chrome.storage.local.set({ paneHeights });
    }
  }

  handle.addEventListener("mousedown", onDown);
}

// While dragging, overlay invisible shields on top of every iframe so the
// browser doesn't swallow mousemove events into the cross-origin frame.
let shieldEl = null;
function addIframeShield() {
  if (shieldEl) return;
  shieldEl = document.createElement("div");
  shieldEl.style.cssText = "position:fixed;inset:0;z-index:99999;cursor:ns-resize;background:transparent;";
  document.body.appendChild(shieldEl);
}
function removeIframeShield() {
  if (shieldEl && shieldEl.parentNode) shieldEl.parentNode.removeChild(shieldEl);
  shieldEl = null;
}

function showLoadFallback(pane, ai, iframe) {
  if (pane.querySelector(".pane-fallback")) return;
  const fb = document.createElement("div");
  fb.className = "pane-fallback";
  fb.innerHTML = `
    <div class="fb-card">
      <h3>${ai.label} didn't load in the sidebar</h3>
      <p>It either refused to be embedded or your session needs login.</p>
      <div class="fb-actions">
        <button class="fb-open">Open in new tab</button>
        <button class="fb-retry">Retry</button>
        <button class="fb-dismiss">Dismiss</button>
      </div>
      <p class="fb-tip">Sign in once in a new tab, then click Retry here.</p>
    </div>
  `;
  pane.appendChild(fb);
  fb.querySelector(".fb-open").addEventListener("click", () => chrome.tabs.create({ url: ai.url }));
  fb.querySelector(".fb-retry").addEventListener("click", () => { fb.remove(); iframe.src = ai.url; });
  fb.querySelector(".fb-dismiss").addEventListener("click", () => fb.remove());
}

function activate(aiId) {
  activeAi = aiId;
  for (const [id, entry] of panes) entry.pane.classList.toggle("active", id === aiId);
  emptyEl.classList.add("hidden");
  renderTabs();
}

function setMode(next) {
  mode = next;
  framesEl.classList.toggle("single", mode === "single");
  framesEl.classList.toggle("split", mode === "split");
  framesEl.style.display = mode === "notebook" ? "none" : "";
  notebookEl.classList.toggle("hidden", mode !== "notebook");
  emptyEl.classList.toggle("hidden", mode === "notebook" || panes.size > 0);
  renderModeButtons();
  renderTabs();
  chrome.storage.local.set({ panelMode: mode });
  if (mode === "notebook") renderNotebook();
}

modeBtns.forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));

function sendPromptToAi(aiId, text, source) {
  const ai = getAi(aiId);
  if (!ai) return;
  if (ai.noIframe) { openInTab(ai, text); return; }
  const entry = ensurePane(aiId);
  const ts = Date.now();
  const pending = { text, ts };
  if (source) pending.source = source;

  // Channel A: storage.session — injector picks up on initial read or via
  // storage.onChanged once it's running.
  chrome.storage.session.set({ [`pending_${aiId}`]: pending });

  // Channel B: direct postMessage to the iframe. Robust against storage races.
  // Try immediately AND keep retrying every 600ms for up to 20s OR until the
  // injector posts back AISB_INJECTOR_READY.
  if (!entry) return;
  entry.pendingPayload = { type: "AISB_PROMPT", aiId, text, source: source || null, ts };
  postPromptToFrame(entry);
  if (!entry.poster) {
    entry.poster = setInterval(() => {
      if (!entry.pendingPayload || entry.injectorReady) {
        clearInterval(entry.poster); entry.poster = null;
        return;
      }
      postPromptToFrame(entry);
    }, 600);
    setTimeout(() => { if (entry.poster) { clearInterval(entry.poster); entry.poster = null; } }, 22000);
  }
}

function postPromptToFrame(entry) {
  try {
    if (entry && entry.iframe && entry.iframe.contentWindow && entry.pendingPayload) {
      entry.iframe.contentWindow.postMessage(entry.pendingPayload, "*");
    }
  } catch (_) {}
}

// Injectors announce themselves once they've mounted — flip the readiness
// flag so we can stop polling.
window.addEventListener("message", (e) => {
  const m = e.data;
  if (!m || m.type !== "AISB_INJECTOR_READY" || !m.aiId) return;
  const entry = panes.get(m.aiId);
  if (!entry) return;
  entry.injectorReady = true;
  // Immediately deliver any pending payload so it doesn't wait the next tick.
  postPromptToFrame(entry);
});

function handlePrompt(aiIds, text, source) {
  if (!aiIds || aiIds.length === 0) return;
  const embedded = aiIds.filter((id) => { const a = getAi(id); return a && !a.noIframe; });
  if (embedded.length > 1) setMode("split");
  else if (embedded.length === 1) setMode("single");
  aiIds.forEach((id, i) => setTimeout(() => sendPromptToAi(id, text, source), i * 250));
  if (embedded.length > 0) activate(embedded[0]);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;
  if (msg.type === "PANEL_LOAD") {
    const ids = msg.aiIds || (msg.aiId ? [msg.aiId] : []);
    handlePrompt(ids, msg.text, msg.source);
  } else if (msg.type === "NOTEBOOK_UPDATED" && mode === "notebook") {
    renderNotebook();
  }
});

(async () => {
  const { panelMode } = await chrome.storage.local.get("panelMode");
  setMode(panelMode === "split" ? "split" : panelMode === "notebook" ? "notebook" : "single");
  renderTabs();
  const { last } = await chrome.storage.session.get("last");
  if (last) {
    const ids = last.aiIds || [last.aiId];
    handlePrompt(ids, last.text, last.source);
    // Clear `last` so re-opening the panel later doesn't replay a stale prompt
    chrome.storage.session.remove("last");
  }
})();

// ===== Notebook =====
const sessionBtn = document.getElementById("nb-session-btn");
const sessionNameEl = document.getElementById("nb-session-name");
const sessionSelect = document.getElementById("nb-session");
const newSessionBtn = document.getElementById("nb-new-session");
const searchInput = document.getElementById("nb-search");
const exportBtn = document.getElementById("nb-export");
const nbList = document.getElementById("nb-list");
const nbEmpty = document.getElementById("nb-empty");

const actionBar = document.getElementById("nb-action-bar");
const selCount = document.getElementById("nb-selected-count");
const synthAi = document.getElementById("nb-synth-ai");
const synthGo = document.getElementById("nb-synth-go");
const clearSelBtn = document.getElementById("nb-clear-sel");

let nbState = { entries: [], sessions: [], currentSessionId: "default", filter: "", selectedIds: new Set() };

async function loadNotebookState() {
  const data = await chrome.storage.local.get(["notebook_entries", "notebook_sessions", "currentSessionId"]);
  nbState.entries = data.notebook_entries || [];
  nbState.sessions = data.notebook_sessions || [{ id: "default", name: "Default", createdAt: Date.now() }];
  nbState.currentSessionId = data.currentSessionId || nbState.sessions[0].id;
}

async function renderNotebook() {
  await loadNotebookState();
  sessionSelect.innerHTML = "";
  for (const s of nbState.sessions) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    if (s.id === nbState.currentSessionId) opt.selected = true;
    sessionSelect.appendChild(opt);
  }
  const current = nbState.sessions.find((s) => s.id === nbState.currentSessionId);
  sessionNameEl.textContent = current ? current.name : "Default";

  const filter = (nbState.filter || "").toLowerCase();
  const entries = nbState.entries.filter((e) =>
    e.sessionId === nbState.currentSessionId &&
    (!filter ||
      (e.prompt || "").toLowerCase().includes(filter) ||
      (e.answer || "").toLowerCase().includes(filter) ||
      (e.sourceTitle || "").toLowerCase().includes(filter))
  );
  nbList.innerHTML = "";
  if (entries.length === 0) {
    nbEmpty.classList.add("visible");
    renderActionBar();
    return;
  }
  nbEmpty.classList.remove("visible");
  for (const e of entries) nbList.appendChild(renderEntry(e));
  renderActionBar();
}

function renderActionBar() {
  const n = nbState.selectedIds.size;
  actionBar.classList.toggle("hidden", n === 0);
  selCount.textContent = `${n} selected`;
  synthAi.innerHTML = "";
  for (const ai of window.AI_PROVIDERS) {
    const opt = document.createElement("option");
    opt.value = ai.id;
    opt.textContent = ai.label;
    synthAi.appendChild(opt);
  }
  synthGo.disabled = n < 2;
  synthGo.title = n < 2 ? "Select at least 2 saved answers to synthesize" : "";
}

function renderEntry(e) {
  const ai = getAi(e.aiId) || { label: e.aiId, color: "#888" };
  const div = document.createElement("article");
  div.className = "nb-entry" + (nbState.selectedIds.has(e.id) ? " is-checked" : "");
  div.style.setProperty("--ai-accent", ai.color);
  const when = new Date(e.ts).toLocaleString();
  const srcHtml = e.sourceUrl
    ? `<div class="src"><svg><use href="#i-link"/></svg><span>From:</span><a href="${escapeAttr(e.sourceUrl)}" target="_blank" rel="noopener">${escapeHtml(e.sourceTitle || e.sourceUrl)}</a></div>`
    : "";
  const isOn = nbState.selectedIds.has(e.id);
  div.innerHTML = `
    <button class="nb-check ${isOn ? "is-on" : ""}" aria-label="${isOn ? "Selected" : "Select"}">${isOn ? '<svg><use href="#i-check"/></svg>' : ""}</button>
    <div>
      <div class="top">
        <span class="ai-name">${escapeHtml(ai.label)}</span>
        <span class="ts">${when}</span>
      </div>
      <div class="actions">
        <button data-act="copy" title="Copy"><svg><use href="#i-copy"/></svg></button>
        <button data-act="delete" title="Delete"><svg><use href="#i-trash"/></svg></button>
      </div>
      ${e.prompt ? `<p class="prompt">${escapeHtml(e.prompt)}</p>` : ""}
      <div class="answer">${escapeHtml(e.answer)}</div>
      <button class="expand-btn" data-act="expand">Expand</button>
      ${srcHtml}
    </div>
  `;
  div.querySelector(".nb-check").addEventListener("click", () => {
    if (nbState.selectedIds.has(e.id)) nbState.selectedIds.delete(e.id);
    else nbState.selectedIds.add(e.id);
    renderNotebook();
  });
  div.querySelector("[data-act='copy']").addEventListener("click", () => navigator.clipboard.writeText(e.answer));
  div.querySelector("[data-act='expand']").addEventListener("click", (ev) => {
    const ans = div.querySelector(".answer");
    const isExp = ans.classList.toggle("expanded");
    ev.target.textContent = isExp ? "Collapse" : "Expand";
  });
  div.querySelector("[data-act='delete']").addEventListener("click", async () => {
    nbState.entries = nbState.entries.filter((x) => x.id !== e.id);
    await chrome.storage.local.set({ notebook_entries: nbState.entries });
    renderNotebook();
  });
  return div;
}

sessionBtn.addEventListener("click", () => {
  if (nbState.sessions.length <= 1) return;
  const idx = nbState.sessions.findIndex((s) => s.id === nbState.currentSessionId);
  const next = nbState.sessions[(idx + 1) % nbState.sessions.length];
  nbState.currentSessionId = next.id;
  chrome.storage.local.set({ currentSessionId: next.id });
  renderNotebook();
});

newSessionBtn.addEventListener("click", async () => {
  const name = prompt("New session name?");
  if (!name) return;
  const id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  nbState.sessions.push({ id, name, createdAt: Date.now() });
  nbState.currentSessionId = id;
  await chrome.storage.local.set({ notebook_sessions: nbState.sessions, currentSessionId: id });
  renderNotebook();
});

searchInput.addEventListener("input", () => { nbState.filter = searchInput.value; renderNotebook(); });

exportBtn.addEventListener("click", async () => {
  await loadNotebookState();
  const sess = nbState.sessions.find((s) => s.id === nbState.currentSessionId);
  const entries = nbState.entries.filter((e) => e.sessionId === nbState.currentSessionId);
  const lines = [`# ${sess ? sess.name : "Session"}`, "", `_Exported ${new Date().toLocaleString()}_`, ""];
  for (const e of entries) {
    const ai = getAi(e.aiId) || { label: e.aiId };
    lines.push(`## ${ai.label} — ${new Date(e.ts).toLocaleString()}`);
    if (e.prompt) lines.push("", `> ${e.prompt.replace(/\n/g, "\n> ")}`);
    lines.push("", e.answer);
    if (e.sourceUrl) lines.push("", `_Source: [${e.sourceTitle || e.sourceUrl}](${e.sourceUrl})_`);
    lines.push("", "---", "");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(sess && sess.name) || "session"}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

clearSelBtn.addEventListener("click", () => { nbState.selectedIds.clear(); renderNotebook(); });

synthGo.addEventListener("click", () => {
  const chosen = nbState.entries.filter((e) => nbState.selectedIds.has(e.id));
  if (chosen.length < 2) return;
  const targetAi = synthAi.value;
  const allSamePrompt = chosen.every((e) => (e.prompt || "") === (chosen[0].prompt || ""));
  const lines = [];
  if (allSamePrompt && chosen[0].prompt) {
    lines.push(`I asked ${chosen.length} different AIs the same question:`, "", `> ${chosen[0].prompt.replace(/\n/g, "\n> ")}`, "", "Here are their answers:", "");
    for (const e of chosen) {
      const ai = getAi(e.aiId) || { label: e.aiId };
      lines.push(`### ${ai.label}`, "", e.answer, "");
    }
  } else {
    lines.push(`I collected ${chosen.length} AI answers from my research:`, "");
    for (const e of chosen) {
      const ai = getAi(e.aiId) || { label: e.aiId };
      lines.push(`### ${ai.label}`);
      if (e.prompt) lines.push(`_Question:_ ${e.prompt}`);
      lines.push("", e.answer, "");
    }
  }
  lines.push("---", "", "Please:",
    "1. Summarize the **consensus** — points where all/most agree.",
    "2. Highlight the **key disagreements** and what's at stake in each.",
    "3. Note any **factual claims that should be verified**.",
    "4. Give your own assessment: which response do you find most reliable and why?");
  const synthPrompt = lines.join("\n");
  handlePrompt([targetAi], synthPrompt, { url: "ai-sidebar://notebook", title: "Synthesis" });
  nbState.selectedIds.clear();
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
