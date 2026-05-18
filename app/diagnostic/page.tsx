import DiagnosticClient from './DiagnosticClient';

export const metadata = {
  title: 'אבחון עסקי לחברות בנייה ותשתיות — TaskFlow AI',
  description:
    'שאלון אבחון מקיף ל-2 שלבים: רנטגן פיננסי וסיסטם עבודה טכנולוגי. סוגרים את הברזים, בונים את המנוע.',
  openGraph: {
    title: 'אבחון עסקי לחברות בנייה — TaskFlow AI',
    description:
      'שאלון מקיף ל-2 שלבים: רנטגן פיננסי וסיסטם עבודה טכנולוגי.',
    type: 'website',
  },
};

export default function DiagnosticPage({
  searchParams,
}: {
  searchParams: { utm_source?: string; utm_medium?: string; utm_campaign?: string };
}) {
  return (
    <DiagnosticClient
      utmSource={searchParams.utm_source ?? null}
      utmMedium={searchParams.utm_medium ?? null}
      utmCampaign={searchParams.utm_campaign ?? null}
    />
  );
}
