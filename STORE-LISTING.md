# Chrome Web Store — Submission Copy

Everything you need to paste into the Chrome Web Store developer dashboard.

---

## Item name (max 75 chars)

```
AI Sidebar — Ask Multiple AIs, Side by Side
```

## Short description (max 132 chars)

```
Select text on any page, ask ChatGPT, Claude, Perplexity & Gemini at once in the browser's side panel. Save & compare answers.
```

## Category

Productivity (primary) · Developer Tools (secondary, optional)

## Language

English (United States)

---

## Detailed description (markdown supported)

```
AI Sidebar turns your browser's side panel into a research workbench for talking to multiple AIs at once — without leaving the page you're reading.

━━━━━━━━━━━━━━━━━━━━━━
HOW IT WORKS
━━━━━━━━━━━━━━━━━━━━━━

1. Highlight any text on any web page.
2. Click the "Search with AI Sidebar" pill that appears.
3. Pick one or more AIs (ChatGPT, Claude, Perplexity, Gemini, or any you add yourself), edit your prompt, hit Send.
4. The side panel opens with each AI rendered in its own pane, your prompt already typed and submitted.

━━━━━━━━━━━━━━━━━━━━━━
WHY IT'S DIFFERENT
━━━━━━━━━━━━━━━━━━━━━━

• Uses your existing logged-in sessions. No API keys, no separate accounts, no paid tier.
• Three view modes: Single (one AI), Split (resizable stacked panes), Notebook (saved answers).
• Right-click any selected text: "Ask <AI>" or "Ask all AIs (fan-out)".
• Save the best answers to a notebook scoped per research session. Export to Markdown.
• Synthesize: pick two or more saved answers, get a structured comparison from any AI of your choice — consensus, disagreements, claims to verify.
• Add any custom AI. The Options page has a visual element picker — click the prompt input on the AI's page, click the send button, done.
• Per-window scope: the panel in one browser window doesn't replay another window's prompt.

━━━━━━━━━━━━━━━━━━━━━━
PRIVACY
━━━━━━━━━━━━━━━━━━━━━━

Nothing leaves your browser except prompts you explicitly send to AI providers (which then go directly to their sites, using your own session). The extension has no server. No analytics. No tracking.

Full privacy policy: https://github.com/Sayeed-titan/ai-sidebar-extension/blob/main/PRIVACY.md

━━━━━━━━━━━━━━━━━━━━━━
OPEN SOURCE
━━━━━━━━━━━━━━━━━━━━━━

MIT-licensed. Source, issues, and contributions:
https://github.com/Sayeed-titan/ai-sidebar-extension
```

---

## Permissions justifications

The reviewer will ask for these. Paste each into the matching dashboard field.

### `<all_urls>` host permission

> The "Search with AI Sidebar" pill and composer must appear when the user highlights text on any web page. The content script that renders them needs to run on arbitrary URLs — there is no narrower scope that delivers the core feature.

### `activeTab`

> Used so the side panel can be opened on the active tab in response to the user's click on the pill or context menu, and so the source page URL/title can be attached to saved notebook entries.

### `storage`

> Used to persist the user's saved notebook entries, research sessions, panel mode/pane heights, and custom AI provider list — all in local browser storage. Nothing is sent off-device.

### `sidePanel`

> The extension's primary UI lives in the browser's side panel.

### `scripting`

> Used to inject a typing/submission helper into AI provider pages loaded inside the side panel iframe (e.g. ChatGPT, Claude, Gemini), and to inject a selector-picker overlay into a tab when the user is adding a custom AI in Options.

### `declarativeNetRequest`

> Strips `X-Frame-Options` and `Content-Security-Policy` response headers ONLY for the user's chosen AI domains (chatgpt.com, claude.ai, gemini.google.com, and any custom AI the user explicitly adds). Without this, those AI providers refuse to render inside the side panel iframe, which is the extension's core function.

### `contextMenus`

> Adds an "AI Sidebar" submenu to the right-click menu when text is selected: "Ask ChatGPT", "Ask Claude", "Ask all AIs (fan-out)", etc.

### `tabs`

> Used to read the active tab's URL/title when capturing the source of a saved notebook entry, and to identify which browser window the side panel belongs to so prompts are scoped per window.

### Remote code use

> **None.** The extension contains no remote code execution. All scripts are bundled and reviewed.

---

## Screenshots needed (1280×800 or 640×400, JPG/PNG, up to 5)

Take screenshots of, in order:

1. **The selection pill** — highlight some text on a Wikipedia-ish article, show the "Search with AI Sidebar" pill floating below.
2. **The composer** — open with the pill, show all chips selected (ChatGPT + Claude + Gemini), prompt text in the box, "Send to 3 AIs" button.
3. **Split mode in the side panel** — show three AI panes stacked, each with a streaming response, drag handle visible.
4. **Notebook mode** — show 3–5 saved entries from different AIs, two checked, the sticky synthesize bar visible.
5. **Options page** — custom AI manager with the "Add Custom AI" modal open and the selector-picker active in a background tab.

## Promo tile (440×280, optional but recommended)

Simple: brand teal-to-navy gradient with the "AI" mark in white and the tagline *"Ask every AI. Without leaving the page."*

---

## Single-purpose justification

> AI Sidebar exists to let users send the same prompt to multiple AI chat services from the browser's side panel and collect answers in one place. Every feature serves that purpose: the selection pill triggers a prompt; the side panel hosts the AIs; the notebook saves answers; the synthesize feature compares them.

---

## Submission steps (when ready)

1. Pay the $5 one-time dev fee at https://chrome.google.com/webstore/devconsole/register
2. Click "New Item", upload `ai-sidebar-v1.0.0.zip` (built by the release script).
3. Fill in the fields above.
4. Upload icon (128×128) and screenshots.
5. Set distribution to **Public** (or **Unlisted** if you want a private install URL).
6. Submit for review.

Typical review time: 1–3 days for a new extension. Once approved, you'll get a permanent install URL of the form:
`https://chromewebstore.google.com/detail/ai-sidebar/<extension-id>`

That URL works in Chrome, **Edge**, Brave, Opera, Vivaldi — anywhere with Chrome Web Store access. One click → installed.
