import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AllChatBoard - הפכו צ׳אטים של וואטסאפ ללוחות מנוהלים',
  description: 'פלטפורמת ניהול חכמה שהופכת הודעות וואטסאפ ללוחות נתונים בעזרת AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
