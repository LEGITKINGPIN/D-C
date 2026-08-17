import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/studio/'], // Disallow API routes or CMS paths if they exist
    },
    sitemap: 'https://dcmediahouse.in/sitemap.xml',
  };
}
