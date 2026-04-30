'use client';

/**
 * QuickRepliesPicker - dropdown of pre-written reply templates.
 *
 * For now: hardcoded templates that work for any business. Future:
 * per-workspace customization (would store in a `quick_replies` table
 * with workspace_id + slug + text).
 *
 * Templates use {name} placeholder which we replace with the customer's
 * name when known. This keeps replies feeling personal without forcing
 * the agent to type the name every time.
 */

interface Template {
  id: string;
  label: string;
  text: string;
}

const DEFAULT_TEMPLATES: Template[] = [
  {
    id: 'greeting',
    label: 'ברכה ראשונית',
    text: 'שלום {name}! 🌸 קיבלנו את הפנייה שלך וניצור איתך קשר בהקדם.',
  },
  {
    id: 'received',
    label: 'אישור קבלה',
    text: 'תודה ש{name} פנית אלינו! נחזור אליך תוך כשעה.',
  },
  {
    id: 'available_times',
    label: 'בקשת זמינות',
    text: 'באילו תאריכים ושעות יהיה לך הכי נוח? נשמח להתאים.',
  },
  {
    id: 'price_inquiry',
    label: 'תשובה על מחיר',
    text: 'אשמח לפרט. אפשר לדעת איזה שירות בדיוק את מחפשת? כך אוכל לתת לך הצעה מדויקת.',
  },
  {
    id: 'complaint_acknowledge',
    label: 'אישור על תלונה',
    text: 'תודה ששיתפת אותנו. אני לוקחת את זה ברצינות ואחזור אליך תוך 24 שעות עם תשובה מסודרת.',
  },
  {
    id: 'reschedule',
    label: 'אישור שינוי',
    text: 'אין בעיה לשנות. נעדכן אותך כשהשינוי בוצע ✅',
  },
  {
    id: 'closing',
    label: 'סיום נימוסי',
    text: 'תודה רבה! יום נעים 🌸',
  },
  {
    id: 'wait',
    label: 'בקשת המתנה',
    text: 'רק רגע, אני בודקת. אחזור אליך תוך כמה דקות 🙏',
  },
];

export default function QuickRepliesPicker({
  onSelect,
  onClose,
  customerName,
}: {
  onSelect: (text: string) => void;
  onClose: () => void;
  customerName?: string | null;
}) {
  /** Substitute {name} with the customer's first name (or empty string if
   *  unknown — gives "תודה ש פנית אלינו" which is clunky but uncommon). */
  function fill(template: string): string {
    const firstName = customerName?.trim().split(/\s+/)[0] || '';
    return template.replace(/\{name\}/g, firstName);
  }

  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />

      <div className="absolute z-40 bottom-full mb-2 right-0 bg-white rounded-2xl shadow-2xl border border-gray-200 w-80 max-h-96 overflow-y-auto py-1">
        <div className="text-[10px] uppercase tracking-wider text-gray-400 px-3 py-2 font-medium border-b border-gray-100">
          תבניות תגובה
        </div>
        {DEFAULT_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              onSelect(fill(t.text));
              onClose();
            }}
            className="w-full text-right px-3 py-2 hover:bg-gray-50 transition group"
            type="button"
          >
            <div className="text-sm font-medium text-gray-900 mb-0.5">
              {t.label}
            </div>
            <div className="text-xs text-gray-500 line-clamp-1 group-hover:text-gray-700">
              {fill(t.text)}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
