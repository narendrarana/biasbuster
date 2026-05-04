import { EntityExtractionProvider } from './provider-interface.js';
import { buildPrompt } from './prompt-template.js';

export class ClaudeProvider extends EntityExtractionProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async extractEntities(pageText) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{ role: 'user', content: buildPrompt(pageText) }]
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Claude error ${response.status}: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;
    if (!content) throw new Error('Claude returned empty response');
    const json = content.replace(/^```json\s*|\s*```$/g, '').trim();
    return JSON.parse(json);
  }

  get providerName() {
    return 'Claude Haiku (Anthropic)';
  }

  get requiresApiKey() {
    return true;
  }
}
