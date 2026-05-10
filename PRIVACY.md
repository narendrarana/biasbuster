# Bias Buster — Privacy Policy

_Last updated: 2026-05-10_

Bias Buster is a Chrome extension that replaces the names of political parties, politicians, and political organizations on news websites with themed pseudonyms (Fantasy, Sci-Fi, Food, Animals) so readers can engage with news content without political-identity bias.

This document explains exactly what data the extension touches, where it goes, and what it does **not** do.

## Default behavior: nothing leaves your device

**By default, Bias Buster does not call any LLM API and does not transmit any data off your device.** Out of the box, the extension uses the built-in **Gazetteer** provider, which matches entities against a static list of political names bundled inside the extension package itself. All processing happens locally in your browser. No network requests are made to identify entities.

The Gazetteer provider is the default the first time you install the extension and remains the default unless you explicitly choose a different provider in the Options page.

## Optional: user-selected LLM providers

If — and only if — you go into the Options page and switch the provider to **OpenAI** or **Claude (Anthropic)**, two things change:

1. **You provide your own API key.** The key is stored in `chrome.storage.sync` (Chrome's standard settings storage, scoped to your Google account) and is sent only to the corresponding provider's endpoint:
   - OpenAI → `https://api.openai.com/v1/chat/completions`
   - Anthropic → `https://api.anthropic.com/v1/messages`

   The extension developer never receives, sees, or has access to your API key.

2. **Page text is transmitted to the provider you selected.** When you load a supported news page, the visible text of that page (`document.body.innerText`) is sent to the provider you chose so it can return a list of political entities found in the article. The data is sent directly from your browser to that provider using your own API credentials. The extension developer is not in this network path.

There is also a **Mock** provider intended for local testing. It returns a hardcoded entity list and makes no network requests.

## Data the extension collects

| Category | Collected? | What and why |
|---|---|---|
| Authentication information | Only if you choose an API-based provider | Your OpenAI or Anthropic API key, pasted by you into Options. Stored in `chrome.storage.sync`. Sent only to the matching provider endpoint. Never sent to the developer. |
| Website content | Only if you choose an API-based provider | The visible text of the current news page, sent to your chosen provider so it can identify political entities. With the default Gazetteer provider or the Mock provider, page content never leaves your device. |
| Personally identifiable information | No | |
| Health information | No | |
| Financial and payment information | No | |
| Personal communications | No | |
| Location | No | |
| Web history | No | |
| User activity | No | |

The extension stores your settings (selected theme, chosen provider, optional API keys, excluded domains) in `chrome.storage.sync`. Per-tab entity mappings are kept in `sessionStorage` and are discarded when the tab closes.

## What the extension does NOT do

- It does **not** sell or transfer any user data to third parties.
- It does **not** use or transfer user data for purposes unrelated to its single purpose (replacing political entity names with pseudonyms).
- It does **not** use or transfer user data to determine creditworthiness or for lending purposes.
- It does **not** load or execute any remote code. All JavaScript is bundled inside the extension package.
- It does **not** send any analytics, telemetry, crash reports, or usage data anywhere.
- It does **not** run on arbitrary websites — it only activates on a curated list of news and political-commentary domains declared in the manifest.

## Where data goes — quick summary

| Provider you select | Where page text goes | Where API key goes |
|---|---|---|
| **Gazetteer** (default) | Nowhere — stays in your browser | N/A — no key needed |
| **Mock** (testing) | Nowhere — stays in your browser | N/A — no key needed |
| **OpenAI** | `api.openai.com` (your request, your key) | `api.openai.com` (Authorization header) |
| **Claude (Anthropic)** | `api.anthropic.com` (your request, your key) | `api.anthropic.com` (`x-api-key` header) |

## Contact

For questions about this policy, contact: narendra.rana@gmail.com
