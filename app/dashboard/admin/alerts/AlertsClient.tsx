'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, AlertCircle, Info, CheckCircle2, RefreshCw,
  X, ExternalLink, Loader2, Bell, BellOff
} from 'lucide-react';

interface Alert {
  id: string;
  severity: 'fatal' | 'error' | 'warning';
  source: string;
  title: string;
  details: string | null;
  workspace_id: string | null;
  occurrence_count: number;
  notified_whatsapp_at: string | null;
  notified_email_at: string | null;
  notification_error: string | null;
  is_resolved: boolean;
  resolved_at: string | null;
  resolved_note: string | null;
  metadata: any;
  created_at: string;
  workspaces: {
    name: string;
    workspace_code: string;
  } | null;
}

const SEVERITY_CONFIG = {
  fatal: {
    icon: AlertTriangle,
    label: 'קריטי',
    bgClass: 'bg-red-50 border-red-200',
    textClass: 'text-red-700',
    iconClass: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-800',
  },
  error: {
    icon: AlertCircle,
    label: 'שגיאה',
    bgClass: 'bg-orange-50 border-orange-200',
    textClass: 'text-orange-700',
    iconClass: 'text-orange-600',
    badgeClass: 'bg-orange-100 text-orange-800',
  },
  warning: {
    icon: Info,
    label: 'אזהרה',
    bgClass: 'bg-yellow-50 border-yellow-200',
    textClass: 'text-yellow-700',
    iconClass: 'text-yellow-600',
    badgeClass: 'bg-yellow-100 text-yellow-800',
  },
};

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  cardcom: 'תשלומים',
  ai: 'AI',
  database: 'מסד נתונים',
  cron: 'משימות מתוזמנות',
  webhook: 'Webhooks',
  auth: 'הרשאות',
  other: 'אחר',
};

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'unresolved' | 'resolved' | 'all'>('unresolved');
  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [resolving, setResolving] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: filter });
      if (severityFilter) params.set('severity', severityFilter);
      const res = await fetch(`/api/admin/alerts?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'שגיאה בטעינה');
      } else {
        setAlerts(json.alerts || []);
      }
    } catch (e: any) {
      setError(e?.message || 'שגיאה');
    } finally {
      setLoading(false);
    }
  }, [filter, severityFilter]);

  useEffect(() => {
    loadAlerts();
    // Poll every 30 seconds for new alerts
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const handleResolve = async (alertId: string, action: 'resolve' | 'unresolve') => {
    setResolving(alertId);
    try {
      const res = await fetch('/api/admin/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alertId, action }),
      });
      if (!res.ok) {
        const json = await res.json();
        alert(json.error || 'שגיאה');
      } else {
        loadAlerts();
      }
    } finally {
      setResolving(null);
    }
  };

  const counts = {
    fatal: alerts.filter((a) => a.severity === 'fatal' && !a.is_resolved).length,
    error: alerts.filter((a) => a.severity === 'error' && !a.is_resolved).length,
    warning: alerts.filter((a) => a.severity === 'warning' && !a.is_resolved).length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Bell className="w-7 h-7 text-purple-600" />
              התראות מערכת
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              שגיאות קריטיות שדורשות תשומת לב
            </p>
          </div>
          <button
            onClick={loadAlerts}
            disabled={loading}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 transition flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            רענן
          </button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryTile
            label="קריטיות"
            count={counts.fatal}
            icon={AlertTriangle}
            colorClass="bg-red-50 border-red-200 text-red-700"
            iconClass="text-red-600"
          />
          <SummaryTile
            label="שגיאות"
            count={counts.error}
            icon={AlertCircle}
            colorClass="bg-orange-50 border-orange-200 text-orange-700"
            iconClass="text-orange-600"
          />
          <SummaryTile
            label="אזהרות"
            count={counts.warning}
            icon={Info}
            colorClass="bg-yellow-50 border-yellow-200 text-yellow-700"
            iconClass="text-yellow-600"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">סטטוס:</span>
          {(['unresolved', 'resolved', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 text-xs rounded-lg border transition ${
                filter === f
                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f === 'unresolved' ? 'לא טופלו' : f === 'resolved' ? 'טופלו' : 'הכל'}
            </button>
          ))}
          <span className="text-sm font-semibold text-gray-700 mr-4">חומרה:</span>
          {[
            { value: '', label: 'הכל' },
            { value: 'fatal', label: 'קריטי' },
            { value: 'error', label: 'שגיאה' },
            { value: 'warning', label: 'אזהרה' },
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => setSeverityFilter(s.value)}
              className={`px-3 py-1 text-xs rounded-lg border transition ${
                severityFilter === s.value
                  ? 'bg-purple-100 border-purple-300 text-purple-700'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Alerts list */}
        {loading && alerts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            טוען...
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-gray-900">הכל בסדר! 🎉</p>
            <p className="text-sm text-gray-600 mt-1">
              {filter === 'unresolved' ? 'אין התראות פתוחות.' : 'אין התראות תואמות לסינון.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a) => (
              <AlertCard
                key={a.id}
                alert={a}
                onResolve={() => handleResolve(a.id, a.is_resolved ? 'unresolve' : 'resolve')}
                resolving={resolving === a.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  count,
  icon: Icon,
  colorClass,
  iconClass,
}: {
  label: string;
  count: number;
  icon: any;
  colorClass: string;
  iconClass: string;
}) {
  return (
    <div className={`p-4 rounded-lg border ${colorClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium opacity-75">{label}</p>
          <p className="text-3xl font-bold mt-1">{count}</p>
        </div>
        <Icon className={`w-10 h-10 ${iconClass}`} />
      </div>
    </div>
  );
}

function AlertCard({
  alert,
  onResolve,
  resolving,
}: {
  alert: Alert;
  onResolve: () => void;
  resolving: boolean;
}) {
  const config = SEVERITY_CONFIG[alert.severity];
  const Icon = config.icon;

  return (
    <div
      className={`p-4 rounded-lg border ${config.bgClass} ${alert.is_resolved ? 'opacity-60' : ''}`}
    >
      <div className="flex gap-3">
        <Icon className={`w-5 h-5 ${config.iconClass} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.badgeClass}`}>
              {config.label}
            </span>
            <span className="text-xs text-gray-600">
              {SOURCE_LABELS[alert.source] || alert.source}
            </span>
            {alert.workspaces && (
              <span className="text-xs text-gray-500">
                · {alert.workspaces.name} ({alert.workspaces.workspace_code})
              </span>
            )}
            {alert.occurrence_count > 1 && (
              <span className="text-xs bg-white border border-gray-300 px-2 py-0.5 rounded">
                ×{alert.occurrence_count}
              </span>
            )}
          </div>
          <h3 className={`font-bold ${config.textClass}`}>{alert.title}</h3>
          {alert.details && (
            <pre className="text-xs text-gray-700 mt-2 bg-white/50 p-2 rounded font-mono whitespace-pre-wrap break-words">
              {alert.details}
            </pre>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-2 flex-wrap">
            <span>🕐 {new Date(alert.created_at).toLocaleString('he-IL')}</span>
            {alert.notified_whatsapp_at && <span>📱 נשלח ל-WhatsApp</span>}
            {alert.notified_email_at && <span>📧 נשלח באימייל</span>}
            {alert.notification_error && (
              <span className="text-red-600">❌ {alert.notification_error.slice(0, 60)}</span>
            )}
            {alert.is_resolved && alert.resolved_at && (
              <span className="text-green-700">
                ✅ טופל ב-{new Date(alert.resolved_at).toLocaleDateString('he-IL')}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onResolve}
          disabled={resolving}
          className="text-sm px-3 py-1 border border-gray-300 rounded-lg hover:bg-white transition disabled:opacity-50 flex items-center gap-1.5 self-start"
        >
          {resolving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : alert.is_resolved ? (
            <BellOff className="w-3.5 h-3.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          {alert.is_resolved ? 'בטל' : 'טופל'}
        </button>
      </div>
    </div>
  );
}
