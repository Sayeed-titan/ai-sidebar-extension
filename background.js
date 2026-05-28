// Service worker. Built-in providers list is mirrored here because the SW
// can't import the lib/ais.js classic-script global. Custom providers are
// loaded from chrome.storage.local on demand.
const BUILTINS = [
  { id: "chatgpt",    label: "ChatGPT" },
  { id: "claude",     label: "Claude" },
  { id: "perplexity", label: "Perplexity" },
  { id: "gemini",     label: "Gemini" }
];

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// ---------- context menu (rebuilt when custom providers change) ----------

async function getAllProviderRefs() {
  const { customProviders = [] } = await chrome.storage.local.get("customProviders");
  return [
    ...BUILTINS,
    ...customProviders.map((p) => ({ id: p.id, label: p.label }))
  ];
}

async function buildMenus() {
  const providers = await getAllProviderRefs();
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "ais_root", title: "AI Sidebar", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "ais_open_composer", parentId: "ais_root", title: "Open composer…", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "ais_sep", parentId: "ais_root", type: "separator", contexts: ["selection"] });
    for (const p of providers) {
      chrome.contextMenus.create({ id: `ais_ask_${p.id}`, parentId: "ais_root", title: `Ask ${p.label}`, contexts: ["selection"] });
    }
    chrome.contextMenus.create({ id: "ais_sep2", parentId: "ais_root", type: "separator", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "ais_ask_all", parentId: "ais_root", title: "Ask all AIs (fan-out)", contexts: ["selection"] });
  });
}
chrome.runtime.onInstalled.addListener(buildMenus);
chrome.runtime.onStartup.addListener(buildMenus);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.customProviders) buildMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = (info.selectionText || "").trim();
  if (!text || !tab) return;
  const source = { url: tab.url, title: tab.title };

  if (info.menuItemId === "ais_open_composer") {
    chrome.tabs.sendMessage(tab.id, { type: "OPEN_COMPOSER", text }).catch(() => {});
    return;
  }
  if (info.menuItemId === "ais_ask_all") {
    const providers = await getAllProviderRefs();
    dispatch(tab.id, tab.windowId, providers.map((p) => p.id), text, source);
    return;
  }
  const match = /^ais_ask_(.+)$/.exec(String(info.menuItemId));
  if (match) dispatch(tab.id, tab.windowId, [match[1]], text, source);
});

// ---------- prompt dispatch ----------
// Prompts are scoped per browser window: the `last_<windowId>` key in
// chrome.storage.session is read only by the panel running in that window,
// so opening a fresh side panel in another window won't replay it.

function dispatch(tabId, windowId, aiIds, text, source) {
  const ts = Date.now();
  const stash = {};
  stash[`last_${windowId}`] = { aiId: aiIds[0], aiIds, text, source, ts, windowId };
  for (const id of aiIds) stash[`pending_${id}`] = { text, source, ts, windowId };
  chrome.storage.session.set(stash);

  if (tabId != null) {
    try { chrome.sidePanel.setOptions({ tabId, path: "panel.html", enabled: true }); } catch (_) {}
    chrome.sidePanel.open({ tabId }).catch(async (err) => {
      try {
        const t = await chrome.tabs.get(tabId);
        await chrome.sidePanel.open({ windowId: t.windowId });
      } catch (e2) { console.warn("sidePanel.open failed", err, e2); }
    });
  }
  // Notify any already-open panel; it filters by windowId so only the
  // originating window's panel reacts.
  chrome.runtime.sendMessage({ type: "PANEL_LOAD", aiIds, text, source, windowId }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "ASK_AI") {
    const aiIds = Array.isArray(msg.aiIds) ? msg.aiIds : [msg.aiId];
    const tabId = sender.tab && sender.tab.id;
    const winId = sender.tab && sender.tab.windowId;
    const source = msg.source || (sender.tab ? { url: sender.tab.url, title: sender.tab.title } : null);
    dispatch(tabId, winId, aiIds, msg.text, source);
    sendResponse({ ok: true });
    return;
  }

  if (msg.type === "SAVE_ANSWER") {
    saveEntry(msg.entry).then((entry) => sendResponse({ ok: true, entry }));
    return true;
  }

  if (msg.type === "REGISTER_CUSTOM_PROVIDER") {
    registerCustomProvider(msg.provider).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "UNREGISTER_CUSTOM_PROVIDER") {
    unregisterCustomProvider(msg.providerId).then(() => sendResponse({ ok: true })).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "OPEN_PICKER") {
    openPicker(msg.url, msg.field).then((res) => sendResponse(res)).catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }
  if (msg.type === "PICKER_RESULT") {
    // Forward to the options page (and anything else listening)
    chrome.runtime.sendMessage({ type: "PICKER_RESULT_BROADCAST", field: msg.field, selector: msg.selector }).catch(() => {});
  }
});

