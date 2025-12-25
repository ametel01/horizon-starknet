import type { MetadataRoute } from 'next';

/**
 * Generate robots.txt for search engine crawlers
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://splityield.org';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/', // API routes
          '/faucet', // Test faucet page
          '/monitoring', // Sentry tunnel route
          '/_next/', // Next.js internals
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
