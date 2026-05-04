# Bias Buster — Chrome Extension Spec

## Overview

Bias Buster is a Chrome extension that obfuscates the names of political parties, politicians, organizations, and affiliated groups on any web page. The goal is to let users engage with the *ideas* in an article without being influenced by the *identity* of who is saying them.

The obfuscation must be:
- **Consistent** — the same entity always maps to the same pseudonym within a page session
- **Association-preserving** — if Person A belongs to Party B, their pseudonym stays linked to Party B's pseudonym
- **Thematic** — replacements use fun, user-selected themes (e.g. Fantasy, Sci-Fi, Food)
- **Reversible** — the user can toggle obfuscation on/off at any time

---

## Architecture

### Components

```
bias-buster/
├── manifest.json          # Chrome extension manifest (MV3)
├── background/
│   └── service-worker.js  # Handles API calls, stores session mappings
├── content/
│   └── content-script.js  # DOM manipulation, text replacement
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js           # Theme selector, on/off toggle
├── providers/
│   ├── provider-interface.js   # Abstract interface — all providers implement this
│   ├── claude-provider.js      # Anthropic Claude implementation
│   ├── openai-provider.js      # OpenAI implementation
│   └── mock-provider.js        # Local mock for testing (no API key needed)
├── themes/
│   └── themes.json        # All obfuscation themes
└── options/
    ├── options.html        # Settings page
    ├── options.css
    └── options.js          # API key config, provider selection
```

---

## Entity Extraction — Plug-and-Play Provider Interface

The entity extraction layer is provider-agnostic. All providers implement the same interface:

```javascript
// providers/provider-interface.js
class EntityExtractionProvider {
  /**
   * Extract named entities from page text.
   * @param {string} pageText — raw text content of the page
   * @returns {Promise<EntityMap>}
   *
   * EntityMap shape:
   * {
   *   entities: [
   *     {
   *       id: "e1",                        // stable ID for this entity
   *       canonical: "Democratic Party",   // the primary/canonical name
   *       aliases: ["Democrats", "the left", "Blue wave"],  // all surface forms
   *       type: "party",                   // "party" | "person" | "org" | "country" | "other"
   *       affiliations: ["e1"]             // IDs of affiliated entities
   *     },
   *     {
   *       id: "e2",
   *       canonical: "Bernie Sanders",
   *       aliases: ["Bernie", "Sanders"],
   *       type: "person",
   *       affiliations: ["e1"]             // affiliated with Democratic Party
   *     }
   *   ]
   * }
   */
  async extractEntities(pageText) {
    throw new Error("Not implemented");
  }

  // Human-readable name shown in the options UI
  get providerName() {
    throw new Error("Not implemented");
  }

  // Whether this provider needs an API key configured
  get requiresApiKey() {
    throw new Error("Not implemented");
  }
}
```

### Switching Providers

The active provider is selected in the Options page and stored in `chrome.storage.sync`. The service worker loads the correct provider module at runtime. Adding a new provider = creating a new file in `/providers/` that extends the interface above.

### Prompt Template (for LLM-based providers)

All LLM providers should use a shared prompt template stored in `providers/prompt-template.js`. The prompt must instruct the model to:

1. Identify all named people, political parties, organizations, and affiliated groups
2. Group aliases under a canonical name
3. List affiliations between entities (person → party, org → party, etc.)
4. Return structured JSON only — no prose

Example prompt structure:
```
You are a named entity extractor. Given the following article text, extract all named 
political entities (people, parties, organizations, movements, countries as political actors).

Return ONLY valid JSON in this exact format:
{ "entities": [ { "id": "e1", "canonical": "...", "aliases": [...], "type": "...", "affiliations": [...] } ] }

Rules:
- Group all surface forms of the same entity (e.g. "Bernie", "Sanders", "Sen. Sanders" → one entity)
- Link people to their party affiliation
- Include media organizations, think tanks, and PACs if politically relevant
- type must be one of: party | person | org | country | other

Article text:
{TEXT}
```

---

## Obfuscation Engine

### Mapping Logic (`content/content-script.js`)

1. On page load (when extension is active), extract all visible text from the DOM
2. Send to the active provider → receive `EntityMap`
3. Apply theme mapping:
   - Assign one pseudonym per entity cluster (person gets a name, party gets a faction name)
   - Affiliated entities share a consistent "team" within the theme
4. Walk the DOM and replace text nodes, preserving HTML structure
5. Store the mapping in `sessionStorage` for the current tab

### Consistency Rules

- The mapping is generated **once per page load** and cached
- If the same article is loaded again in the same session, use the cached mapping
- Across tabs, mappings are **independent** (each page gets its own obfuscation)
- The original text is stored alongside the replacement so toggling restores it exactly

