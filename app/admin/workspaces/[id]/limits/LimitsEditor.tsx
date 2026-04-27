'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle, CheckCircle2, Database, Users, MessageSquare, Phone, Brain, Shield, Zap, Smartphone, Save, RotateCcw } from 'lucide-react';

type Plan = {
  plan: string;
  display_name: string;
  description: string | null;
  max_tables: number;
  max_records_per_table: number;
  max_total_records: number;
  max_whatsapp_groups: number;
  max_whatsapp_instances: number;
  max_team_members: number;
  max_authorized_phones: number;
  ai_messages_per_month: number;
  ai_model_tier: string;
  whatsapp_messages_per_month: number;
  storage_mb: number;
  feature_groupguard: boolean;
  feature_focus_mode: boolean;
  feature_reports: boolean;
  feature_sequences: boolean;
  feature_automations: boolean;
  feature_api_access: boolean;
  feature_custom_domain: boolean;
  feature_white_label: boolean;
  feature_priority_support: boolean;
  feature_multi_instance: boolean;
  price_ils_monthly: number | null;
};

const LIMIT_FIELDS: Array<{ key: keyof Plan; label: string; icon: any; unit: string; group: string }> = [
  { key: 'max_tables',                    label: 'טבלאות',                 icon: Database,    unit: 'טבלאות',  group: 'משאבים' },
  { key: 'max_total_records',             label: 'רשומות (סה"כ)',           icon: Database,    unit: 'רשומות',  group: 'משאבים' },
  { key: 'max_records_per_table',         label: 'רשומות לטבלה',           icon: Database,    unit: 'לטבלה',   group: 'משאבים' },
  { key: 'max_team_members',              label: 'חברי צוות',              icon: Users,       unit: 'חברים',   group: 'משאבים' },
  { key: 'max_authorized_phones',         label: 'מספרים מורשים',          icon: Phone,       unit: 'מספרים',  group: 'משאבים' },
  { key: 'storage_mb',                    label: 'אחסון',                  icon: Database,    unit: 'MB',      group: 'משאבים' },
  
  { key: 'max_whatsapp_instances',        label: 'WhatsApp Instances',     icon: Smartphone,  unit: 'instances', group: 'WhatsApp' },
  { key: 'max_whatsapp_groups',           label: 'קבוצות WhatsApp',        icon: MessageSquare, unit: 'קבוצות', group: 'WhatsApp' },
  { key: 'whatsapp_messages_per_month',   label: 'הודעות WA/חודש',         icon: MessageSquare, unit: 'הודעות', group: 'WhatsApp' },
  
  { key: 'ai_messages_per_month',         label: 'הודעות AI/חודש',         icon: Brain,       unit: 'הודעות',  group: 'AI' },
];

const FEATURE_FIELDS: Array<{ key: keyof Plan; label: string; description: string }> = [
  { key: 'feature_focus_mode',       label: 'Focus Mode',           description: 'מצב מיקוד עם המלצות AI' },
  { key: 'feature_groupguard',       label: 'GroupGuard',           description: 'הגנה על קבוצות מספאמרים' },
  { key: 'feature_reports',          label: 'דוחות אוטומטיים',     description: 'שליחת דוחות תקופתיים' },
  { key: 'feature_sequences',        label: 'רצפי הודעות',          description: 'תזמון רצפים אוטומטי' },
  { key: 'feature_automations',      label: 'אוטומציות',            description: 'תגובות וסיווג אוטומטי' },
  { key: 'feature_api_access',       label: 'גישה ל-API',           description: 'API חיצוני לאינטגרציות' },
  { key: 'feature_multi_instance',   label: 'ריבוי Instances',     description: 'יותר מ-WhatsApp 1 לסביבה' },
  { key: 'feature_custom_domain',    label: 'דומיין מותאם',         description: 'תת-דומיין משלך' },
  { key: 'feature_white_label',      label: 'White Label',          description: 'הסרת מיתוג TaskFlow' },
  { key: 'feature_priority_support', label: 'תמיכה מועדפת',         description: 'מענה תוך 2 שעות' },
];

