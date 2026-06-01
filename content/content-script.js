(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let isActive = false;
  let currentTheme = 'fantasy';
  let entityMap = null;
  let themes = null;
  let replacementEntries = []; // [{alias, pseudonym, faction}] sorted longest-first
  const modifiedNodes = []; // [{ original, nodes[] }] for toggle-off restoration
  let entityCount = 0;

  // Combined matcher rebuilt whenever replacementEntries changes
  let combinedRegex = null;
  let aliasLookup = null; // lowercased alias -> { pseudonym, faction }

  const FACTION_PALETTE = ['#c0392b', '#2980b9', '#27ae60', '#8e44ad',
                           '#d35400', '#16a085', '#34495e', '#c2185b'];

  // ── Helpers ────────────────────────────────────────────────────────────────

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function factionColor(faction) {
    return FACTION_PALETTE[simpleHash(faction || '') % FACTION_PALETTE.length];
  }

  function matchCase(original, replacement) {
    if (!replacement) return replacement;
    if (/[A-Za-z]/.test(original) && original === original.toUpperCase()) {
      return replacement.toUpperCase();
    }
    if (/^[A-Z]/.test(original)) {
      return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement.toLowerCase();
  }

  function sendToServiceWorker(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // ── Settings & Resources ───────────────────────────────────────────────────

  async function getSettings() {
    return chrome.storage.sync.get({
      theme: 'fantasy',
      enabled: true,
      excludedDomains: []
    });
  }

  async function loadThemes() {
    try {
      const url = chrome.runtime.getURL('themes/themes.json');
      const version = chrome.runtime.getManifest().version;
      const res = await fetch(`${url}?v=${version}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      console.error('[BiasBuster] Failed to load themes:', e);
      return null;
    }
  }

  function isExcluded(excludedDomains) {
    const host = location.hostname;
    return (excludedDomains || []).some(
      d => host === d || host.endsWith('.' + d)
    );
  }

  // ── Entity Map ─────────────────────────────────────────────────────────────

  const CACHE_VERSION = 'v3';

  async function fetchEntityMap() {
    const cacheKey = `biasbuster:${CACHE_VERSION}:${location.href}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {}

    const pageText = document.body.innerText.slice(0, 15000);
    const response = await sendToServiceWorker({ action: 'extractEntities', text: pageText });

    if (!response?.success) {
      throw new Error(response?.error || 'Entity extraction failed');
    }

    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(response.entityMap));
    } catch (_) {}

    return response.entityMap;
  }

  // ── Pseudonym Building ─────────────────────────────────────────────────────

  function buildPseudonymMap(entities, themeData) {
    const { factions, personNames } = themeData;
    const pseudonymMap = {};
    const partyFactionMap = {};
    let partyIndex = 0;

    // First pass: parties → factions (assigned in document order)
    for (const entity of entities) {
      if (entity.type === 'party') {
        const faction = factions[partyIndex % factions.length];
        partyIndex++;
        partyFactionMap[entity.id] = faction;
        pseudonymMap[entity.id] = { pseudonym: faction, faction };
      }
    }

    // Second pass: persons, orgs, countries, other
    for (const entity of entities) {
      if (entity.type === 'party') continue;

      const affiliatedPartyId = (entity.affiliations || []).find(id => partyFactionMap[id]);
      const faction = affiliatedPartyId
        ? partyFactionMap[affiliatedPartyId]
        : factions[simpleHash(entity.canonical) % factions.length];

      let pseudonym;
      if (entity.type === 'person') {
        const nameList = personNames[faction] || [];
        if (nameList.length === 0) {
          pseudonym = faction + ' Member';
        } else {
          pseudonym = nameList[simpleHash(entity.canonical) % nameList.length];
        }
      } else {
        pseudonym = faction;
      }

      pseudonymMap[entity.id] = { pseudonym, faction };
    }

    return pseudonymMap;
  }

  function buildReplacementEntries(entities, pseudonymMap) {
    const seen = new Map();
    for (const entity of entities) {
      const pseudo = pseudonymMap[entity.id];
      if (!pseudo) continue;
      const allAliases = [entity.canonical, ...(entity.aliases || [])];
      for (const alias of allAliases) {
        if (alias && alias.trim() && !seen.has(alias)) {
          seen.set(alias, { pseudonym: pseudo.pseudonym, faction: pseudo.faction });
        }
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[0].length - a[0].length)
      .map(([alias, info]) => ({ alias, ...info }));
  }

  // ── DOM Manipulation ───────────────────────────────────────────────────────

  function buildMatcher(entries) {
    combinedRegex = null;
    aliasLookup = null;
    if (entries.length === 0) return;
    aliasLookup = new Map();
    const parts = entries.map(e => {
      aliasLookup.set(e.alias.toLowerCase(), e);
      return escapeRegex(e.alias);
    });
    // entries are sorted longest-first, so alternation prefers the longest alias
    combinedRegex = new RegExp(`\\b(${parts.join('|')})\\b`, 'gi');
  }

  // Replace a text node with [text, <span.bb-swap>, text, …]. Each swapped span
  // carries the original name (title + data attr) and a faction accent color.
  function obfuscateNode(node) {
    const text = node.textContent;
    combinedRegex.lastIndex = 0;
    const frag = document.createDocumentFragment();
    const inserted = [];
    let lastIndex = 0, match;

    while ((match = combinedRegex.exec(text)) !== null) {
      const matched = match[0];
      const entry = aliasLookup.get(matched.toLowerCase());
      if (!entry) continue;
      if (match.index > lastIndex) {
        const t = document.createTextNode(text.slice(lastIndex, match.index));
        frag.appendChild(t); inserted.push(t);
      }
      const span = document.createElement('span');
      span.className = 'bb-swap';
      span.textContent = matchCase(matched, entry.pseudonym);
      span.title = matched;               // original revealed on hover
      span.dataset.bbOriginal = matched;
      if (entry.faction) span.style.setProperty('--bb-accent', factionColor(entry.faction));
      frag.appendChild(span); inserted.push(span);
      lastIndex = match.index + matched.length;
    }

    if (inserted.length === 0) return;    // nothing matched in this node
    if (lastIndex < text.length) {
      const t = document.createTextNode(text.slice(lastIndex));
      frag.appendChild(t); inserted.push(t);
    }
    const parent = node.parentNode;
    if (!parent) return;
    parent.replaceChild(frag, node);
    modifiedNodes.push({ original: text, nodes: inserted });
  }

  function applyObfuscation() {
    modifiedNodes.length = 0;
    buildMatcher(replacementEntries);
    entityCount = entityMap?.entities?.length || 0;
    if (!combinedRegex) return;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          const tag = parent?.tagName;
          if (!tag || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains('bb-swap')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    // Collect all target nodes before mutating — replacing nodes mid-walk
    // would invalidate the TreeWalker.
    const targets = [];
    let node;
    while ((node = walker.nextNode())) targets.push(node);
    for (const n of targets) obfuscateNode(n);
  }

  function removeObfuscation() {
    for (const rec of modifiedNodes) {
      const first = rec.nodes[0];
      const parent = first?.parentNode;
      if (!parent) continue;
      parent.insertBefore(document.createTextNode(rec.original), first);
      for (const n of rec.nodes) n.remove();
    }
    modifiedNodes.length = 0;
  }

  // ── Theme Application ──────────────────────────────────────────────────────

  function applyTheme(theme) {
    currentTheme = theme;
    const themeData = themes?.[theme];
    if (!themeData || !entityMap) return;

    const pseudonymMap = buildPseudonymMap(entityMap.entities, themeData);
    replacementEntries = buildReplacementEntries(entityMap.entities, pseudonymMap);
    applyObfuscation();
  }

  async function activate() {
    entityMap = await fetchEntityMap();
    applyTheme(currentTheme);
  }

  async function toggleObfuscation() {
    if (isActive) {
      removeObfuscation();
      isActive = false;
    } else {
      if (!themes) themes = await loadThemes();
      if (replacementEntries.length > 0) {
        applyObfuscation();
      } else {
        await activate();
      }
      isActive = true;
    }
  }

  // ── Message Handler ────────────────────────────────────────────────────────

  async function handleMessage(message) {
    switch (message.action) {
      case 'toggle':
        await toggleObfuscation();
        return { isActive, entityCount };

      case 'getStatus':
        return { isActive, entityCount, theme: currentTheme };

      case 'reapply':
        if (isActive) removeObfuscation();
        applyTheme(message.theme);
        isActive = replacementEntries.length > 0;
        return { success: true, entityCount };

      case 'reveal':
        removeObfuscation();
        return { success: true };

      case 'conceal':
        if (isActive) applyObfuscation();
        return { success: true };

      default:
        return { error: 'Unknown action: ' + message.action };
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handleMessage(message)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  });

  // ── Init ───────────────────────────────────────────────────────────────────

  async function init() {
    const settings = await getSettings();
    currentTheme = settings.theme || 'fantasy';

    if (!settings.enabled) return;
    if (isExcluded(settings.excludedDomains)) return;

    themes = await loadThemes();
    if (!themes) return;

    try {
      await activate();
      isActive = true;
    } catch (e) {
      console.error('[BiasBuster] Activation failed:', e);
    }
  }

  init().catch(err => console.error('[BiasBuster] Init error:', err));
})();
