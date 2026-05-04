# Chrome Web Store Listing — Bias Buster v1.0.0

Copy/paste-ready content for the Web Store developer dashboard.

---

## Name
**Bias Buster**

## Summary (132 chars max — shown in search results)

> Read the news without political identity bias. Politicians and parties become Vampires, Eagles, or Tacos — your choice.

(124 chars ✓)

## Category
**News & Weather** (primary). Alternates: Productivity.

## Language
English (United States)

---

## Detailed description

```
Read the news without political identity bias.

Bias Buster replaces the names of politicians, parties, and political organizations on news sites with fun themed pseudonyms — Vampires vs. Werewolves, Eagles vs. Lions, Tacos vs. Pizzas. The same argument reads very differently when you can't tell which "team" is making it. Engage with the ideas, not the identity.

✦ Four themes: Fantasy, Sci-Fi, Food, Animals — pick your favorite
✦ Deterministic — the same person always becomes the same character within a theme
✦ Affiliation-preserving — if Person A is in Party B, their pseudonym stays on Party B's team
✦ Hold-to-reveal — instantly see the originals when you need to
✦ One-click toggle — turn it off on any page

PRIVACY FIRST
The default "Local Database" provider runs entirely inside the extension. Page text never leaves your device, no API keys, no network calls. It recognizes ~100 mainstream political figures and organizations out of the box.

OPTIONAL AI PROVIDERS
For broader coverage, you can supply your own OpenAI or Anthropic API key in Settings. Your key is stored only in Chrome's encrypted sync storage and is never accessed by the page or sent anywhere except the API you chose.

WORKS ON 100+ NEWS SITES
CNN, Fox News, NYT, Washington Post, NPR, Reuters, AP, WSJ, Bloomberg, MSNBC, Politico, The Atlantic, BBC, Al Jazeera, plus partisan outlets across the spectrum (Breitbart, Daily Wire, National Review, Mother Jones, The Intercept, Jacobin, Salon...) and aggregators (Drudge, Google News, Yahoo News, MSN News).

SOURCE CODE
Open source on GitHub. Vanilla JavaScript, Manifest V3, no tracking, no analytics.
```

---

## Privacy practices (required)

### Single purpose description
"Replace the names of political parties, politicians, and political organizations on news websites with user-selected themed pseudonyms, so users can engage with article content without identity bias."

### Permission justifications

| Permission | Why |
|---|---|
| `storage` | Persists user preferences (active theme, on/off state, optional API keys, excluded-domains list) via `chrome.storage.sync`. |
| `activeTab` | Lets the popup read the URL of the current tab to determine whether the extension is active there. |
| `tabs` | Lets the popup send messages to the active tab's content script (toggle, theme change, hold-to-reveal). |
| Host permissions (103 news domains) | Required so the content script can read article text and rewrite text nodes on the listed news sites. The extension does not run on any site outside this list. |

### Data usage disclosure

**Does this extension collect or use any of the following user data?**

- ✗ Personally identifiable information — **No**
- ✗ Health information — **No**
- ✗ Financial and payment information — **No**
- ✗ Authentication information — **No** (the optional OpenAI/Anthropic API keys the user supplies are stored only in their own Chrome sync storage, never transmitted to any first-party server)
- ✗ Personal communications — **No**
- ✗ Location — **No**
- ✗ Web history — **No**
- ✓ Website content — **Yes, conditionally**

**Website content explanation:**
"With the default Local Database provider (selected on install), all page processing happens locally inside the extension and no website content is transmitted anywhere. If the user opts into the optional OpenAI or Claude provider in Settings, the visible text of the current article is sent to that provider's API for entity extraction, using the user's own API key. The extension itself does not store, log, or transmit page content to any first-party server."

### Required certifications

- ☑ I do not sell or transfer user data to third parties outside of approved use cases
- ☑ I do not use or transfer user data for purposes unrelated to my item's single purpose
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes

---

## Listing assets

| Asset | Required? | File | Status |
|---|---|---|---|
| Icon 128×128 | ✓ Required | `icons/icon128.png` | ✅ |
| Screenshot #1 (1280×800) | ✓ At least 1 required | `screenshots/screenshot-1-before-after.png` | ✅ |
| Screenshot #2 | Optional | `screenshots/screenshot-2-popup.png` | ✅ |
| Screenshot #3 | Optional | `screenshots/screenshot-3-settings.png` | ✅ |
| Small promo tile (440×280) | Optional, recommended | _not yet created_ | ⏳ |
| Marquee promo tile (1400×560) | Optional, only for featured | _not creating for v1_ | — |

---

## Pre-submission checklist

- [ ] Generate icon PNGs from `icons/generate.html` and confirm they're in `icons/`
- [ ] Verify `manifest.json` version is `1.0.0`
- [ ] Spot-test on 3 sites: 1 mainstream (CNN), 1 right (Breitbart), 1 left (Mother Jones)
- [ ] ZIP the project root (excluding `.git/`, `.claude/`, `screenshots/raw originals`, `STORE_LISTING.md`, `bias-buster-spec.md`, `engineerReadme.md`, `README.md`) for upload
- [ ] Upload to https://chrome.google.com/webstore/devconsole
- [ ] Pay one-time $5 developer fee if not already registered
- [ ] Fill in the fields above
- [ ] Submit for review (typically 1–3 business days)

---

## Post-launch

- Monitor the Chrome Web Store reviews/feedback tab
- Plan v1.1: international gazetteer expansion (~40 entities — heads of state + opposition leaders + main parties for UK, Canada, India, Australia, France, Germany, Italy, Japan, Israel, Brazil, Mexico)
- Add the dropped international news sites back to the manifest once gazetteer covers them
