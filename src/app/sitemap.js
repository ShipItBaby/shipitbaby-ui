/**
 * Next.js App Router sitemap generator.
 * Add new routes here as you launch more pages.
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

const BASE_URL = 'https://shipit.baby';

export default function sitemap() {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
