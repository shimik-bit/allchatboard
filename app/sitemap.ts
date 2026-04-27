import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://allchatboard.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // Public marketing pages
  const marketingPages = [
    { url: '', priority: 1.0, changeFrequency: 'weekly' as const },
    { url: '/auth/login', priority: 0.5, changeFrequency: 'monthly' as const },
    { url: '/auth/signup', priority: 0.9, changeFrequency: 'monthly' as const },
  ];

  // Documentation pages
  const docsPages = [
    { url: '/docs', priority: 0.7, changeFrequency: 'weekly' as const },
    { url: '/docs/getting-started', priority: 0.8, changeFrequency: 'weekly' as const },
    { url: '/docs/faq', priority: 0.7, changeFrequency: 'monthly' as const },
    { url: '/docs/whatsapp', priority: 0.7, changeFrequency: 'monthly' as const },
    { url: '/docs/tables', priority: 0.7, changeFrequency: 'monthly' as const },
    { url: '/docs/reports', priority: 0.7, changeFrequency: 'monthly' as const },
    { url: '/docs/permissions', priority: 0.7, changeFrequency: 'monthly' as const },
    { url: '/docs/api', priority: 0.7, changeFrequency: 'monthly' as const },
  ];

  return [...marketingPages, ...docsPages].map((page) => ({
    url: `${BASE_URL}${page.url}`,
    lastModified: now,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}
