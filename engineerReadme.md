# BiasBuster — Engineer's Guide

A plain-English walkthrough of how the extension works, written for someone with basic coding knowledge.

---

## The Big Picture

When you visit a news site, three parts of the extension work together:

```
[News Article Page]          [Extension Background]       [Chrome Storage]
  content-script.js    ←→    service-worker.js      ←→   settings, API keys
  (reads & rewrites DOM)     (calls entity providers)     theme, provider
```

---

## 1. `manifest.json` — The Extension's ID Card

This file tells Chrome what the extension is allowed to do. Key things it declares:
- **Which websites** to run on (CNN, Fox News, BBC, etc.)
- **What files** run where (service worker in background, content script on pages)
- **What permissions** it needs (`storage` to save settings, `tabs` to talk to the active page)

---

## 2. `content/content-script.js` — The DOM Worker

This is the main script that actually **reads and rewrites the page text**. Chrome injects it
automatically into every supported news site.

**On page load:**
1. Reads your settings from Chrome storage (which theme, is it enabled)
2. Fetches `themes/themes.json` to know the faction names and pseudonyms
3. Grabs the page's text and sends it to the service worker: *"here's the article, what entities are in it?"*
4. Gets back a list of entities (e.g. `{canonical: "Joe Biden", aliases: ["Biden", "President Biden"], type: "person", affiliations: ["party_dem"]}`)
5. Builds a **replacement map** — every alias maps to a pseudonym (e.g. "Biden" → "Lord Malachar")
6. Walks every text node in the page using `TreeWalker` and swaps the text

**The DOM walk** (step 6) is careful:
- It only touches **text nodes** (not HTML tags, not `<script>` or `<style>` blocks)
- It stores the original text alongside the replacement in a `WeakMap` so toggling off is just
  putting the original back — no re-fetching needed
- It never uses `innerHTML` (which would be a security risk — it could execute injected scripts)

**When you click the popup toggle:**
- `removeObfuscation()` loops through the modified nodes and restores originals from the WeakMap
- No API call, instant

**Caching:**
- After the first extraction, the entity map is saved to `sessionStorage` keyed by page URL
- Refreshing the same article reuses the cache — no re-extraction needed

---

## 3. `background/service-worker.js` — The Secure Middleman

This runs in the extension's background (not on the page). It receives a message from the
content script, picks the right provider, calls it, and sends the entity list back.

With the default **Gazetteer** provider it never makes any network call — all work happens
locally inside the service worker. With the optional AI providers (OpenAI, Claude), it holds
the API keys and makes the outbound request from here so keys never touch the page's
JavaScript context.

---

## 4. `providers/` — The Plug-in Extraction Layer

Each provider file does one thing: take page text, return a structured list of entities.

| File | How it works | Default? |
|------|-------------|----------|
| `gazetteer-provider.js` | Loads `data/entities-db.json`, scans text for alias matches — no network call, no API key | ✅ Yes |
| `openai-provider.js` | Sends text to GPT-4o Mini with a structured prompt, returns JSON | Optional |
| `claude-provider.js` | Same but calls Anthropic's Claude Haiku | Optional |
| `mock-provider.js` | Ignores the text, always returns the same 9 hardcoded figures | Dev only |

All four implement the same interface (`extractEntities(text)` → `{ entities: [...] }`), so
swapping providers is just changing one setting in Options. The rest of the system doesn't
know or care which one is active.

---

## 5. `data/entities-db.json` — The Local Knowledge Base

A hand-curated JSON array of ~100 political entities covering US parties, the current and
recent administrations, notable senators, House members, governors, major orgs (DOGE, ACLU,
NRA, NATO…), and international leaders (Putin, Zelensky, Netanyahu, Xi, Starmer…).

Each entry looks like:
```json
{ "id": "person_biden", "canonical": "Joe Biden", "aliases": ["Biden", "President Biden", "former President Biden"], "type": "person", "affiliations": ["party_dem"] }
```

Fields:
- **`id`** — stable unique key, prefixed by type: `party_`, `person_`, `org_`
- **canonical** — the primary/official name used when generating pseudonyms
- **aliases** — every surface form that might appear in news text
- **type** — `party`, `person`, `org`, or `other`
- **affiliations** — list of entity IDs this entity belongs to (usually the party)

**Smart affiliation pull-in:** when the gazetteer matches a person (e.g. "Bernie Sanders"),
it automatically includes their affiliated party in the result even if the word "Democrats"
never appears in the article. This ensures the pseudonym map can always resolve faction
colours correctly — Sanders stays on the Vampire Court team even on articles that just call
him "Bernie".