### DOM Replacement Strategy

- Use `TreeWalker` to iterate text nodes only
- Replace text nodes with `document.createTextNode()` — do not use `innerHTML`
- Store `{ original, replaced }` pairs on each modified node via a WeakMap
- On toggle-off, restore original text nodes exactly

---

## Themes (`themes/themes.json`)

```json
{
  "fantasy": {
    "name": "Fantasy",
    "emoji": "🧛",
    "factions": ["Vampires", "Werewolves", "Wizards", "Dragon Riders"],
    "personNameStyle": "medieval",
    "example": "Democrats → Vampires, Republicans → Werewolves"
  },
  "scifi": {
    "name": "Sci-Fi",
    "emoji": "🚀",
    "factions": ["The Federation", "The Empire", "The Rebels", "The Syndicate"],
    "personNameStyle": "alien",
    "example": "Democrats → The Federation, Republicans → The Empire"
  },
  "food": {
    "name": "Food",
    "emoji": "🍕",
    "factions": ["Pizza Party", "Taco Coalition", "Sushi Bloc", "Burger Alliance"],
    "personNameStyle": "chef",
    "example": "Democrats → Pizza Party, Republicans → Taco Coalition"
  },
  "animals": {
    "name": "Animals",
    "emoji": "🦁",
    "factions": ["The Lions", "The Eagles", "The Wolves", "The Bears"],
    "personNameStyle": "nature",
    "example": "Democrats → The Lions, Republicans → The Eagles"
  }
}
```

Person pseudonyms within a theme should be generated deterministically from the entity's canonical name (e.g. hash → index into a name list) so the same person always gets the same pseudonym within a theme.

---

## UI

### Popup (`popup/`)

- **Toggle switch** — Enable / Disable obfuscation on the current page
- **Theme selector** — Dropdown or icon grid to pick active theme
- **Status indicator** — Shows how many entities were found and replaced
- **"Reveal" button** — Temporarily show original text (hold to reveal, release to re-obfuscate)

### Options Page (`options/`)

- **Provider selector** — Dropdown: `Claude (Anthropic)` | `GPT-4o Mini (OpenAI)` | `Mock (no API key)`
- **API Key input** — Stored in `chrome.storage.sync` (encrypted at rest by Chrome)
- **Default theme** — Persisted preference
- **Exclusion list** — Domains where the extension should never activate

---

## Data Flow

```
User visits news article
        │
        ▼
Content script activates
        │
        ▼
Extract page text (document.body.innerText)
        │
        ▼
Check sessionStorage for cached mapping
    ├── HIT → use cached mapping
    └── MISS → send to service worker
                    │
                    ▼
            Call active provider
            (Claude / OpenAI / Mock)
                    │
                    ▼
            Receive EntityMap (JSON)
                    │
                    ▼
            Apply theme → generate pseudonyms
                    │
                    ▼
            Cache mapping in sessionStorage
        │
        ▼
Walk DOM, replace text nodes
        │
        ▼
Update popup badge with entity count
```

---

## Implementation Notes for Claude Code

### Start here

Build in this order:
1. `manifest.json` + basic extension shell that loads on news sites
2. `mock-provider.js` with hardcoded entity map for fast local testing
3. DOM replacement engine with toggle
4. Popup UI with theme selector
5. One real LLM provider (suggest starting with OpenAI `gpt-4o-mini` — cheapest)
6. Options page with provider/API key config
7. Additional providers

### Key constraints

- **Manifest V3** — use service workers, not background pages; use `fetch` not `XMLHttpRequest`
- **No external libraries in content script** — keep it vanilla JS to minimize page impact
- **CSP compliance** — all scripts must be bundled locally, no CDN imports in extension context
- **API keys never leave the service worker** — content script never touches the key directly

### Testing

Include `mock-provider.js` as the default provider so the extension works out of the box without an API key. The mock should return a realistic entity map for a sample political article.

---

## Out of Scope (v1)

- Images / infographics (text in images won't be replaced)
- Cross-tab consistent mapping
- Sharing/exporting your obfuscation session
- On-device NLP (spaCy etc.) — future enhancement to eliminate API costs entirely

---

## Success Criteria

- Load a CNN or Fox News article → all party names and politician names replaced with theme pseudonyms
- The same entity always gets the same pseudonym on that page
- Party–person affiliations are preserved (Bernie's pseudonym is always on the Vampire team if Democrats → Vampires)
- Toggle instantly restores original text
- Works on: CNN, Fox News, BBC, NYT, Washington Post, Politico
