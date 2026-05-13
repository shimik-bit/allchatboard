'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Check,
  ExternalLink,
  Loader2,
  Settings,
  Trash2,
  UserMinus,
  UserPlus,
  Shield,
  Target,
  X,
} from 'lucide-react';
import SheetPicker from './SheetPicker';

// ----------------------------------------------------------------------------
// Event type catalogue — these are the things the user can sync to Sheets.
// Each one will be a "row" in the UI: name, description, current destination
// (or "Not synced"), and a button to configure.
//
// Keep this list in sync with the CHECK constraint in
// docs/migrations/2026_05_13_google_integration_phase1.sql.
// ----------------------------------------------------------------------------
type EventTypeMeta = {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  available: boolean; // false = "coming soon" — for features not yet implemented
};

const EVENT_TYPES: EventTypeMeta[] = [
  {
    key: 'gg_new_member',
    label: 'מצטרפים חדשים לקבוצות',
    description: 'כל אדם שמצטרף לקבוצת וואטסאפ מנוטרת — שורה חדשה בגיליון',
    icon: <UserPlus className="w-4 h-4" />,
    available: true,
  },
  {
    key: 'gg_member_left',
    label: 'יציאות מקבוצות',
    description: 'כשמישהו עוזב או מוסר מקבוצה',
    icon: <UserMinus className="w-4 h-4" />,
    available: true,
  },
  {
    key: 'gg_bot_action',
    label: 'פעולות בוט',
    description: 'מחיקות, אזהרות, הסרות שהבוט ביצע (לוג ביקורת)',
    icon: <Shield className="w-4 h-4" />,
    available: true,
  },
  {
    key: 'gg_spam_detected',
    label: 'ספאם שזוהה',
    description: 'הודעות וחברים שזוהו כספאם',
    icon: <AlertCircle className="w-4 h-4" />,
    available: true,
  },
  {
    key: 'attribution_lead',
    label: 'לידים מקמפיינים (Attribution)',
    description: 'יופעל כשפיצ\'ר Attribution יושק',
    icon: <Target className="w-4 h-4" />,
    available: false,
  },
];

type SyncConfig = {
  id: string;
  event_type: string;
  spreadsheet_id: string;
  spreadsheet_name: string | null;
  spreadsheet_url: string | null;
  sheet_tab_name: string;
  is_enabled: boolean;
  write_headers: boolean;
  created_at: string;
  updated_at: string;
  last_synced_at: string | null;
  last_error: string | null;
  last_error_at: string | null;
  consecutive_errors: number;
};

// ----------------------------------------------------------------------------
// Main section component
// ----------------------------------------------------------------------------
export default function SyncConfigsSection() {
  const [configs, setConfigs] = useState<SyncConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pickerForEventType, setPickerForEventType] = useState<string | null>(null);

  const reload = async () => {
    try {
      const res = await fetch('/api/integrations/google/sync-configs');
      if (res.ok) {
        const data = await res.json();
        setConfigs(data.configs ?? []);
      }
    } catch {
      // Silent — show empty list
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleDelete = async (configId: string) => {
    if (!confirm('להסיר את ההגדרה? סנכרון יפסיק לגיליון הזה.')) return;
    try {
      const res = await fetch(`/api/integrations/google/sync-configs/${configId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConfigs((c) => c.filter((x) => x.id !== configId));
      } else {
        alert('ההסרה נכשלה. נסו שוב.');
      }
    } catch {
      alert('שגיאת רשת. נסו שוב.');
    }
  };

  const configByType = new Map<string, SyncConfig>(
    configs.map((c) => [c.event_type, c]),
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-purple-600" />
        <h3 className="text-sm font-semibold text-gray-900">סנכרון אוטומטי לגיליונות</h3>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        לכל סוג אירוע, בחרו גיליון Google Sheets שיקבל את הנתונים בזמן אמת.
        אפשר ליצור גיליון חדש או להשתמש בקיים.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          טוען הגדרות...
        </div>
      ) : (
        <div className="space-y-2">
          {EVENT_TYPES.map((et) => (
            <EventTypeRow
              key={et.key}
              meta={et}
              config={configByType.get(et.key) ?? null}
              onConfigure={() => setPickerForEventType(et.key)}
              onDelete={(id) => handleDelete(id)}
            />
          ))}
        </div>
      )}

      {pickerForEventType && (
        <SheetPicker
          eventTypeKey={pickerForEventType}
          eventTypeLabel={
            EVENT_TYPES.find((e) => e.key === pickerForEventType)?.label ?? ''
          }
          existingConfig={configByType.get(pickerForEventType) ?? null}
          onClose={() => setPickerForEventType(null)}
          onSaved={() => {
            setPickerForEventType(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Single row: one event type with its current destination (or none)
// ----------------------------------------------------------------------------
function EventTypeRow({
  meta,
  config,
  onConfigure,
  onDelete,
}: {
  meta: EventTypeMeta;
  config: SyncConfig | null;
  onConfigure: () => void;
  onDelete: (configId: string) => void;
}) {
  const hasError = config && config.consecutive_errors > 0 && config.last_error;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border ${
        config?.is_enabled
          ? hasError
            ? 'bg-red-50/50 border-red-100'
            : 'bg-white border-gray-200'
          : 'bg-gray-50 border-gray-100'
      } ${!meta.available ? 'opacity-60' : ''}`}
    >
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          config?.is_enabled
            ? 'bg-purple-100 text-purple-600'
            : 'bg-gray-100 text-gray-400'
        }`}
      >
        {meta.icon}
      </div>

      {/* Label + status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-medium text-gray-900 truncate">
            {meta.label}
          </div>
          {!meta.available && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 font-semibold">
              בקרוב
            </span>
          )}
          {config?.is_enabled && !hasError && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
              <Check className="w-2.5 h-2.5" />
              פעיל
            </span>
          )}
          {hasError && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium"
              title={config?.last_error ?? ''}
            >
              <AlertCircle className="w-2.5 h-2.5" />
              שגיאה
            </span>
          )}
        </div>
        {config ? (
          <a
            href={config.spreadsheet_url ?? '#'}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mt-0.5"
          >
            <span className="truncate max-w-[260px]">
              {config.spreadsheet_name ?? 'Untitled'}
              {config.sheet_tab_name && ` › ${config.sheet_tab_name}`}
            </span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        ) : (
          <div className="text-xs text-gray-500 mt-0.5">{meta.description}</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {config && (
          <button
            onClick={() => onDelete(config.id)}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
            title="הסר הגדרה"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={onConfigure}
          disabled={!meta.available}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg transition ${
            meta.available
              ? config
                ? 'text-gray-700 hover:bg-gray-100'
                : 'bg-purple-600 text-white hover:bg-purple-700'
              : 'text-gray-300 cursor-not-allowed'
          }`}
        >
          {config ? (
            <>
              <Settings className="w-3 h-3" />
              שנה
            </>
          ) : (
            <>
              <Settings className="w-3 h-3" />
              הגדר
            </>
          )}
        </button>
      </div>
    </div>
  );
}
