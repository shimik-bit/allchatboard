import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://allchatboard.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/auth/login', '/auth/signup', '/docs/', '/pricing'],
        disallow: [
          '/api/',
          '/dashboard/',
          '/onboarding/',
          '/admin/',
          '/auth/callback',
          '/auth/reset-password',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