---

## 6. `themes/themes.json` — The Name Lookup Table

Four themes (Fantasy, Sci-Fi, Food, Animals). Each theme stores:
- **`factions`** — 4 group names used for parties/orgs (e.g. `"The Vampire Court"`)
- **`personNames`** — 10 names per faction for individual people

**Pseudonym assignment is deterministic** — computed from a hash of the entity's canonical name,
so the same person always gets the same pseudonym within a theme across sessions.

---

## 7. `popup/` — What You See When You Click the Icon

Three files (HTML/CSS/JS) that render the popup window:
- Shows how many entities were found on this page
- Lets you toggle obfuscation on/off
- Lets you pick a theme (sends a `reapply` message to the content script)
- "Hold to Reveal" button (sends `reveal` on mousedown, `conceal` on mouseup)

The popup **doesn't do the work** — it just sends messages to the content script, which
does the actual DOM changes.

---

## 8. `options/` — The Settings Page

A full HTML page (opened via the Settings link) where you pick:
- Which provider to use (gazetteer / OpenAI / Claude / mock)
- API key for AI providers (stored in Chrome's encrypted `chrome.storage.sync`)
- Default theme
- Domains where the extension should never activate

---

## The Full Flow

```
User visits foxnews.com/article
         │
         ▼
content-script.js loads
  → checks settings (enabled? excluded domain?)
  → fetches themes.json
  → checks sessionStorage cache for this URL
         │
    cache miss → sends message to service-worker.js
                       │
                       ▼
               picks active provider (gazetteer by default)
               gazetteer scans text against entities-db.json
               returns matched entities:
                 e.g. "Biden"   → {id: "person_biden",  affiliations: ["party_dem"]}
                      "Trump"   → {id: "person_trump",  affiliations: ["party_rep"]}
                      "GOP"     → {id: "party_rep",     affiliations: []}
         │
         ▼
content-script builds pseudonym map
  party_dem  → "The Vampire Court"  (first party found → first faction)
  party_rep  → "The Werewolf Pack"  (second party → second faction)
  person_biden → "Lord Malachar"    (hash("Joe Biden") → index into Vampire Court names)
  person_trump → "Alpha Gareth"     (hash("Donald Trump") → index into Werewolf Pack names)
         │
         ▼
builds replacement map (alias → pseudonym, sorted longest-first)
  "President Biden" → "Lord Malachar"
  "Joe Biden"       → "Lord Malachar"
  "Biden"           → "Lord Malachar"
  "Donald Trump"    → "Alpha Gareth"
  "GOP"             → "The Werewolf Pack"
  ...
         │
         ▼
TreeWalker walks every text node in the DOM
  → replaces matching strings using regex with word boundaries
  → stores original in WeakMap for instant toggle-off
         │
         ▼
Popup shows "12 entities obfuscated"

User clicks toggle → originals restored from WeakMap (instant, no network call)
User changes theme → new pseudonyms built from same entity map, DOM re-walked
User holds Reveal → content script temporarily restores originals, re-applies on release
```

---

## Why Local Extraction (Gazetteer) Beats API Calls for This Use Case

| | Gazetteer | API (OpenAI/Claude) |
|---|---|---|
| API key required | No | Yes |
| Works offline | Yes | No |
| Latency | ~0ms | 500–2000ms |
| Cost | Free | Per-call billing |
| Coverage | Known entities only | Any entity in any article |
| Privacy | Text never leaves device | Text sent to third party |

The trade-off: the gazetteer only catches entities it knows about. The AI providers can
discover new or obscure politicians it has never seen. For mainstream political news, the
gazetteer covers the vast majority of what appears.

---

## Adding a New Entity

Open `data/entities-db.json` and append an entry to the array:

```json
{ "id": "person_yourname", "canonical": "Full Name", "aliases": ["Last Name", "Title Last Name"], "type": "person", "affiliations": ["party_dem"] }
```

**ID naming convention:** `party_` + short slug, `person_` + last name (or full slug if
ambiguous), `org_` + short slug. IDs only need to be unique within the file — they are never
shown to users.

No build step required — just reload the extension at `chrome://extensions` and the new
entity will be picked up on the next page load.

---

## Provider Decision Guide

| Situation | Recommended Provider |
|-----------|---------------------|
| Default / most users | `gazetteer` — private, instant, free |
| Article about a very new or obscure politician | `openai` or `claude` |
| Local development / UI testing | `mock` |
| Privacy-critical deployment | `gazetteer` only (no text ever leaves the device) |
