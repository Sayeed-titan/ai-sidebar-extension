// Selection pill + composer popover. Rebuilt from v0.5's proven flow,
// dressed with the v0.6 light design.
(() => {
  let pill = null;
  let composer = null;
  let lastRect = null;

  function remove(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  function closeAll() { remove(pill); remove(composer); pill = null; composer = null; }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function showPill(rect, text) {
    remove(pill);
    pill = document.createElement("div");
    pill.className = "ais-pill-wrap";
    pill.style.left = `${window.scrollX + rect.left}px`;
    pill.style.top = `${window.scrollY + rect.bottom + 6}px`;
    pill.innerHTML = `
      <button class="ais-pill" type="button">
        <span class="ais-caret"></span>
        <span class="ais-pill-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
            <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>
          </svg>
        </span>
        Search with AI Sidebar
      </button>
    `;
    pill.querySelector(".ais-pill").addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openComposer(rect, text);
    });
    document.documentElement.appendChild(pill);
  }

  function openComposer(rect, text) {
    remove(pill); pill = null;
    remove(composer);
    composer = document.createElement("div");
    composer.className = "ais-composer-wrap";

    const left = Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 400);
    const top = window.scrollY + rect.bottom + 8;
    composer.style.left = `${Math.max(8, left)}px`;
    composer.style.top = `${top}px`;

    const pageTitle = (document.title || location.hostname).slice(0, 60);

    composer.innerHTML = `
      <div class="ais-composer">
        <span class="ais-caret"></span>
        <div class="ais-composer-head">
          <span class="ais-composer-label">Ask</span>
          <span class="ais-composer-src"><span class="ais-src-dot"></span><span>${escapeHtml(pageTitle)}</span></span>
          <button class="ais-composer-close" type="button" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div class="ais-chip-row"></div>
        <textarea class="ais-textarea" rows="4" placeholder="Edit or add to your prompt…"></textarea>
        <div class="ais-composer-foot">
          <div class="ais-hint"><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline</div>
          <button class="ais-send" type="button">
            <span class="ais-send-label">Send</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
          </button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(composer);

    const chipsEl = composer.querySelector(".ais-chip-row");
    const sendBtn = composer.querySelector(".ais-send");
    const sendLabel = composer.querySelector(".ais-send-label");
    const closeBtn = composer.querySelector(".ais-composer-close");
    const textarea = composer.querySelector(".ais-textarea");

    // Seed selection with first provider so Send is enabled immediately.
    const providers = (window.AI_PROVIDERS && window.AI_PROVIDERS.length)
      ? window.AI_PROVIDERS
      : [{ id: "chatgpt", label: "ChatGPT", color: "#10a37f" }];
    const selected = new Set([providers[0].id]);

    function updateSendLabel() {
      const n = selected.size;
      sendLabel.textContent = n <= 1 ? "Send" : `Send to ${n} AIs`;
    }

    function renderChips() {
      // DOM-API construction with hard inline styles so no host-page CSS
      // or framework reset can hide these chips.
      chipsEl.innerHTML = "";
      chipsEl.setAttribute("style", "display:flex !important;flex-wrap:wrap;gap:6px;padding:10px 14px 12px;border-bottom:1px solid #eef2f6;min-height:36px;");
      const list = (window.AI_PROVIDERS && window.AI_PROVIDERS.length) ? window.AI_PROVIDERS : providers;
      for (const ai of list) {
        const isOn = selected.has(ai.id);
        const chip = document.createElement("button");
        chip.type = "button";
        chip.setAttribute("style",
          "all:unset;cursor:pointer;display:inline-flex !important;align-items:center;gap:6px;" +
          "padding:5px 10px 5px 9px;font:600 12px/1.2 'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;" +
          "color:" + (isOn ? "#0f2340" : "#334155") + ";" +
          "background:" + (isOn ? "#e6f1f4" : "#ffffff") + ";" +
          "border:1px solid " + (isOn ? "#9ec5d2" : "#e2e8f0") + ";" +
          "border-radius:999px;transition:all 120ms ease;"
        );

        const dot = document.createElement("span");
        dot.setAttribute("style", "width:8px;height:8px;border-radius:50%;flex:none;background:" + ai.color + ";");
        chip.appendChild(dot);

        const label = document.createElement("span");
        label.textContent = ai.label;
        chip.appendChild(label);

        if (isOn) {
          const tick = document.createElement("span");
          tick.textContent = "✓";
          tick.setAttribute("style",
            "width:14px;height:14px;border-radius:50%;background:#0a7d9a;color:#fff;" +
            "display:inline-flex;align-items:center;justify-content:center;" +
            "font-size:9px;font-weight:800;margin-left:-2px;"
          );
          chip.appendChild(tick);
        }

        chip.addEventListener("click", (e) => {
          e.preventDefault();
          if (selected.has(ai.id)) selected.delete(ai.id);
          else selected.add(ai.id);
          if (selected.size === 0) selected.add(ai.id);
          chrome.storage.local.set({ lastSelectedAis: [...selected] });
          renderChips();
          updateSendLabel();
        });
        chipsEl.appendChild(chip);
      }
    }

    // Pull last-used selection if available, otherwise keep the seeded default.
    chrome.storage.local.get("lastSelectedAis").then((data) => {
      const stored = (data && data.lastSelectedAis) || [];
      const valid = stored.filter((id) => (window.AI_PROVIDERS || []).some((a) => a.id === id));
      if (valid.length) {
        selected.clear();
        valid.forEach((id) => selected.add(id));
        renderChips();
        updateSendLabel();
      }
    });

    renderChips();
    updateSendLabel();

    textarea.value = text;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 0);

    function send() {
      const finalText = textarea.value.trim();
      if (!finalText || selected.size === 0) return;
      chrome.runtime.sendMessage({
        type: "ASK_AI",
        aiIds: [...selected],
        text: finalText,
        source: { url: location.href, title: document.title }
      });
      closeAll();
    }

    sendBtn.addEventListener("click", (e) => { e.preventDefault(); send(); });
    closeBtn.addEventListener("click", (e) => { e.preventDefault(); closeAll(); });
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
      else if (e.key === "Escape") closeAll();
    });
  }

  document.addEventListener("mouseup", (e) => {
    if ((pill && pill.contains(e.target)) || (composer && composer.contains(e.target))) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text) { if (!composer) closeAll(); return; }
      const range = sel.getRangeAt(0);
      lastRect = range.getBoundingClientRect();
      if (!composer) showPill(lastRect, text);
    }, 0);
  });

  document.addEventListener("mousedown", (e) => {
    if (pill && !pill.contains(e.target)) { remove(pill); pill = null; }
    if (composer && !composer.contains(e.target)) closeAll();
  });

  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "OPEN_COMPOSER" && msg.text) {
      const sel = window.getSelection();
      let rect = null;
      if (sel && sel.rangeCount) rect = sel.getRangeAt(0).getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
        rect = { left: 40, bottom: 40, top: 40, right: 40, width: 0, height: 0 };
      }
      openComposer(rect, msg.text);
    }
  });
})();
