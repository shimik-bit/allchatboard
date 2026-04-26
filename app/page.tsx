import Link from 'next/link';
import {
  MessageSquare, Sparkles, LayoutGrid, Zap,
  Users, Shield, Search, BarChart3, Award,
  Trash2, UserX, Crown, Check, X, ArrowLeft,
  Briefcase, Globe,
} from 'lucide-react';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-brand-50/30">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <img
              src="/taskflow-logo.png"
              alt="TaskFlow AI"
              className="h-12 w-auto object-contain"
            />
          </Link>
          <div className="flex items-center gap-3">
            <a href="#groupguard" className="hidden sm:inline text-sm text-gray-600 hover:text-purple-600 transition-colors">
              הגנה ופרופילים
            </a>
            <Link href="/auth/login" className="btn-ghost">התחברות</Link>
            <Link href="/auth/signup" className="btn-primary">התחל חינם</Link>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-100 text-brand-700 text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          חדש: AI מסווג אוטומטית כל הודעה לטבלה הנכונה
        </div>
        <h1 className="font-display font-bold text-5xl md:text-7xl leading-tight mb-6">
          הפכו צ׳אטים של וואטסאפ
          <br />
          <span className="bg-gradient-to-l from-brand-600 to-purple-500 bg-clip-text text-transparent">
            ללוחות מנוהלים
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
          TaskFlow AI לוקח את כל ההודעות מקבוצות הוואטסאפ של העסק שלך, מסווג אותן עם AI,
          וממלא אוטומטית טבלאות מותאמות לתחום שלך.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/auth/signup" className="btn-primary text-base px-6 py-3">
            התחל ניסיון חינם של 14 יום
          </Link>
          <Link href="#features" className="btn-secondary text-base px-6 py-3">
            איך זה עובד?
          </Link>
        </div>
      </section>

      <section id="features" className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-6">
        <FeatureCard
          icon={<MessageSquare className="w-6 h-6" />}
          title="חיבור פשוט לוואטסאפ"
          desc="חברו את הקבוצות תוך 2 דקות באמצעות AllChat. אנחנו מקשיבים לכל ההודעות."
        />
        <FeatureCard
          icon={<Sparkles className="w-6 h-6" />}
          title="AI שמבין את העסק שלכם"
          desc="ה-AI לומד את הענף שלכם — מוסך, מסעדה, נדל״ן — ומסווג כל הודעה לטבלה הנכונה."
        />
        <FeatureCard
          icon={<LayoutGrid className="w-6 h-6" />}
          title="לוחות שמתאימים בדיוק לכם"
          desc="טבלאות, קנבן, לוח שנה — כל תצוגה לכל סוג נתונים. בנו את העסק שלכם בצורה ויזואלית."
        />
      </section>

      {/* GroupGuard + Member Profiles section */}
      <section id="groupguard" className="bg-gradient-to-b from-purple-50/40 via-white to-pink-50/30 py-20 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-6">
          {/* Section header */}
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm font-medium mb-4">
              <Shield className="w-4 h-4" />
              חדש בTaskFlow AI
            </div>
            <h2 className="font-display font-bold text-4xl md:text-5xl mb-4">
              <span className="bg-gradient-to-l from-purple-600 to-pink-500 bg-clip-text text-transparent">
                הגנה חכמה
              </span>{' '}
              ופרופילי חברים
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              הוסיפו את הבוט לקבוצות הוואטסאפ שלכם וקבלו AI שלומד מי החברים, מה הם עושים,
              ומגן על הקבוצה מספאם.
            </p>
          </div>

          {/* Two pricing tiers based on bot permissions */}
          <div className="grid md:grid-cols-2 gap-6 mb-14">
            {/* Tier 1: Member */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm relative overflow-hidden">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium mb-3">
                    <Users className="w-3 h-3" />
                    בוט כחבר רגיל בקבוצה
                  </div>
                  <h3 className="font-display font-bold text-2xl">
                    תובנות ומאגר ידע
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    הוספה רגילה לקבוצה - 30 שניות
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-blue-50 grid place-items-center text-blue-600 flex-shrink-0">
                  <Users className="w-7 h-7" />
                </div>
              </div>

              <ul className="space-y-3 mb-2">
                <BotFeature
                  icon={<Briefcase className="w-4 h-4" />}
                  title="פרופילי חברים אוטומטיים"
                  desc="AI בונה פרופיל לכל חבר: שם, מקצוע, עסק, אתר, התמחות"
                />
                <BotFeature
                  icon={<Search className="w-4 h-4" />}
                  title="חיפוש לפי תחום"
                  desc='למשל: "מי כאן עורך דין מסחרי?" - תקבלי רשימה'
                />
                <BotFeature
                  icon={<BarChart3 className="w-4 h-4" />}
                  title="דשבורד וסטטיסטיקות"
                  desc="גרפים על פעילות הקבוצה, חברים פעילים, נושאים חמים"
                />
                <BotFeature
                  icon={<Award className="w-4 h-4" />}
                  title="אחוז שלמות פרופיל"
                  desc="עיגול אחוזים שגדל ככל שאוספים יותר מידע על כל חבר"
                />
                <BotFeature
                  icon={<MessageSquare className="w-4 h-4" />}
                  title="מאגר הודעות חכם"
                  desc="כל ההודעות נשמרות ומוצגות בפרופיל של השולח"
                />
              </ul>
            </div>

            {/* Tier 2: Admin */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-6 sm:p-8 shadow-lg text-white relative overflow-hidden">
              {/* Decorative pattern */}
              <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full -translate-y-12 -translate-x-12 blur-2xl"></div>
              <div className="absolute bottom-0 right-0 w-32 h-32 bg-yellow-400/20 rounded-full translate-y-12 translate-x-12 blur-2xl"></div>

              <div className="relative">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-white text-xs font-medium mb-3 backdrop-blur">
                      <Crown className="w-3 h-3" />
                      בוט עם הרשאות אדמין
                    </div>
                    <h3 className="font-display font-bold text-2xl">
                      כל מה שלמעלה +{' '}
                      <span className="text-yellow-200">הגנה אוטומטית</span>
                    </h3>
                    <p className="text-sm text-purple-100 mt-1">
                      הפכו את הבוט לאדמין - שומר על הקבוצה במקומכם
                    </p>
                  </div>
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur grid place-items-center text-white flex-shrink-0">
                    <Shield className="w-7 h-7" />
                  </div>
                </div>

                <ul className="space-y-3">
                  <BotFeature
                    icon={<Trash2 className="w-4 h-4" />}
                    title="מחיקת ספאם אוטומטית"
                    desc="AI מזהה ספאם, פרסומות, פישינג - ומוחק לפני שחברים רואים"
                    onDark
                  />
                  <BotFeature
                    icon={<UserX className="w-4 h-4" />}
                    title="הסרת ספאמרים"
                    desc="חוזרים על עצמם? מורחקים אוטומטית מהקבוצה"
                    onDark
                  />
                  <BotFeature
                    icon={<Globe className="w-4 h-4" />}
                    title="חסימת קידומות מדינה"
                    desc="הגדירו אילו מדינות חסומות מראש (למשל קידומות חשודות)"
                    onDark
                  />
                  <BotFeature
                    icon={<Shield className="w-4 h-4" />}
                    title="מאגר ספאמרים גלובלי"
                    desc="ספאמר שדווח באלפי קבוצות אחרות - יחסם אוטומטית גם אצלכם"
                    onDark
                  />
                  <BotFeature
                    icon={<Sparkles className="w-4 h-4" />}
                    title="דיווח ידני בתיוג"
                    desc='חברי הקבוצה יכולים לתייג את הבוט עם "ספאם" והוא יסיר'
                    onDark
                  />
                </ul>
              </div>
            </div>
          </div>

          {/* Comparison table for clarity */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-display font-bold text-lg">השוואה מהירה</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                מה מקבלים בכל רמת הרשאה
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              <ComparisonRow
                feature="פרופילי חברים אוטומטיים"
                member={true}
                admin={true}
              />
              <ComparisonRow
                feature="חיפוש לפי מקצוע / תחום"
                member={true}
                admin={true}
              />
              <ComparisonRow
                feature="דשבורד וסטטיסטיקות"
                member={true}
                admin={true}
              />
              <ComparisonRow
                feature="לוג פעילות מלא"
                member={true}
                admin={true}
              />
              <ComparisonRow
                feature="אזהרות אוטומטיות בצ'אט"
                member={true}
                admin={true}
              />
              <ComparisonRow
                feature="מחיקת הודעות ספאם"
                member={false}
                admin={true}
              />
              <ComparisonRow
                feature="הסרת ספאמרים"
                member={false}
                admin={true}
              />
              <ComparisonRow
                feature="חסימת קידומות מדינה"
                member={false}
                admin={true}
              />
              <ComparisonRow
                feature="מאגר ספאמרים חוצה-קבוצות"
                member={false}
                admin={true}
              />
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center mt-12">
            <p className="text-gray-600 mb-4 text-sm">
              💡 אפשר להתחיל מהבסיסי ולהפוך את הבוט לאדמין מאוחר יותר
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity"
            >
              התחל ניסיון חינם
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 mt-20 py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-gray-500">
          © 2026 TaskFlow AI. מופעל על ידי <a href="https://allchat.co.il" className="hover:underline">AllChat</a>. נבנה עם <Zap className="w-3.5 h-3.5 inline text-brand-500" /> בישראל.
        </div>
      </footer>
    </main>
  );
}

function FeatureCard({
  icon, title, desc,
}: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 grid place-items-center mb-4">
        {icon}
      </div>
      <h3 className="font-display font-bold text-lg mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}


function BotFeature({
  icon, title, desc, onDark = false,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onDark?: boolean;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 mt-0.5 ${
        onDark
          ? 'bg-white/15 text-yellow-200 backdrop-blur'
          : 'bg-blue-50 text-blue-600'
      }`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-medium text-sm ${onDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </div>
        <div className={`text-xs leading-relaxed ${onDark ? 'text-purple-100' : 'text-gray-600'}`}>
          {desc}
        </div>
      </div>
    </li>
  );
}


function ComparisonRow({
  feature, member, admin,
}: {
  feature: string;
  member: boolean;
  admin: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
      <div className="text-sm text-gray-700 font-medium">{feature}</div>
      <div className="w-32 sm:w-40 text-center">
        {member ? (
          <span className="inline-flex items-center gap-1 text-blue-600 text-sm">
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">חבר</span>
          </span>
        ) : (
          <span className="inline-flex items-center text-gray-300 text-sm">
            <X className="w-4 h-4" />
          </span>
        )}
      </div>
      <div className="w-32 sm:w-40 text-center">
        {admin ? (
          <span className="inline-flex items-center gap-1 text-purple-600 text-sm">
            <Check className="w-4 h-4" />
            <span className="hidden sm:inline">אדמין</span>
          </span>
        ) : (
          <span className="inline-flex items-center text-gray-300 text-sm">
            <X className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
}
