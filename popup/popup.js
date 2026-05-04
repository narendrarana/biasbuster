'use strict';

let currentTab = null;
let isActive = false;
let entityCount = 0;
let currentTheme = 'fantasy';
let themesData = null;

// Derived once at popup load from the manifest's content_scripts[0].matches —
// keeps the popup in sync with whatever sites the extension actually injects on.
const SUPPORTED_MATCHERS = buildSupportedMatchers();

function buildSupportedMatchers() {
  const patterns = chrome.runtime.getManifest().content_scripts?.[0]?.matches || [];
  return patterns.map(patternToRegex).filter(Boolean);
}

function patternToRegex(pattern) {
  const m = pattern.match(/^([^:]+):\/\/([^/]+)(\/.*)$/);
  if (!m) return null;
  const [, scheme, host, path] = m;
  const escapeRe = s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const reScheme = scheme === '*' ? '[a-z]+' : escapeRe(scheme);
  const reHost = host.startsWith('*.')
    ? '(?:[^/]+\\.)?' + escapeRe(host.slice(2))
    : escapeRe(host).replace(/\*/g, '[^/]*');
  const rePath = escapeRe(path).replace(/\*/g, '.*');
  return new RegExp('^' + reScheme + ':\\/\\/' + reHost + rePath + '$');
}

// ── Init ───────────────────────────────────────────────────────────────────

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTab = tab;

  themesData = await loadThemes();

  const settings = await chrome.storage.sync.get({ theme: 'fantasy', enabled: true });
  currentTheme = settings.theme;
  isActive = settings.enabled;

  // Get live status from content script if available
  if (isOnSupportedPage()) {
    try {
      const status = await sendToContent({ action: 'getStatus' });
      if (status) {
        isActive = status.isActive;
        entityCount = status.entityCount || 0;
        currentTheme = status.theme || currentTheme;
      }
    } catch (_) {
      // Content script not ready — use storage values
    }
  }

  renderThemes();
  updateUI();
  setupListeners();
}

async function loadThemes() {
  try {
    const url = chrome.runtime.getURL('themes/themes.json');
    const version = chrome.runtime.getManifest().version;
    const res = await fetch(`${url}?v=${version}`, { cache: 'no-store' });
    return res.json();
  } catch (e) {
    console.error('[BiasBuster Popup] Failed to load themes:', e);
    return null;
  }
}

// ── Render ─────────────────────────────────────────────────────────────────

function renderThemes() {
  const grid = document.getElementById('themeGrid');
  if (!themesData) {
    grid.innerHTML = '<p style="grid-column:1/-1;padding:6px 4px;color:#aaa;font-size:12px">Could not load themes</p>';
    return;
  }
  grid.innerHTML = '';
  for (const [key, theme] of Object.entries(themesData)) {
    const btn = document.createElement('button');
    btn.className = 'theme-btn' + (key === currentTheme ? ' active' : '');
    btn.dataset.theme = key;
    btn.innerHTML = `<span class="emoji">${theme.emoji}</span><span class="name">${theme.name}</span>`;
    btn.addEventListener('click', () => selectTheme(key));
    grid.appendChild(btn);
  }
}

function updateUI() {
  document.getElementById('toggleSwitch').checked = isActive;
  document.getElementById('revealBtn').disabled = !isActive;

  const bar = document.getElementById('statusBar');
  const txt = document.getElementById('statusText');

  if (!isOnSupportedPage()) {
    bar.className = 'status-bar off';
    txt.textContent = 'Not active on this page';
  } else if (isActive && entityCount > 0) {
    bar.className = 'status-bar ok';
    txt.textContent = `${entityCount} entities obfuscated`;
  } else if (isActive) {
    bar.className = 'status-bar ok';
    txt.textContent = 'Active — analyzing page…';
  } else {
    bar.className = 'status-bar off';
    txt.textContent = 'Obfuscation disabled';
  }
}

function isOnSupportedPage() {
  if (!currentTab?.url) return false;
  return SUPPORTED_MATCHERS.some(re => re.test(currentTab.url));
}

// ── Listeners ──────────────────────────────────────────────────────────────

function setupListeners() {
  document.getElementById('toggleSwitch').addEventListener('change', async () => {
    try {
      const res = await sendToContent({ action: 'toggle' });
      if (res) {
        isActive = res.isActive;
        entityCount = res.entityCount || 0;
      }
    } catch (err) {
      setError('Cannot reach page — try reloading');
      document.getElementById('toggleSwitch').checked = isActive; // revert
      return;
    }
    await chrome.storage.sync.set({ enabled: isActive });
    updateUI();
  });

  const revealBtn = document.getElementById('revealBtn');
  revealBtn.addEventListener('mousedown', () => sendToContent({ action: 'reveal' }).catch(() => {}));
  revealBtn.addEventListener('mouseup',   () => sendToContent({ action: 'conceal' }).catch(() => {}));
  revealBtn.addEventListener('mouseleave', () => { if (isActive) sendToContent({ action: 'conceal' }).catch(() => {}); });

  document.getElementById('optionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
    window.close();
  });
}

async function selectTheme(theme) {
  currentTheme = theme;
  await chrome.storage.sync.set({ theme });

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });

  try {
    const res = await sendToContent({ action: 'reapply', theme });
    if (res) {
      entityCount = res.entityCount || 0;
      updateUI();
    }
  } catch (_) {}
}

// ── Messaging ──────────────────────────────────────────────────────────────

function sendToContent(message) {
  return new Promise((resolve, reject) => {
    if (!currentTab?.id) { reject(new Error('No tab')); return; }
    chrome.tabs.sendMessage(currentTab.id, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}

function setError(msg) {
  const bar = document.getElementById('statusBar');
  bar.className = 'status-bar err';
  document.getElementById('statusText').textContent = msg;
}

// ── Start ──────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => {
    console.error('[BiasBuster Popup]', err);
    setError('Unexpected error — see console');
  });
});
