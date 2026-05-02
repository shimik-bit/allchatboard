// app/solutions/page.tsx
// Solutions Page - דף נחיתה דינמי עם 20 תחומים

import SolutionsClient from './SolutionsClient';

export const metadata = {
  title: 'TaskFlow AI - פתרון מותאם לעסק שלך',
  description: 'מערכת CRM וWhatsApp Business מותאמת לכל תחום - בנייה, מסעדות, רפואה, עו״ד ועוד',
};

export default function SolutionsPage() {
  return <SolutionsClient />;
}
