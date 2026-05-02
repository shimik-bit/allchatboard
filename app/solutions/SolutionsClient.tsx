// app/solutions/SolutionsClient.tsx
// דף Solutions אינטראקטיבי - בוחרים תחום ורואים פתרון
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, Check, ArrowLeft, Sparkles } from 'lucide-react';
import { INDUSTRIES, type Industry } from '@/lib/industries';

export default function SolutionsClient() {
  const [selected, setSelected] = useState<Industry | null>(null);
  const [showAllIndustries, setShowAllIndustries] = useState(false);

  // אם יש industry param ב-URL - בחר אותו אוטומטית
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('industry');
    if (slug) {
      const found = INDUSTRIES.find(i => i.slug === slug);
      if (found) setSelected(found);
    }
  }, []);

  // עדכון URL כשבוחרים תחום (בלי refresh)
  function selectIndustry(industry: Industry) {
    setSelected(industry);
    setShowAllIndustries(false);
    const url = new URL(window.location.href);
    url.searchParams.set('industry', industry.slug);
    window.history.pushState({}, '', url);
    
    // גלילה למטה לתוכן הספציפי
    setTimeout(() => {
      document.getElementById('industry-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  function clearSelection() {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('industry');
    window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 8 התחומים הראשיים שמופיעים תמיד
  const FEATURED = INDUSTRIES.slice(0, 8);
  const REST = INDUSTRIES.slice(8);
  const visibleIndustries = showAllIndustries ? INDUSTRIES : FEATURED;

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      
      {/* ============ Header ============ */}
      <header className="border-b border-gray-100 bg-white/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold" 
                 style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}>
              ⚡
            </div>
            <span className="font-bold text-gray-900">TaskFlow AI</span>
          </Link>
          <Link 
            href="/auth/login"
            className="text-sm bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
          >
            התחל בחינם
          </Link>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section className="bg-gradient-to-br from-purple-50 via-white to-pink-50 px-4 pt-12 pb-8">
        <div className="max-w-4xl mx-auto text-center">
          
          {!selected ? (
            <>
              <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-medium mb-4">
                <Sparkles className="w-3 h-3" />
                <span>{INDUSTRIES.length} פתרונות מותאמים</span>
              </div>
              
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                מערכת אחת.<br/>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  מותאמת בדיוק לתחום שלך.
                </span>
              </h1>
              
              <p className="text-base md:text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                בחר את התחום שלך ונראה לך איך TaskFlow AI יעבוד עבורך - 
                כולל פיצ׳רים ספציפיים, מחיר, ודוגמאות שימוש.
              </p>

              {/* בחירת תחום */}
              <div className="bg-white rounded-3xl p-6 shadow-xl border-2 border-purple-100 max-w-3xl mx-auto">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-4">
                  <span className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold">1</span>
                  <span>איזה עסק אתה?</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  {visibleIndustries.map(industry => (
                    <button
                      key={industry.slug}
                      onClick={() => selectIndustry(industry)}
                      className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-all group"
                    >
                      <span className="text-3xl group-hover:scale-110 transition-transform">{industry.emoji}</span>
                      <span className="text-xs font-medium text-gray-700">{industry.shortName}</span>
                    </button>
                  ))}
                </div>

                {!showAllIndustries && (
                  <button
                    onClick={() => setShowAllIndustries(true)}
                    className="w-full py-2 text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center justify-center gap-1"
                  >
                    <span>הצג עוד {REST.length} תחומים</span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Trust signals */}
              <div className="mt-8 flex items-center justify-center gap-4 flex-wrap text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>14 ימי ניסיון חינם</span>
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>ללא כרטיס אשראי</span>
                </span>
                <span className="flex items-center gap-1">
                  <Check className="w-4 h-4 text-green-500" />
                  <span>הקמה ב-5 דקות</span>
                </span>
              </div>
            </>
          ) : (
            <>
              <button 
                onClick={clearSelection}
                className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700 mb-4"
              >
                <ArrowLeft className="w-4 h-4 rotate-180" />
                <span>בחר תחום אחר</span>
              </button>
              
              <div className="text-7xl mb-4">{selected.emoji}</div>
              
              <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4 leading-tight">
                TaskFlow AI<br/>
                <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  ל{selected.name}
                </span>
              </h1>
              
              <p className="text-base md:text-xl text-gray-700 mb-2 max-w-2xl mx-auto font-medium">
                {selected.pain}
              </p>
              <p className="text-base md:text-lg text-purple-700 max-w-2xl mx-auto">
                {selected.promise}
              </p>
              
              <div className="mt-8 flex gap-3 justify-center flex-wrap">
                <Link 
                  href="/auth/signup"
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:shadow-xl text-base font-bold transition-all"
                >
                  התחל ניסיון חינם
                </Link>
                <a 
                  href="#features"
                  className="px-8 py-3 bg-white text-gray-700 border-2 border-gray-200 rounded-xl hover:border-gray-300 text-base font-medium"
                >
                  גלה את הפיצ׳רים ↓
                </a>
              </div>
            </>
          )}
        </div>
      </section>

      {/* ============ Industry-Specific Content ============ */}
      {selected && (
        <div id="industry-content" className="bg-white">
          
          {/* Features */}
          <section id="features" className="px-4 py-12 md:py-16">
            <div className="max-w-5xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                4 פיצ׳רים שייעלו לך את העבודה
              </h2>
              <p className="text-gray-600 text-center mb-10">
                מותאמים ל{selected.name} - בנויים מהשטח, לא תיאוריה
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selected.features.map((f, idx) => (
                  <div 
                    key={idx} 
                    className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border-2 border-purple-100"
                  >
                    <div className="text-4xl mb-3">{f.icon}</div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">{f.title}</h3>
                    <p className="text-sm text-gray-600 leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Use Cases */}
          <section className="px-4 py-12 bg-gradient-to-br from-purple-50/50 to-white">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-2">
                מתאים לכל סוגי {selected.shortName}
              </h2>
              <p className="text-gray-600 text-center mb-10">
                בין אם אתה {selected.useCases.slice(0, 2).join(' או ')} - יש פתרון בשבילך
              </p>

              <div className="flex flex-wrap gap-2 justify-center">
                {selected.useCases.map((useCase, idx) => (
                  <div 
                    key={idx}
                    className="bg-white border-2 border-purple-200 rounded-full px-5 py-3 text-sm font-medium text-gray-700 hover:border-purple-400 hover:shadow-md transition-all"
                  >
                    ✓ {useCase}
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Testimonial */}
          {selected.testimonial && (
            <section className="px-4 py-12">
              <div className="max-w-3xl mx-auto">
                <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-8 md:p-10 text-white text-center">
                  <div className="text-5xl mb-4">"</div>
                  <p className="text-xl md:text-2xl font-medium mb-6 leading-relaxed">
                    {selected.testimonial.quote}
                  </p>
                  <div className="text-sm opacity-90">
                    <strong>{selected.testimonial.author}</strong> · {selected.testimonial.role}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Pricing */}
          <section className="px-4 py-12 bg-gradient-to-br from-slate-50 to-purple-50">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-2xl md:text-3xl font-bold mb-2">
                מחיר ל{selected.name}
              </h2>
              <p className="text-gray-600 mb-8">
                ללא הפתעות. ללא חוזה ארוך. בטל מתי שתרצה.
              </p>
              
              <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-purple-100 max-w-md mx-auto">
                <div className="text-purple-600 text-sm font-bold mb-2">
                  Pack מומלץ: {selected.recommendedPack}
                </div>
                
                <div className="flex items-baseline justify-center gap-2 mb-1">
                  <span className="text-5xl font-bold">₪{selected.startingPrice}</span>
                  <span className="text-gray-500">/חודש</span>
                </div>
                <div className="text-xs text-gray-500 mb-6">החל מ- · ללא מע״מ</div>
                
                <ul className="text-right space-y-3 mb-8">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>14 ימי ניסיון חינם</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>הקמה והדרכה כלולים</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>WhatsApp Business API מובנה</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span>תמיכה בעברית</span>
                  </li>
                </ul>

                <Link 
                  href="/auth/signup"
                  className="block w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl text-base font-bold hover:shadow-xl transition-all"
                >
                  התחל בחינם עכשיו
                </Link>
                <p className="text-xs text-gray-500 mt-3">ללא כרטיס אשראי בהתחלה</p>
              </div>
            </div>
          </section>

          {/* Cross-sell other industries */}
          <section className="px-4 py-12 bg-white border-t border-gray-100">
            <div className="max-w-5xl mx-auto">
              <p className="text-center text-sm text-gray-500 mb-6">לא בתחום שלך? תסתכל גם:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {INDUSTRIES.filter(i => i.slug !== selected.slug).slice(0, 8).map(i => (
                  <button
                    key={i.slug}
                    onClick={() => selectIndustry(i)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-purple-100 rounded-lg text-sm transition-colors"
                  >
                    <span>{i.emoji}</span>
                    <span>{i.shortName}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

        </div>
      )}

      {/* ============ Footer ============ */}
      <footer className="border-t border-gray-100 bg-gray-50 px-4 py-8 mt-auto">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          <p>TaskFlow AI · CRM ו-WhatsApp Business לעסקים בישראל</p>
          <p className="mt-2">
            <Link href="/" className="hover:text-purple-600">דף הבית</Link>
            <span className="mx-2">·</span>
            <Link href="/privacy" className="hover:text-purple-600">פרטיות</Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="hover:text-purple-600">תנאי שימוש</Link>
          </p>
        </div>
      </footer>

    </div>
  );
}
