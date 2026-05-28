// Injected on demand by background.openPicker into an AI's tab.
// User hovers → highlights; clicks → captures a CSS selector; sends
// PICKER_RESULT back to the extension; removes overlay.

(() => {
  if (window.__aisPickerActive) return;
  window.__aisPickerActive = true;

  let field = "input";
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === "PICKER_INIT" && msg.field) field = msg.field;
  });

  const style = document.createElement("style");
  style.textContent = `
    .__ais-picker-highlight {
      outline: 2px solid #10a37f !important;
      outline-offset: 1px !important;
      cursor: crosshair !important;
    }
    .__ais-picker-banner {
      position: fixed; top: 0; left: 0; right: 0;
      z-index: 2147483647;
      background: #10a37f;
      color: #fff;
      padding: 10px 16px;
      font: 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-align: center;
      box-shadow: 0 2px 12px rgba(0,0,0,0.3);
    }
    .__ais-picker-banner button {
      margin-left: 12px;
      background: rgba(0,0,0,0.25);
      color: #fff;
      border: 0;
      border-radius: 4px;
      padding: 4px 10px;
      cursor: pointer;
    }
  `;
  document.documentElement.appendChild(style);

  const banner = document.createElement("div");
  banner.className = "__ais-picker-banner";
  banner.innerHTML = `<span>AI Sidebar: click the <b id="__ais-field-name">element</b> to capture its selector.</span><button id="__ais-cancel">Cancel</button>`;
  document.documentElement.appendChild(banner);
  document.getElementById("__ais-field-name").textContent = label(field);

  let hovered = null;

  function label(f) {
    if (f === "input") return "prompt input box";
    if (f === "send") return "send button";
    if (f === "assistantMessage") return "an assistant's reply container";
    return f;
  }

  function onMove(e) {
    const el = e.target;
    if (el === banner || banner.contains(el)) return;
    if (hovered === el) return;
    if (hovered) hovered.classList.remove("__ais-picker-highlight");
    hovered = el;
    hovered.classList.add("__ais-picker-highlight");
  }

  function onClick(e) {
    const el = e.target;
    if (el === banner || banner.contains(el)) return;
    e.preventDefault();
    e.stopPropagation();
    const selector = buildSelector(el);
    chrome.runtime.sendMessage({ type: "PICKER_RESULT", field, selector });
    cleanup();
  }

  function cancel() { cleanup(); }

  function cleanup() {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    if (hovered) hovered.classList.remove("__ais-picker-highlight");
    banner.remove();
    style.remove();
    window.__aisPickerActive = false;
  }

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.getElementById("__ais-cancel").addEventListener("click", cancel);

  function buildSelector(el) {
    if (el.id) return `#${cssEscape(el.id)}`;
    const testid = el.getAttribute("data-testid");
    if (testid) return `[data-testid="${cssEscape(testid)}"]`;
    if (el.tagName === "TEXTAREA") {
      const ph = el.getAttribute("placeholder");
      if (ph) return `textarea[placeholder="${cssEscape(ph)}"]`;
      return "textarea";
    }
    if (el.tagName === "BUTTON") {
      const al = el.getAttribute("aria-label");
      if (al) return `button[aria-label="${cssEscape(al)}"]`;
    }
    if (el.isContentEditable) {
      // Try unique data-* attributes
      for (const attr of el.attributes) {
        if (attr.name.startsWith("data-") && document.querySelectorAll(`[${attr.name}="${cssEscape(attr.value)}"]`).length === 1) {
          return `[${attr.name}="${cssEscape(attr.value)}"]`;
        }
      }
      return "div[contenteditable='true']";
    }
    if (typeof el.className === "string" && el.className.trim()) {
      const cls = el.className.split(/\s+/).filter(Boolean)[0];
      if (cls) {
        const sel = `${el.tagName.toLowerCase()}.${cssEscape(cls)}`;
        if (document.querySelectorAll(sel).length <= 5) return sel;
      }
    }
    return el.tagName.toLowerCase();
  }

  function cssEscape(s) {
    if (window.CSS && CSS.escape) return CSS.escape(s);
    return String(s).replace(/(["\\])/g, "\\$1");
  }
})();
