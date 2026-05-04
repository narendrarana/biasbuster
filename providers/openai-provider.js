import { EntityExtractionProvider } from './provider-interface.js';
import { buildPrompt } from './prompt-template.js';

export class OpenAIProvider extends EntityExtractionProvider {
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async extractEntities(pageText) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: buildPrompt(pageText) }],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`OpenAI error ${response.status}: ${err.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned empty response');
    return JSON.parse(content);
  }

  get providerName() {
    return 'GPT-4o Mini (OpenAI)';
  }

  get requiresApiKey() {
    return true;
  }
}
