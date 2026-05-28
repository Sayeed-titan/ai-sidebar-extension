// Provider config. Built-in list is hard-coded; custom providers come from
// chrome.storage.local.customProviders and are merged in at runtime.

const BUILTIN_PROVIDERS = [
  {
    id: "chatgpt",
    label: "ChatGPT",
    color: "#10a37f",
    url: "https://chatgpt.com/",
    origins: ["chatgpt.com", "chat.openai.com"],
    builtin: true,
    logo: { monogram: "G" },
    selectors: {
      input: [
        "#prompt-textarea",
        "div#prompt-textarea[contenteditable='true']",
        "div.ProseMirror[contenteditable='true']",
        "div[contenteditable='true'][data-virtualkeyboard]",
        "textarea[data-id]"
      ],
      send: [
        "button[data-testid='send-button']",
        "button[aria-label*='Send' i]",
        "button[type='submit']"
      ],
      assistantMessage: ["[data-message-author-role='assistant']"]
    }
  },
  {
    id: "claude",
    label: "Claude",
    color: "#cc785c",
    // Bare origin — /new sometimes redirects to a stale conversation id.
    url: "https://claude.ai/",
    origins: ["claude.ai"],
    builtin: true,
    logo: { monogram: "C" },
    selectors: {
      input: [
        "div.ProseMirror[contenteditable='true']",
        "div[contenteditable='true'][role='textbox']",
        "fieldset div[contenteditable='true']",
        "div[contenteditable='true']"
      ],
      send: [
        "button[aria-label='Send Message']",
        "button[aria-label*='Send' i]",
        "button[type='submit']"
      ],
      assistantMessage: [
        "div[data-testid='assistant-turn']",
        "div.font-claude-message",
        "div.font-claude-response"
      ]
    }
  },
  {
    id: "perplexity",
    label: "Perplexity",
    color: "#20808d",
    url: "https://www.perplexity.ai/",
    origins: ["www.perplexity.ai", "perplexity.ai"],
    builtin: true,
    // Perplexity ships frame-buster JS that we can't reliably disable from
    // outside the page. Open in a new tab instead — their site honors ?q=.
    noIframe: true,
    tabPromptParam: "q",
    logo: { monogram: "P" },
    selectors: {
      input: ["textarea[placeholder*='Ask' i]", "textarea"],
      send: ["button[aria-label*='Submit' i]", "button[aria-label*='Send' i]"],
      assistantMessage: ["div[id^='markdown-content']", "div.prose"]
    }
  },
  {
    id: "gemini",
    label: "Gemini",
    color: "#4285f4",
    url: "https://gemini.google.com/app",
    origins: ["gemini.google.com"],
    builtin: true,
    logo: { monogram: "G" },
    selectors: {
      input: [
        "rich-textarea .ql-editor[contenteditable='true']",
        "rich-textarea div[contenteditable='true']",
        ".ql-editor[contenteditable='true']",
        "div[contenteditable='true'][role='textbox']",
        "div.text-input-field div[contenteditable='true']",
        "div[contenteditable='true']",
        "textarea"
      ],
      send: [
        "button[aria-label*='Send' i]",
        "button[aria-label*='submit' i]",
        "button.send-button",
        "button[mat-icon-button][aria-label*='Send' i]",
        "button.mdc-icon-button[aria-label*='Send' i]"
      ],
      assistantMessage: ["message-content", "div.model-response-text", "div.markdown"]
    }
  }
];

let CUSTOM_PROVIDERS = [];

function allProviders() { return [...BUILTIN_PROVIDERS, ...CUSTOM_PROVIDERS]; }
function aiForOrigin(host) { return allProviders().find((a) => (a.origins || []).includes(host)); }

function publish() {
  const all = allProviders();
  if (typeof window !== "undefined") {
    window.AI_PROVIDERS = all;
    window.BUILTIN_PROVIDERS = BUILTIN_PROVIDERS;
    window.aiForOrigin = aiForOrigin;
  }
  if (typeof self !== "undefined") {
    self.AI_PROVIDERS = all;
    self.BUILTIN_PROVIDERS = BUILTIN_PROVIDERS;
    self.aiForOrigin = aiForOrigin;
  }
}

publish();

if (typeof chrome !== "undefined" && chrome.storage) {
  chrome.storage.local.get("customProviders").then((data) => {
    CUSTOM_PROVIDERS = data.customProviders || [];
    publish();
    if (typeof window !== "undefined" && typeof window.onProvidersReady === "function") {
      try { window.onProvidersReady(); } catch (_) {}
    }
  });
  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.customProviders) return;
      CUSTOM_PROVIDERS = changes.customProviders.newValue || [];
      publish();
    });
  }
}
