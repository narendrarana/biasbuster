import { EntityExtractionProvider } from './provider-interface.js';

export class GazetteerProvider extends EntityExtractionProvider {
  constructor() {
    super();
    this._db = null; // loaded once, then cached for the lifetime of this service worker instance
  }

  async extractEntities(pageText) {
    if (!this._db) {
      this._db = await this._loadDb();
    }
    const matched = this._matchEntities(pageText, this._db);
    return { entities: matched };
  }

  async _loadDb() {
    const url = chrome.runtime.getURL('data/entities-db.json');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load entities DB: HTTP ${res.status}`);
    return res.json();
  }

  _matchEntities(text, allEntities) {
    const lowerText = text.toLowerCase();
    const matchedIds = new Set();

    // First pass: find entities whose aliases appear in the text
    for (const entity of allEntities) {
      const allAliases = [entity.canonical, ...entity.aliases];
      const found = allAliases.some(alias => this._appearsInText(alias, lowerText));
      if (found) matchedIds.add(entity.id);
    }

    // Second pass: pull in affiliated parties even if not mentioned by name
    // (e.g. article mentions "Bernie Sanders" but not "Democrats" — we still need
    //  party_dem in the result so the affiliation link resolves correctly)
    const initialMatched = [...matchedIds];
    for (const id of initialMatched) {
      const entity = allEntities.find(e => e.id === id);
      if (entity) {
        for (const affId of (entity.affiliations || [])) {
          matchedIds.add(affId);
        }
      }
    }

    return allEntities.filter(e => matchedIds.has(e.id));
  }

  _appearsInText(alias, lowerText) {
    const lowerAlias = alias.toLowerCase();
    let idx = 0;
    while ((idx = lowerText.indexOf(lowerAlias, idx)) !== -1) {
      const before = idx === 0 || !/[a-z0-9]/i.test(lowerText[idx - 1]);
      const after = idx + lowerAlias.length >= lowerText.length || !/[a-z0-9]/i.test(lowerText[idx + lowerAlias.length]);
      if (before && after) return true;
      idx++;
    }
    return false;
  }

  get providerName() {
    return 'Local Database (No API Key)';
  }

  get requiresApiKey() {
    return false;
  }
}
