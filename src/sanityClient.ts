import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: 'fd4mv869', // From your sanity.config.ts
  dataset: 'production',
  useCdn: true, // `false` if you want to ensure fresh data
  apiVersion: '2023-05-03',
});
