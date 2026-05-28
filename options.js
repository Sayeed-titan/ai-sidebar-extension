const builtinList = document.getElementById("builtin-list");
const customList = document.getElementById("custom-list");
const addBtn = document.getElementById("add-custom");
const editor = document.getElementById("editor");
const fLabel = document.getElementById("f-label");
const fColor = document.getElementById("f-color");
const fUrl = document.getElementById("f-url");
const fInput = document.getElementById("f-input");
const fSend = document.getElementById("f-send");
const fMsg = document.getElementById("f-msg");
const pickStatus = document.getElementById("pick-status");
const saveBtn = document.getElementById("editor-save");
const cancelBtn = document.getElementById("editor-cancel");
const editorTitle = document.getElementById("editor-title");

let editingId = null;

function render() {
  builtinList.innerHTML = "";
  for (const p of window.BUILTIN_PROVIDERS) {
    builtinList.appendChild(renderItem(p, false));
  }
  customList.innerHTML = "";
  const customs = window.AI_PROVIDERS.filter((p) => !p.builtin);
  if (customs.length === 0) {
    customList.innerHTML = `<li class="provider" style="color:#888; border-left-color:#ddd;">No custom AIs yet. Click "+ Add Custom AI" to add one.</li>`;
  } else {
    for (const p of customs) customList.appendChild(renderItem(p, true));
  }
}

function renderItem(p, editable) {
  const li = document.createElement("li");
  li.className = "provider";
  li.style.setProperty("--accent", p.color);
  const host = (() => { try { return new URL(p.url).hostname; } catch { return ""; } })();
  li.innerHTML = `
    <span class="name">${escapeHtml(p.label)}</span>
    <span class="host">${escapeHtml(host)}</span>
  `;
  if (editable) {
    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openEditor(p));
    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "danger";
    del.addEventListener("click", () => deleteProvider(p.id));
    li.appendChild(edit);
    li.appendChild(del);
  }
  return li;
}

function openEditor(existing) {
  editingId = existing ? existing.id : null;
  editorTitle.textContent = existing ? "Edit Custom AI" : "Add Custom AI";
  fLabel.value = existing ? existing.label : "";
  fColor.value = existing ? existing.color : "#888888";
  fUrl.value = existing ? existing.url : "";
  fInput.value = existing ? (existing.selectors.input || [])[0] || "" : "";
  fSend.value = existing ? (existing.selectors.send || [])[0] || "" : "";
  fMsg.value = existing ? (existing.selectors.assistantMessage || [])[0] || "" : "";
  pickStatus.textContent = "";
  editor.showModal();
}

addBtn.addEventListener("click", () => openEditor(null));
cancelBtn.addEventListener("click", () => editor.close());

saveBtn.addEventListener("click", async () => {
  if (!fLabel.value || !fUrl.value || !fInput.value || !fSend.value) {
    pickStatus.textContent = "Name, URL, prompt input, and send selectors are required.";
    return;
  }
  try { new URL(fUrl.value); } catch {
    pickStatus.textContent = "URL is not valid.";
    return;
  }

  const id = editingId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const host = new URL(fUrl.value).hostname;
  const provider = {
    id,
    label: fLabel.value.trim(),
    color: fColor.value,
    url: fUrl.value.trim(),
    origins: [host],
    selectors: {
      input: [fInput.value.trim()],
      send: [fSend.value.trim()],
      assistantMessage: fMsg.value.trim() ? [fMsg.value.trim()] : []
    }
  };

  const { customProviders = [] } = await chrome.storage.local.get("customProviders");
  const next = editingId
    ? customProviders.map((p) => (p.id === editingId ? provider : p))
    : [...customProviders, provider];
  await chrome.storage.local.set({ customProviders: next });

  // Register dynamic DNR + content script for this provider
  const resp = await chrome.runtime.sendMessage({ type: "REGISTER_CUSTOM_PROVIDER", provider });
  if (!resp || !resp.ok) {
    pickStatus.textContent = "Saved but failed to register: " + (resp && resp.error);
  }

  editor.close();
  setTimeout(render, 100); // wait for storage broadcast to update window.AI_PROVIDERS
});

async function deleteProvider(id) {
  if (!confirm("Delete this custom AI?")) return;
  const { customProviders = [] } = await chrome.storage.local.get("customProviders");
  const next = customProviders.filter((p) => p.id !== id);
  await chrome.storage.local.set({ customProviders: next });
  await chrome.runtime.sendMessage({ type: "UNREGISTER_CUSTOM_PROVIDER", providerId: id });
  setTimeout(render, 100);
}

// Picker integration
document.querySelectorAll("button.pick").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (!fUrl.value) { pickStatus.textContent = "Enter the AI's URL first."; return; }
    const field = btn.dataset.field;
    pickStatus.textContent = `Opening ${fUrl.value} — click the ${labelForField(field)}. Return here when done.`;
    chrome.runtime.sendMessage({ type: "OPEN_PICKER", url: fUrl.value, field });
  });
});

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "PICKER_RESULT_BROADCAST") {
    const map = { input: fInput, send: fSend, assistantMessage: fMsg };
    const el = map[msg.field];
    if (el) {
      el.value = msg.selector;
      pickStatus.textContent = `Captured ${labelForField(msg.field)}: ${msg.selector}`;
    }
  }
});

function labelForField(f) {
  if (f === "input") return "prompt input box";
  if (f === "send") return "send button";
  if (f === "assistantMessage") return "an assistant reply container";
  return f;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

window.onProvidersReady = render;
render();
