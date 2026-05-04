'use strict';

async function init() {
  const settings = await chrome.storage.sync.get({
    provider: 'gazetteer',
    theme: 'fantasy',
    apiKeys: {},
    excludedDomains: []
  });

  document.getElementById('providerSelect').value = settings.provider;
  document.getElementById('themeSelect').value = settings.theme;
  document.getElementById('openaiKey').value = settings.apiKeys?.openai || '';
  document.getElementById('claudeKey').value = settings.apiKeys?.claude || '';
  document.getElementById('excludedDomains').value = (settings.excludedDomains || []).join('\n');

  updateProviderFields(settings.provider);

  document.getElementById('providerSelect').addEventListener('change', e => {
    updateProviderFields(e.target.value);
  });

  document.getElementById('saveBtn').addEventListener('click', save);
}

function updateProviderFields(provider) {
  document.getElementById('openaiKeyField').style.display = provider === 'openai' ? 'block' : 'none';
  document.getElementById('claudeKeyField').style.display = provider === 'claude' ? 'block' : 'none';
}

async function save() {
  const provider = document.getElementById('providerSelect').value;
  const theme = document.getElementById('themeSelect').value;
  const openaiKey = document.getElementById('openaiKey').value.trim();
  const claudeKey = document.getElementById('claudeKey').value.trim();
  const excludedText = document.getElementById('excludedDomains').value;
  const excludedDomains = excludedText.split('\n').map(s => s.trim()).filter(Boolean);

  await chrome.storage.sync.set({
    provider,
    theme,
    apiKeys: { openai: openaiKey, claude: claudeKey },
    excludedDomains
  });

  const status = document.getElementById('saveStatus');
  status.textContent = '✓ Saved';
  setTimeout(() => { status.textContent = ''; }, 2500);
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch(err => console.error('[BiasBuster Options]', err));
});
