import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaskFlow AI - WhatsApp Task Monitoring & Documentation',
  description: 'פלטפורמת AI חכמה שהופכת הודעות וואטסאפ ללוחות נתונים מנוהלים. מופעל על ידי AllChat.',
  icons: {
    icon: '/taskflow-icon.png',
    apple: '/taskflow-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
