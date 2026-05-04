const MAX_TEXT_CHARS = 8000;

export function buildPrompt(pageText) {
  const truncated = pageText.slice(0, MAX_TEXT_CHARS);
  return `You are a named entity extractor. Given the following article text, extract all named political entities (people, parties, organizations, movements, countries as political actors).

Return ONLY valid JSON in this exact format, with no additional text or markdown:
{ "entities": [ { "id": "e1", "canonical": "...", "aliases": [...], "type": "...", "affiliations": [...] } ] }

Rules:
- Group all surface forms of the same entity (e.g. "Bernie", "Sanders", "Sen. Sanders" → one entity)
- Link people to their party affiliation IDs in the affiliations array
- Include media organizations, think tanks, and PACs if politically relevant
- type must be one of: party | person | org | country | other
- affiliations is an array of entity IDs (e.g. ["e1"]) — use empty array [] if none
- Return empty entities array if no political entities found

Article text:
${truncated}`;
}
