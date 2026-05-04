import { EntityExtractionProvider } from './provider-interface.js';

const MOCK_ENTITY_MAP = {
  entities: [
    {
      id: 'e1',
      canonical: 'Democratic Party',
      aliases: ['Democrats', 'Democratic'],
      type: 'party',
      affiliations: []
    },
    {
      id: 'e2',
      canonical: 'Republican Party',
      aliases: ['Republicans', 'Republican', 'GOP'],
      type: 'party',
      affiliations: []
    },
    {
      id: 'e3',
      canonical: 'Joe Biden',
      aliases: ['Biden', 'President Biden'],
      type: 'person',
      affiliations: ['e1']
    },
    {
      id: 'e4',
      canonical: 'Donald Trump',
      aliases: ['Trump', 'former President Trump', 'President Trump'],
      type: 'person',
      affiliations: ['e2']
    },
    {
      id: 'e5',
      canonical: 'Bernie Sanders',
      aliases: ['Sanders', 'Sen. Sanders', 'Bernie'],
      type: 'person',
      affiliations: ['e1']
    },
    {
      id: 'e6',
      canonical: 'Mitch McConnell',
      aliases: ['McConnell', 'Sen. McConnell', 'Senate Minority Leader McConnell'],
      type: 'person',
      affiliations: ['e2']
    },
    {
      id: 'e7',
      canonical: 'Nancy Pelosi',
      aliases: ['Pelosi', 'Rep. Pelosi', 'Speaker Pelosi', 'former Speaker Pelosi'],
      type: 'person',
      affiliations: ['e1']
    },
    {
      id: 'e8',
      canonical: 'Senate',
      aliases: ['U.S. Senate', 'United States Senate'],
      type: 'org',
      affiliations: []
    },
    {
      id: 'e9',
      canonical: 'House of Representatives',
      aliases: ['U.S. House', 'Congress'],
      type: 'org',
      affiliations: []
    }
  ]
};

export class MockProvider extends EntityExtractionProvider {
  async extractEntities(_pageText) {
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_ENTITY_MAP;
  }

  get providerName() {
    return 'Mock (No API Key Required)';
  }

  get requiresApiKey() {
    return false;
  }
}
