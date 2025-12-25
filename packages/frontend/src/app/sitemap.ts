import type { MetadataRoute } from 'next';

/**
 * Generate sitemap for SEO
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://splityield.org';
  const currentDate = new Date();

  // Main application pages (high priority)
  const mainPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/trade`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/pools`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/mint`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/portfolio`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/analytics`,
      lastModified: currentDate,
      changeFrequency: 'daily',
      priority: 0.7,
    },
  ];

  // Documentation pages (medium priority)
  const docPages: MetadataRoute.Sitemap = [
    // Main docs
    { url: `${baseUrl}/docs`, priority: 0.8 },
    { url: `${baseUrl}/docs/what-is-horizon`, priority: 0.8 },
    { url: `${baseUrl}/docs/getting-started`, priority: 0.8 },
    // How it works
    { url: `${baseUrl}/docs/how-it-works`, priority: 0.7 },
    { url: `${baseUrl}/docs/how-it-works/yield-tokens`, priority: 0.7 },
    { url: `${baseUrl}/docs/how-it-works/amm-mechanics`, priority: 0.7 },
    // Guides
    { url: `${baseUrl}/docs/guides`, priority: 0.7 },
    { url: `${baseUrl}/docs/guides/earn-fixed-yield`, priority: 0.7 },
    { url: `${baseUrl}/docs/guides/trade-yield`, priority: 0.7 },
    { url: `${baseUrl}/docs/guides/provide-liquidity`, priority: 0.7 },
    { url: `${baseUrl}/docs/guides/manage-positions`, priority: 0.7 },
    // Mechanics
    { url: `${baseUrl}/docs/mechanics`, priority: 0.6 },
    { url: `${baseUrl}/docs/mechanics/pricing`, priority: 0.6 },
    { url: `${baseUrl}/docs/mechanics/apy-calculation`, priority: 0.6 },
    { url: `${baseUrl}/docs/mechanics/redemption`, priority: 0.6 },
    // Reference
    { url: `${baseUrl}/docs/risks`, priority: 0.6 },
    { url: `${baseUrl}/docs/faq`, priority: 0.6 },
    { url: `${baseUrl}/docs/glossary`, priority: 0.5 },
    { url: `${baseUrl}/docs/whitepaper`, priority: 0.5 },
  ].map((page) => ({
    ...page,
    lastModified: currentDate,
    changeFrequency: 'weekly' as const,
  }));

  // Legal pages (low priority)
  const legalPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  return [...mainPages, ...docPages, ...legalPages];
}
