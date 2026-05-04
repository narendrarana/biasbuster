# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

BiasBuster is a Chrome extension (Manifest V3) that obfuscates political party names, politicians, and organizations on any web page, letting users engage with ideas without identity bias. Replacements are thematic (Fantasy, Sci-Fi, Food, Animals), consistent within a page session, and fully reversible via a toggle.

Full specification: `bias-buster-spec.md`

## Loading / Testing

This is a Chrome extension — no build step is required for plain JS. Load it as an unpacked extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select the project root

After making changes to background or content scripts, click **Reload** on the extension card. For popup/options changes, close and reopen the popup.

To test without an API key, select the **Mock** provider in Options — `mock-provider.js` returns a hardcoded entity map and requires no credentials.

## Build Order

The spec defines this sequence for implementation:

1. `manifest.json` + basic extension shell (permissions, content script registration for news sites)
2. `mock-provider.js` — hardcoded realistic entity map for fast local testing
3. DOM replacement engine + toggle (`content/content-script.js`)
4. Popup UI with theme selector (`popup/`)
5. One real LLM provider — start with `openai-provider.js` (`gpt-4o-mini`, cheapest)
6. Options page with provider/API key config (`options/`)
7. `claude-provider.js` and any additional providers

## Architecture

```
manifest.json                  # MV3, service_worker, content_scripts
background/service-worker.js   # API calls, session mapping cache
content/content-script.js      # DOM walk + text replacement, toggle
popup/                         # Enable/disable toggle, theme picker, entity count badge
options/                       # Provider selector, API key input, default theme, exclusion list
providers/
  provider-interface.js        # Base class all providers extend
  mock-provider.js             # Hardcoded entities, no API key needed (default)
  openai-provider.js           # gpt-4o-mini
  claude-provider.js           # Anthropic Claude
  prompt-template.js           # Shared LLM prompt used by all real providers
themes/themes.json             # Fantasy / Sci-Fi / Food / Animals theme definitions
```

### Data Flow

1. Content script extracts `document.body.innerText`
2. Checks `sessionStorage` for a cached mapping; on miss, posts to the service worker
3. Service worker calls the active provider → receives `EntityMap` JSON
4. Theme pseudonyms are assigned deterministically (hash of canonical name → index into name list)
5. Content script walks the DOM with `TreeWalker`, replaces text nodes only (never `innerHTML`)
6. Modified nodes are tracked in a `WeakMap` (`{ original, replaced }`) for exact toggle-off restoration
7. Popup badge is updated with entity count

### Provider Interface

All providers extend `EntityExtractionProvider` from `providers/provider-interface.js` and implement:

- `async extractEntities(pageText)` → `{ entities: [{ id, canonical, aliases[], type, affiliations[] }] }`
- `get providerName()` → string shown in Options UI
- `get requiresApiKey()` → boolean

`type` must be one of: `party | person | org | country | other`

Adding a new provider = one new file in `/providers/` extending the interface.

### Storage

- `chrome.storage.sync` — active provider, API keys, selected theme, exclusion list
- `sessionStorage` — per-tab entity mappings (independent across tabs)
- API keys are stored only in `chrome.storage.sync`; the content script never accesses them directly — all API calls go through the service worker

## Key Constraints

- **Manifest V3** — service workers (not background pages); use `fetch`, not `XMLHttpRequest`
- **No external libraries in the content script** — vanilla JS only to minimize page impact
- **CSP compliance** — all scripts bundled locally; no CDN imports in extension context
- **API keys never leave the service worker** — content script communicates via `chrome.runtime.sendMessage`
- **DOM safety** — use `document.createTextNode()` for replacements, never `innerHTML`
- Person pseudonyms must be **deterministic** (same canonical name → same pseudonym within a theme) so the same entity always maps consistently
