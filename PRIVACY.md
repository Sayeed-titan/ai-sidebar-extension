# AI Sidebar — Privacy Policy

_Last updated: 2026-05-29_

## Summary

**AI Sidebar does not collect, transmit, sell, or share any of your data.** Everything the extension stores stays in your own browser.

## What the extension stores locally

The extension uses Chrome's `storage.local` and `storage.session` APIs — these are local to your browser profile, on your machine. We store:

- **Text you select and prompts you compose**, briefly, so they can be delivered to the AI iframe inside the side panel. These are cleared once the prompt is submitted.
- **Saved notebook entries** — answers you explicitly click "Save to notebook" on, along with the original prompt and the URL/title of the page you started from. These persist until you delete them or uninstall the extension.
- **Notebook sessions** — names of research sessions you create.
- **Preferences** — last-used AI selection, panel mode (single/split/notebook), and per-pane heights.
- **Custom AI providers** you add via the Options page, if any.

## What we do *not* collect

- We do not have any server. The extension is entirely client-side.
- We do not send your prompts, answers, browsing data, or any personally identifiable information to the extension authors or any third party.
- We do not use analytics, telemetry, crash reporters, or remote logging.

## Where your prompts actually go

When you send a prompt to ChatGPT, Claude, Perplexity, Gemini, or any custom AI you've added, **the prompt is sent directly to that AI's website**, using your existing logged-in session in your browser. The extension acts as a typist — it pastes your prompt into the AI's input field and clicks send.

Whatever data those AI providers collect is governed by **their** privacy policies, not ours.

## Permissions, in plain English

- **`<all_urls>` host access** — so the "Search with AI Sidebar" pill can appear when you select text on any page.
- **`storage`** — to save your notebook and preferences locally.
- **`sidePanel`** — to open the browser's side panel where the AIs render.
- **`scripting`** — to inject the prompt-typing helper into the AI sites loaded inside the panel.
- **`declarativeNetRequest`** — to remove the `X-Frame-Options` / `Content-Security-Policy` headers from the AI providers' responses so they can render inside the side panel iframe. Applied only to whitelisted AI domains.
- **`contextMenus`** — to add the right-click "Ask <AI>" menu.
- **`tabs`** — to know which browser window the side panel belongs to (so opening it in one window doesn't replay another window's prompt).

## Contact

Questions or concerns: open an issue at https://github.com/Sayeed-titan/ai-sidebar-extension

## Changes

If this policy ever changes, the updated date above will reflect that. Material changes will be noted in the extension's release notes.
