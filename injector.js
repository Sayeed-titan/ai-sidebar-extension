// Runs inside each AI provider's page (including inside the side-panel iframe).
// Responsibilities:
//   1. Find pending prompts in chrome.storage.session, paste them into the
//      AI's input box, click send. Visible status banner so a stuck submission
//      is obvious — and a Retry button if it fails.
//   2. Inject "Save to notebook" on every assistant message.

(() => {
  const ai = window.aiForOrigin(location.hostname);
  if (!ai) return;

  const key = `pending_${ai.id}`;
  let lastPrompt = "";
  let lastSource = { url: "", title: "" };
  let submitting = false;

  // ===== status banner =====
  const banner = document.createElement("div");
  banner.style.cssText = `
    position:fixed; top:8px; left:50%; transform:translateX(-50%);
    z-index:2147483647; background:#0f2340; color:#fff;
    padding:6px 12px 6px 10px; border-radius:999px;
    font:600 11.5px/1.2 'Plus Jakarta Sans', system-ui, sans-serif;
    box-shadow:0 6px 20px rgba(15,35,64,0.35);
    display:none; align-items:center; gap:8px;
  `;
  banner.innerHTML = `
    <span class="aisb-dot" style="width:8px;height:8px;border-radius:50%;background:#f3832d;animation:aisBlink 1s infinite"></span>
    <span class="aisb-text">AI Sidebar: typing your prompt…</span>
    <button class="aisb-retry" style="all:unset;cursor:pointer;color:#fff;background:rgba(255,255,255,0.18);padding:2px 8px;border-radius:4px;font-size:10.5px;font-weight:700;margin-left:4px;display:none">Retry</button>
  `;
  const styleNode = document.createElement("style");
  styleNode.textContent = `@keyframes aisBlink{50%{opacity:.3}}`;
  document.documentElement.appendChild(styleNode);
  document.documentElement.appendChild(banner);

  function setStatus(text, mode) {
    banner.style.display = "inline-flex";
    banner.querySelector(".aisb-text").textContent = text;
    const dot = banner.querySelector(".aisb-dot");
    const retry = banner.querySelector(".aisb-retry");
    if (mode === "error") {
      dot.style.background = "#b91c1c";
      retry.style.display = "inline-block";
    } else if (mode === "ok") {
      dot.style.background = "#10b981";
      retry.style.display = "none";
      setTimeout(() => { banner.style.display = "none"; }, 1500);
    } else {
      dot.style.background = "#f3832d";
      retry.style.display = "none";
    }
  }
  banner.querySelector(".aisb-retry").addEventListener("click", () => {
    if (lastPrompt) { submitting = false; submitPrompt(lastPrompt); }
  });

  // ===== prompt pickup =====
  chrome.storage.session.get(key).then((data) => {
    const pending = data && data[key];
    if (!pending || !pending.text) return;
    lastPrompt = pending.text;
    if (pending.source) lastSource = pending.source;
    submitPrompt(pending.text);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "session") return;
    const change = changes[key];
    if (!change || !change.newValue || !change.newValue.text) return;
    lastPrompt = change.newValue.text;
    if (change.newValue.source) lastSource = change.newValue.source;
    submitPrompt(change.newValue.text);
  });

  // Redundant delivery channel: panel posts the prompt directly into this
  // iframe's window. Works even if storage broadcast lags or races with
  // iframe boot. We dedupe by ts so the same prompt isn't fired twice.
  let lastTs = 0;
  window.addEventListener("message", (e) => {
    const m = e.data;
    if (!m || m.type !== "AISB_PROMPT" || m.aiId !== ai.id) return;
    if (!m.text || m.ts === lastTs) return;
    lastTs = m.ts;
    lastPrompt = m.text;
    if (m.source) lastSource = m.source;
    submitPrompt(m.text);
  });

  // Tell the panel we're alive so it can post to us.
  try { window.parent.postMessage({ type: "AISB_INJECTOR_READY", aiId: ai.id }, "*"); } catch (_) {}

  async function submitPrompt(text) {
    if (submitting) return;
    submitting = true;
    setStatus("AI Sidebar: finding the input…");

    const input = await waitForAny(ai.selectors.input, 15000);
    if (!input) {
      setStatus("Couldn't find the prompt input. Are you logged in?", "error");
      submitting = false;
      return;
    }

    setStatus("AI Sidebar: typing your prompt…");
    await setInputValue(input, text);

    setStatus("AI Sidebar: sending…");
    const sendBtn = await waitForAny(
      ai.selectors.send,
      6000,
      (el) => !el.disabled && el.getAttribute("aria-disabled") !== "true"
    );

    if (sendBtn) {
      sendBtn.click();
    } else {
      pressEnter(input);
    }

    await sleep(800);
    setStatus("Sent ✓", "ok");
    // Only NOW clear pending so a stuck submission can be retried via
    // re-issuing from the composer.
    chrome.storage.session.remove(key);
    submitting = false;
  }

  async function setInputValue(el, text) {
    el.focus();
    await sleep(40);
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
      setter.call(el, "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      setter.call(el, text);
      el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (!el.isContentEditable) return;
    try { document.execCommand("selectAll", false, null); } catch (_) {}
    try { document.execCommand("delete", false, null); } catch (_) {}
    let pasted = false;
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      const evt = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
      el.dispatchEvent(evt);
      pasted = evt.defaultPrevented || (el.textContent || "").includes(text);
    } catch (_) {}
    if (!pasted) { try { document.execCommand("insertText", false, text); } catch (_) {} }
    if (!(el.textContent || "").includes(text)) {
      el.textContent = text;
      el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, data: text, inputType: "insertText" }));
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function pressEnter(el) {
    const opts = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent("keydown", opts));
    el.dispatchEvent(new KeyboardEvent("keypress", opts));
    el.dispatchEvent(new KeyboardEvent("keyup", opts));
  }

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function waitForAny(selectors, timeout = 8000, predicate = null) {
    return new Promise((resolve) => {
      const deadline = Date.now() + timeout;
      const tryFind = () => {
        for (const sel of selectors) {
          let els = [];
          try { els = document.querySelectorAll(sel); } catch (_) {}
          for (const el of els) {
            if (!predicate || predicate(el)) return resolve(el);
          }
        }
        if (Date.now() > deadline) return resolve(null);
        requestAnimationFrame(tryFind);
      };
      tryFind();
    });
  }

  // ===== Save-to-notebook button injection =====
  injectSaveStyles();
  startMessageObserver();

  function injectSaveStyles() {
    const s = document.createElement("style");
    s.textContent = `
      .ais-save-btn {
        all: unset; cursor: pointer;
        display: inline-flex; align-items: center; gap: 6px;
        margin: 10px 0 0; padding: 5px 12px 5px 8px;
        font: 600 11.5px/1 'Plus Jakarta Sans', system-ui, sans-serif;
        color: #0a7d9a;
        background: color-mix(in srgb, #0a7d9a 6%, white);
        border: 1px dashed color-mix(in srgb, #0a7d9a 40%, #e2e8f0);
        border-radius: 999px;
        transition: all 120ms ease;
      }
      .ais-save-btn:hover { background: color-mix(in srgb, #0a7d9a 12%, white); }
      .ais-save-btn.saved { background:#dcfce7; color:#166534; border-style:solid; border-color:#86efac; }
      .ais-save-btn .glyph { display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; border-radius:50%; background:#0a7d9a; color:#fff; font-size:9px; font-weight:800; }
      .ais-save-btn.saved .glyph { background:#16a34a; }
    `;
    document.documentElement.appendChild(s);
  }

  function startMessageObserver() {
    const seen = new WeakSet();
    const attach = (root) => {
      const messages = (ai.selectors.assistantMessage || []).flatMap((s) => {
        try { return [...root.querySelectorAll(s)]; } catch { return []; }
      });
      for (const msg of messages) {
        if (seen.has(msg)) continue;
        seen.add(msg);
        addSaveButton(msg);
      }
    };
    attach(document.body);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) attach(n);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function addSaveButton(messageEl) {
    if (messageEl.querySelector(":scope > .ais-save-btn")) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ais-save-btn";
    btn.innerHTML = `<span class="glyph">+</span><span class="label">Save to notebook</span>`;
    btn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const answer = (messageEl.innerText || messageEl.textContent || "").trim();
      if (!answer) return;
      chrome.runtime.sendMessage({
        type: "SAVE_ANSWER",
        entry: { aiId: ai.id, prompt: lastPrompt, answer, sourceUrl: lastSource.url || "", sourceTitle: lastSource.title || "" }
      }, (resp) => {
        if (resp && resp.ok) {
          btn.classList.add("saved");
          btn.querySelector(".label").textContent = "Saved";
          setTimeout(() => { btn.classList.remove("saved"); btn.querySelector(".label").textContent = "Save to notebook"; }, 2000);
        }
      });
    });
    messageEl.appendChild(btn);
  }
})();
