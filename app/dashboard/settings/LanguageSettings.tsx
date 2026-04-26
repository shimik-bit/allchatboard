'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n/useT';
import { LOCALE_INFO, Locale } from '@/lib/i18n/locales';
import { Languages, Check, AlertTriangle } from 'lucide-react';

export default function LanguageSettings({
  workspaceId, currentLocale, canEdit,
}: {
  workspaceId: string;
  currentLocale: Locale;
  canEdit: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const supabase = createClient();

  const [selected, setSelected] = useState<Locale>(currentLocale);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const hasChanges = selected !== currentLocale;

  async function handleSave() {
    if (!canEdit || !hasChanges) return;
    setSaving(true);

    const { error } = await supabase
      .from('workspaces')
      .update({ locale: selected })
      .eq('id', workspaceId);

    setSaving(false);
    if (error) {
      setSavedMsg('Error: ' + error.message);
      return;
    }

    setSavedMsg(t('settings.language_changed'));
    // Force a full reload so the LanguageProvider picks up the new locale
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <div className="card p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Languages className="w-5 h-5" />
          {t('settings.language')}
        </h2>
        <span className="text-xs text-gray-500">
          {LOCALE_INFO[currentLocale].flag} {LOCALE_INFO[currentLocale].nativeName}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        {t('onboarding.language_hint')}
      </p>

      {/* Locale picker */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {(['he', 'en'] as Locale[]).map((loc) => {
          const info = LOCALE_INFO[loc];
          const isSelected = selected === loc;
          return (
            <button
              key={loc}
              type="button"
              disabled={!canEdit}
              onClick={() => setSelected(loc)}
              className={`p-4 rounded-xl border-2 text-start transition-all ${
                isSelected
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="text-2xl">{info.flag}</div>
                {isSelected && <Check className="w-5 h-5 text-brand-600" />}
              </div>
              <div className="font-semibold">{info.nativeName}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {loc === 'he' ? 'עברית · RTL' : 'English · LTR'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Warning */}
      {hasChanges && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-3 items-start mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900">
            <strong className="block mb-2">{t('settings.language_warning_title')}</strong>
            <ul className="space-y-1 text-xs">
              <li>• {t('settings.language_warning_ui')}</li>
              <li>• {t('settings.language_warning_bot')}</li>
              <li>• {t('settings.language_warning_ai')}</li>
              <li>• {t('settings.language_warning_reports')}</li>
            </ul>
            <p className="mt-3 text-xs italic">{t('settings.language_warning_data')}</p>
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving || !canEdit}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? t('common.saving') : t('settings.language_save')}
        </button>
        {savedMsg && <span className="text-sm text-green-600">{savedMsg}</span>}
      </div>
    </div>
  );
}
