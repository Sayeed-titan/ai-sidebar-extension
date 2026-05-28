# AI Sidebar

A Manifest V3 browser extension (Edge / Chrome) that turns the browser's side panel into a research workbench for talking to multiple AIs at once.

Select text on any page → pick which AIs to ask (ChatGPT, Claude, Perplexity, Gemini, or any you add yourself) → answers appear in the sidebar alongside the page. Save the good ones to a notebook, export sessions as Markdown, or have one AI synthesize the others' answers.

## Features

- **Selection pill + composer** — highlight text on any page, edit your prompt, multi-select AIs, send.
- **Side panel, three modes**
  - **Single** — one AI iframe fills the panel.
  - **Split** — every active AI stacks vertically; drag the handle between panes to resize; heights persist.
  - **Notebook** — saved answers, session-scoped, searchable, exportable.
- **Right-click context menu** — `Ask <AI>` or `Ask all AIs (fan-out)` on any selected text.
- **Save to notebook** button injected onto every assistant message in every AI.
- **Synthesize** — tick two or more saved answers, pick a target AI, get a structured comparison prompt (consensus / disagreements / verifiable claims / assessment).
- **Custom AIs** — options page with a visual element picker so you can point at any chat product's input + send button + assistant container and it just works.
- **Resilient prompt delivery** — dual channel (storage + `postMessage`) so the prompt actually lands in the AI's input even on slow loads or storage races.
- **Visible status banner** inside each AI iframe so a stuck submission is obvious, with a Retry button.

## Install (unpacked)

1. `edge://extensions` (or `chrome://extensions`)
2. Toggle **Developer mode**
3. **Load unpacked** → pick this folder
4. Pin the extension and make sure you're signed in to ChatGPT / Claude / Gemini in this browser profile — the sidebar uses your existing sessions.

## How it works (high level)

- A content script on every page renders the selection pill and composer.
- The composer sends `ASK_AI` to the background service worker, which stashes the prompt in `chrome.storage.session`, opens the side panel, and posts to the panel.
- The panel hosts one iframe per AI (lazy-created, persistent across tab switches).
- Inside each AI's page, an injector content script picks up the pending prompt — both via storage and via `iframe.contentWindow.postMessage` from the panel — pastes it into the AI's prompt box (works with React / Lexical / ProseMirror editors) and clicks send.
- A `declarativeNetRequest` ruleset strips `X-Frame-Options` / `CSP` headers so AI sites render inside the iframe.
- Perplexity (which ships frame-buster JS) opens in a new tab instead, with the prompt pre-filled via `?q=`.

## File layout

```
ai-sidebar-extension/
├── manifest.json           MV3 manifest
├── background.js           service worker — dispatch, context menus, notebook persistence
├── content.js              selection pill + composer on every page
├── content.css
├── injector.js             runs inside AI pages; submits prompts; injects Save buttons
├── panel.html              side panel shell
├── panel.css               light theme, tokens
├── panel.js                tabs, modes, iframes, notebook, synthesize, resize
├── options.html            custom AI manager
├── options.css
├── options.js
├── picker.js               element picker overlay (injected on demand)
├── rules.json              declarativeNetRequest: strip frame-blocking headers
└── lib/
    └── ais.js              provider config (built-in + custom, merged at runtime)
```

## Adding a custom AI

`edge://extensions` → AI Sidebar → **Extension options** → **+ Add Custom AI**

1. Name, color, URL.
2. **Pick from page** — opens the URL in a new tab with a picker overlay. Click the prompt input → captured. Click the send button → captured. Optional: click an assistant message container so "Save to notebook" can attach.
3. Save. The background dynamically registers a header-strip rule and content script for that origin — your custom AI now appears in the composer, panel tabs, context menu, and synthesizer dropdown.

## Selectors break sometimes

AI sites change DOM frequently. If submission stops working on one provider, edit its `selectors.input` / `selectors.send` array in `lib/ais.js` (built-in) or via the options page (custom). The injector tries each selector in order and uses the first match.

## License

MIT
