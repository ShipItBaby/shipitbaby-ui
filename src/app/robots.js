/**
 * Next.js App Router robots.txt generator.
 * Blocks all known AI training crawlers while allowing search engines.
 * https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

export default function robots() {
  return {
    rules: [
      // ── Allow regular search-engine crawlers ──────────────────────────
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },

      // ── Block AI training / scraping bots ────────────────────────────
      // OpenAI
      { userAgent: 'GPTBot',            disallow: '/' },
      { userAgent: 'ChatGPT-User',      disallow: '/' },
      { userAgent: 'OAI-SearchBot',     disallow: '/' },
      // Anthropic
      { userAgent: 'ClaudeBot',         disallow: '/' },
      { userAgent: 'Claude-Web',        disallow: '/' },
      { userAgent: 'anthropic-ai',      disallow: '/' },
      // Google AI
      { userAgent: 'Google-Extended',   disallow: '/' },
      // Meta AI
      { userAgent: 'FacebookBot',       disallow: '/' },
      // Apple
      { userAgent: 'Applebot-Extended', disallow: '/' },
      // Amazon
      { userAgent: 'Amazonbot',         disallow: '/' },
      // Bytedance
      { userAgent: 'Bytespider',        disallow: '/' },
      // Common AI scrapers
      { userAgent: 'CCBot',             disallow: '/' },
      { userAgent: 'DataForSeoBot',     disallow: '/' },
      { userAgent: 'omgili',            disallow: '/' },
      { userAgent: 'omgilibot',         disallow: '/' },
      { userAgent: 'cohere-ai',         disallow: '/' },
      { userAgent: 'PerplexityBot',     disallow: '/' },
      { userAgent: 'YouBot',            disallow: '/' },
      { userAgent: 'PetalBot',          disallow: '/' },
      { userAgent: 'img2dataset',       disallow: '/' },
    ],
    sitemap: 'https://shipit.baby/sitemap.xml',
  };
}
