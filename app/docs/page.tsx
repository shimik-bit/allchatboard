import Link from 'next/link';
import { Rocket, Database, MessageSquare, Shield, HelpCircle, ArrowLeft, Users, FileText } from 'lucide-react';

export default function DocsHome() {
  return (
    <div>
      <div className="text-center mb-12 not-prose">
        <div className="inline-block px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold mb-4">
          📚 תיעוד רשמי
        </div>
        <h1 className="font-display font-black text-4xl md:text-5xl text-gray-900 mb-3 leading-tight">
          איך עובדים<br />עם AllChatBoard?
        </h1>
        <p className="text-gray-600 text-lg max-w-xl mx-auto">
          מצא את התשובה לכל שאלה. בלי חיפושים מיותרים.
        </p>
      </div>

      <div className="not-prose grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
        <FeatureCard
          icon={Rocket}
          title="התחל ב-5 דקות"
          desc="מהמסך הראשון ועד רשומה ראשונה - הצעדים החשובים."
          href="/docs/getting-started"
          color="bg-blue-50 text-blue-700"
        />
        <FeatureCard
          icon={MessageSquare}
          title="חבר את WhatsApp"
          desc="הקסם של המערכת - איך לחבר את הבוט תוך 5 דקות."
          href="/docs/whatsapp"
          color="bg-green-50 text-green-700"
        />
        <FeatureCard
          icon={Database}
          title="טבלאות חכמות"
          desc="איך לבנות טבלאות מצוינות שעוזרות לך לעבוד מהר."
          href="/docs/tables"
          color="bg-amber-50 text-amber-700"
        />
        <FeatureCard
          icon={Shield}
          title="הרשאות וצוות"
          desc="איך לתת לכל אחד בצוות בדיוק את הגישה הנכונה."
          href="/docs/permissions"
          color="bg-pink-50 text-pink-700"
        />
      </div>

      <h2 className="text-2xl font-display font-black mt-12 mb-4">פופולרי השבוע</h2>
      <ul className="not-prose space-y-2">
        <PopularLink href="/docs/whatsapp" label="איך מחברים WhatsApp לראשונה?" />
        <PopularLink href="/docs/tables/relations" label="קישור בין טבלאות עם 3 עמודות תצוגה" />
        <PopularLink href="/docs/whatsapp/groups" label="ניתוב הודעות מקבוצה לטבלה ספציפית" />
        <PopularLink href="/docs/permissions/tables" label="להסתיר טבלה ממשתמש מסוים" />
        <PopularLink href="/docs/faq/troubleshooting" label="הבוט לא מקבל הודעות - מה לבדוק?" />
      </ul>

      <div className="not-prose mt-12 p-6 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-white">
        <div className="flex items-start gap-4">
          <FileText className="w-8 h-8 text-amber-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-lg mb-1">רוצה את הכל בקובץ אחד?</h3>
            <p className="text-gray-300 text-sm mb-4">
              המדריך המלא, 23 עמודים, מסודר ומעוצב - לקריאה offline או להדפסה.
            </p>
            <a
              href="/allchatboard-user-guide.pdf"
              download
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400 text-gray-900 rounded-lg font-bold text-sm hover:bg-amber-300 transition-colors"
            >
              📄 הורד PDF (200KB)
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon: Icon, title, desc, href, color,
}: {
  icon: any;
  title: string;
  desc: string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="group block p-5 bg-white border-2 border-gray-100 rounded-xl hover:border-purple-300 hover:shadow-md transition-all"
    >
      <div className={`inline-flex w-10 h-10 items-center justify-center rounded-lg mb-3 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-bold text-base mb-1 group-hover:text-purple-700 flex items-center gap-1">
        {title} <ArrowLeft className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed">{desc}</p>
    </Link>
  );
}

function PopularLink({ href, label }: { href: string; label: string }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between p-3 bg-gray-50 hover:bg-purple-50 rounded-lg group transition-colors"
      >
        <span className="text-sm text-gray-700 group-hover:text-purple-700 font-medium">{label}</span>
        <ArrowLeft className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:-translate-x-1 transition-all" />
      </Link>
    </li>
  );
}
