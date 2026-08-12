export const SITE_URL = 'https://maccrate.ai';
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const PERSON_ID = `${SITE_URL}/#max-maccrate`;

export const MAX_PERSON = {
  '@context': 'https://schema.org',
  '@type': 'Person',
  '@id': PERSON_ID,
  name: 'Max MacCrate',
  url: `${SITE_URL}/about`,
  sameAs: [
    'https://github.com/mmaccrate',
    'https://www.linkedin.com/in/mmaccrate/',
    'https://huggingface.co/mmaccrate',
  ],
};

export const MAX_PERSON_REFERENCE = { '@id': PERSON_ID };
export const WEBSITE_REFERENCE = { '@id': WEBSITE_ID };
