export class EntityExtractionProvider {
  /**
   * Extract named political entities from page text.
   * @param {string} pageText
   * @returns {Promise<{entities: Array<{id, canonical, aliases, type, affiliations}>}>}
   */
  async extractEntities(pageText) {
    throw new Error('Not implemented');
  }

  get providerName() {
    throw new Error('Not implemented');
  }

  get requiresApiKey() {
    throw new Error('Not implemented');
  }
}