// ---------- notebook persistence ----------

async function saveEntry(entry) {
  const id = (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const { notebook_entries = [], currentSessionId } = await chrome.storage.local.get(["notebook_entries", "currentSessionId"]);
  const full = {
    id,
    sessionId: entry.sessionId || currentSessionId || "default",
    aiId: entry.aiId,
    prompt: entry.prompt || "",
    answer: entry.answer || "",
    sourceUrl: entry.sourceUrl || "",
    sourceTitle: entry.sourceTitle || "",
    ts: Date.now()
  };
  notebook_entries.unshift(full);
  await chrome.storage.local.set({ notebook_entries });
  chrome.runtime.sendMessage({ type: "NOTEBOOK_UPDATED" }).catch(() => {});
  return full;
}

chrome.runtime.onInstalled.addListener(async () => {
  const { notebook_sessions, currentSessionId } = await chrome.storage.local.get(["notebook_sessions", "currentSessionId"]);
  if (!notebook_sessions || notebook_sessions.length === 0) {
    await chrome.storage.local.set({
      notebook_sessions: [{ id: "default", name: "Default", createdAt: Date.now() }],
      currentSessionId: currentSessionId || "default"
    });
  }
  // Re-register any custom providers from storage on install/upgrade
  const { customProviders = [] } = await chrome.storage.local.get("customProviders");
  for (const p of customProviders) {
    try { await registerCustomProvider(p, { skipStorageWrite: true }); } catch (_) {}
  }
});

// ---------- custom provider registration ----------

function ruleIdFor(providerId) {
  // Deterministic integer in [1000, 1_000_000_000] from string
  let h = 0;
  for (let i = 0; i < providerId.length; i++) h = (h * 31 + providerId.charCodeAt(i)) | 0;
  return 1000 + Math.abs(h % 999_000_000);
}

async function registerCustomProvider(provider) {
  const host = new URL(provider.url).hostname;
  const ruleId = ruleIdFor(provider.id);

  // Dynamic DNR rule: strip frame-blocking headers for this host
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [ruleId],
    addRules: [{
      id: ruleId,
      priority: 1,
      action: {
        type: "modifyHeaders",
        responseHeaders: [
          { header: "x-frame-options", operation: "remove" },
          { header: "content-security-policy", operation: "remove" },
          { header: "content-security-policy-report-only", operation: "remove" },
          { header: "permissions-policy", operation: "remove" },
          { header: "cross-origin-opener-policy", operation: "remove" },
          { header: "cross-origin-embedder-policy", operation: "remove" },
          { header: "cross-origin-resource-policy", operation: "remove" }
        ]
      },
      condition: {
        requestDomains: [host],
        resourceTypes: ["sub_frame", "main_frame"]
      }
    }]
  });

  // Register injector content script for this host
  const scriptId = `ais_injector_${provider.id}`;
  try { await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }); } catch (_) {}
  await chrome.scripting.registerContentScripts([{
    id: scriptId,
    matches: [`*://${host}/*`],
    js: ["lib/ais.js", "injector.js"],
    runAt: "document_idle",
    allFrames: true
  }]);
}

async function unregisterCustomProvider(providerId) {
  const ruleId = ruleIdFor(providerId);
  try { await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] }); } catch (_) {}
  const scriptId = `ais_injector_${providerId}`;
  try { await chrome.scripting.unregisterContentScripts({ ids: [scriptId] }); } catch (_) {}
}

// ---------- element picker ----------

async function openPicker(url, field) {
  const tab = await chrome.tabs.create({ url, active: true });
  // Wait for the tab to finish loading, then inject the picker overlay.
  return new Promise((resolve) => {
    function listener(tabId, info) {
      if (tabId !== tab.id || info.status !== "complete") return;
      chrome.tabs.onUpdated.removeListener(listener);
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: ["picker.js"]
      }).then(() => {
        // Tell the picker which field to associate with the click
        chrome.tabs.sendMessage(tab.id, { type: "PICKER_INIT", field }).catch(() => {});
        resolve({ ok: true, tabId: tab.id });
      }).catch((e) => resolve({ ok: false, error: String(e) }));
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}
