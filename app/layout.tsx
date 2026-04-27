import type { Metadata } from 'next';
import './globals.css';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://allchatboard.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'AllChatBoard - הפכו צ׳אטים של וואטסאפ ללוחות מנוהלים',
    template: '%s | AllChatBoard',
  },
  description: 'פלטפורמת ניהול חכמה שהופכת הודעות וואטסאפ ללוחות נתונים בעזרת AI. מתאימה למוסכים, מסעדות, נדל״ן ועוד.',
  keywords: ['WhatsApp CRM', 'AllChat', 'ניהול וואטסאפ', 'CRM ישראלי', 'AI WhatsApp', 'לוחות נתונים', 'אוטומציה עסקית'],
  authors: [{ name: 'AllChat' }],
  creator: 'AllChat',
  publisher: 'AllChat',
  icons: {
    icon: '/favicon.ico',
    apple: '/taskflow-icon.png',
  },
  openGraph: {
    type: 'website',
    locale: 'he_IL',
    url: BASE_URL,
    siteName: 'AllChatBoard',
    title: 'AllChatBoard - הפכו צ׳אטים של וואטסאפ ללוחות מנוהלים',
    description: 'פלטפורמת ניהול חכמה שהופכת הודעות וואטסאפ ללוחות נתונים בעזרת AI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'AllChatBoard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AllChatBoard - WhatsApp Business Management',
    description: 'הפכו צ׳אטים של וואטסאפ ללוחות מנוהלים בעזרת AI',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: BASE_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
