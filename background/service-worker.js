import { GazetteerProvider } from '../providers/gazetteer-provider.js';
import { MockProvider } from '../providers/mock-provider.js';
import { OpenAIProvider } from '../providers/openai-provider.js';
import { ClaudeProvider } from '../providers/claude-provider.js';

const DEFAULT_SETTINGS = {
  provider: 'gazetteer',
  theme: 'fantasy',
  enabled: true,
  apiKeys: {},
  excludedDomains: []
};

function createProvider(name, apiKeys) {
  switch (name) {
    case 'openai':    return new OpenAIProvider(apiKeys.openai || '');
    case 'claude':    return new ClaudeProvider(apiKeys.claude || '');
    case 'mock':      return new MockProvider();
    case 'gazetteer':
    default:          return new GazetteerProvider();
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'extractEntities') {
    handleExtractEntities(message.text)
      .then(entityMap => sendResponse({ success: true, entityMap }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.action === 'getSettings') {
    chrome.storage.sync.get(DEFAULT_SETTINGS)
      .then(settings => sendResponse({ success: true, settings }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleExtractEntities(text) {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const provider = createProvider(settings.provider, settings.apiKeys || {});
  return provider.extractEntities(text);
}
