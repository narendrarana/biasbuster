(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────────
  let isActive = false;
  let currentTheme = 'fantasy';
  let entityMap = null;
  let themes = null;
  let replacementEntries = []; // [{alias, pseudonym}] sorted longest-first
  const modifiedNodes = [];
  const nodeData = new WeakMap();
  let entityCount = 0;

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
          seen.set(alias, pseudo.pseudonym);
        }
      }
    }
    return [...seen.entries()]
      .sort((a, b) => b[0].length - a[0].length)
      .map(([alias, pseudonym]) => ({ alias, pseudonym }));
  }

  // ── DOM Manipulation ───────────────────────────────────────────────────────

  function replaceText(text, entries) {
    let result = text;
    for (const { alias, pseudonym } of entries) {
      const re = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'gi');
      result = result.replace(re, match => matchCase(match, pseudonym));
    }
    return result;
  }

  function applyObfuscation() {
    modifiedNodes.length = 0;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const tag = node.parentElement?.tagName;
          if (!tag || tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      const original = node.textContent;
      const replaced = replaceText(original, replacementEntries);
      if (replaced !== original) {
        nodeData.set(node, { original, replaced });
        node.textContent = replaced;
        modifiedNodes.push(node);
      }
    }

    entityCount = entityMap?.entities?.length || 0;
  }

  function removeObfuscation() {
    for (const node of modifiedNodes) {
      const data = nodeData.get(node);
      if (data) node.textContent = data.original;
    }
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