export default function LimitsEditor({
  workspaceId,
  workspaceName,
  currentPlan,
  allPlans,
  limitOverrides,
  featureOverrides,
  planNotes,
  planExpiresAt,
  usage,
}: {
  workspaceId: string;
  workspaceName: string;
  currentPlan: string;
  allPlans: Plan[];
  limitOverrides: Record<string, number>;
  featureOverrides: Record<string, boolean>;
  planNotes: string | null;
  planExpiresAt: string | null;
  usage: Record<string, number>;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState(currentPlan);
  const [overrides, setOverrides] = useState<Record<string, number | null>>(limitOverrides);
  const [features, setFeatures] = useState<Record<string, boolean | null>>(featureOverrides);
  const [notes, setNotes] = useState(planNotes || '');
  const [expiresAt, setExpiresAt] = useState(planExpiresAt ? planExpiresAt.split('T')[0] : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const planConfig = allPlans.find(p => p.plan === plan);

  function effectiveLimit(key: string): number {
    if (overrides[key] !== null && overrides[key] !== undefined) return overrides[key] as number;
    return (planConfig as any)?.[key] ?? 0;
  }

  function effectiveFeature(key: string): boolean {
    if (features[key] !== null && features[key] !== undefined) return features[key] as boolean;
    return (planConfig as any)?.[key] ?? false;
  }

  function setOverride(key: string, value: string) {
    const num = value === '' ? null : Number(value);
    setOverrides({ ...overrides, [key]: num });
  }

  function clearOverride(key: string) {
    const next = { ...overrides };
    delete next[key];
    setOverrides(next);
  }

  function toggleFeature(key: string) {
    const planValue = (planConfig as any)?.[key] ?? false;
    const current = features[key];
    if (current === null || current === undefined) {
      // First override - flip the plan default
      setFeatures({ ...features, [key]: !planValue });
    } else if (current === !planValue) {
      // Already overridden - clear back to plan default
      const next = { ...features };
      delete next[key];
      setFeatures(next);
    } else {
      // Edge case
      setFeatures({ ...features, [key]: !current });
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    setSuccess(false);

    try {
      // Clean overrides - remove nulls and values that match plan defaults
      const cleanLimits: Record<string, number> = {};
      for (const [k, v] of Object.entries(overrides)) {
        if (v !== null && v !== undefined && v !== (planConfig as any)?.[k]) {
          cleanLimits[k] = v;
        }
      }

      const cleanFeatures: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(features)) {
        if (v !== null && v !== undefined && v !== (planConfig as any)?.[k]) {
          cleanFeatures[k] = v;
        }
      }

      const res = await fetch(`/api/admin/workspaces/${workspaceId}/limits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          limit_overrides: cleanLimits,
          feature_overrides: cleanFeatures,
          plan_notes: notes || null,
          plan_expires_at: expiresAt || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה בשמירה');
        return;
      }
      setSuccess(true);
      setTimeout(() => router.refresh(), 800);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // Group limit fields by group
  const limitGroups = LIMIT_FIELDS.reduce<Record<string, typeof LIMIT_FIELDS>>((acc, f) => {
    if (!acc[f.group]) acc[f.group] = [];
    acc[f.group].push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Status banner */}
      {error && (
        <div className="bg-red-950/40 border border-red-900 rounded-xl p-3 text-sm text-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-950/40 border border-green-800 rounded-xl p-3 text-sm text-green-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          נשמר בהצלחה
        </div>
      )}

      {/* Plan selector */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 sm:p-5">
        <h2 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          תוכנית (Plan)
        </h2>
        <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2">
          {allPlans.map(p => (
            <button
              key={p.plan}
              onClick={() => setPlan(p.plan)}
              className={`p-3 rounded-lg border-2 text-right transition-all ${
                plan === p.plan
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-700 hover:border-slate-600 bg-slate-800'
              }`}
            >
              <div className="font-bold text-sm truncate">{p.display_name}</div>
              <div className="text-xs text-slate-400 mt-0.5 truncate">
                {p.price_ils_monthly && Number(p.price_ils_monthly) > 0
                  ? `₪${p.price_ils_monthly}/חודש`
                  : 'חינם'}
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">תוקף עד (אופציונלי)</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">הערות סופר אדמין</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: שדרוג בתשלום ידני"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Limits */}
      {Object.entries(limitGroups).map(([group, fields]) => (
        <div key={group} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-200">{group}</h2>
            <span className="text-[10px] text-slate-500">צהוב = override פעיל</span>
          </div>
          <div className="divide-y divide-slate-800">
            {fields.map(field => {
              const Icon = field.icon;
              const planDefault = (planConfig as any)?.[field.key] ?? 0;
              const overrideValue = overrides[field.key];
              const hasOverride = overrideValue !== null && overrideValue !== undefined;
              const effective = hasOverride ? overrideValue : planDefault;
              const used = usage[field.key.replace('max_', '').replace('_per_month', '_used').replace('whatsapp_', 'whatsapp_').replace('total_records', 'records')] ?? 0;
              // Map a few special cases for usage display
              const usedKey: Record<string, string> = {
                'max_tables': 'tables',
                'max_total_records': 'records',
                'max_whatsapp_groups': 'whatsapp_groups',
                'max_whatsapp_instances': 'whatsapp_instances',
                'max_team_members': 'team_members',
                'max_authorized_phones': 'authorized_phones',
                'ai_messages_per_month': 'ai_messages_used',
                'whatsapp_messages_per_month': 'whatsapp_messages_30d',
              };
              const actualUsed = usage[usedKey[field.key as string] || ''] ?? 0;
              const pct = effective > 0 ? Math.min(100, (actualUsed / Number(effective)) * 100) : 0;
              const pctColor = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';

              return (
                <div key={field.key as string} className="p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-200">{field.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 break-words">
                        ברירת מחדל ({plan}): {planDefault.toLocaleString()} {field.unit}
                        {' · '}
                        בשימוש: {actualUsed.toLocaleString()}
                      </div>
                      <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full ${pctColor}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 self-end sm:self-auto">
                    <input
                      type="number"
                      value={hasOverride ? String(overrideValue) : ''}
                      onChange={(e) => setOverride(field.key as string, e.target.value)}
                      placeholder={String(planDefault)}
                      className={`w-24 text-sm px-2 py-1.5 rounded-lg border text-center ${
                        hasOverride
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-200'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    />
                    {hasOverride && (
                      <button
                        onClick={() => clearOverride(field.key as string)}
                        className="text-slate-500 hover:text-slate-300 p-1"
                        title="חזור לברירת מחדל"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Features */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            תכונות (Feature Flags)
          </h2>
          <span className="text-[10px] text-slate-500">צהוב = override פעיל</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {FEATURE_FIELDS.map((field, idx) => {
            const planDefault = (planConfig as any)?.[field.key] ?? false;
            const featureValue = features[field.key];
            const hasOverride = featureValue !== null && featureValue !== undefined;
            const effective = hasOverride ? featureValue : planDefault;

            return (
              <div
                key={field.key as string}
                className={`p-4 flex items-center gap-3 ${idx >= FEATURE_FIELDS.length - 2 ? '' : 'border-b border-slate-800'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-200">{field.label}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{field.description}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    ברירת מחדל ({plan}): {planDefault ? '✓ פעיל' : '✗ כבוי'}
                  </div>
                </div>
                <button
                  onClick={() => toggleFeature(field.key as string)}
                  className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${
                    effective ? 'bg-emerald-500' : 'bg-slate-700'
                  } ${hasOverride ? 'ring-2 ring-amber-500/50' : ''}`}
                  title={hasOverride ? 'override פעיל - לחץ פעמיים לאיפוס' : 'לחץ לשנות'}
                >
                  <div className={`absolute top-0.5 ${effective ? 'right-0.5' : 'right-6'} w-5 h-5 bg-white rounded-full transition-all`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Save button */}
      <div className="sticky bottom-2 sm:bottom-4 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 sm:justify-between shadow-2xl">
        <div className="text-xs text-slate-400 text-center sm:text-right">
          שינויים יחולו מיד ויחסמו פעולות שחורגות מהמגבלות
        </div>
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 flex-shrink-0"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          שמור שינויים
        </button>
      </div>
    </div>
  );
}
