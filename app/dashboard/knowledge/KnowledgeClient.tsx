'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Brain, Sparkles, Plus, Trash2, Edit2, Save, X, 
  MessageCircle, FileText, Globe, HelpCircle,
  Zap, Loader2, CheckCircle2, AlertCircle, Settings, BarChart3, BookOpen,
  ToggleRight, Crown
} from 'lucide-react';

type Bot = any;
type Source = any;
type Stats = any;

const SOURCE_TYPES = [
  { key: 'faq', label: 'שאלה ותשובה', icon: HelpCircle, color: 'bg-blue-100 text-blue-600' },
  { key: 'text', label: 'טקסט חופשי', icon: FileText, color: 'bg-purple-100 text-purple-600' },
  { key: 'website', label: 'קישור לאתר', icon: Globe, color: 'bg-green-100 text-green-600' },
];

export default function KnowledgeClient({
  workspace,
  allWorkspaces,
  bot: initialBot,
  sources: initialSources,
  stats,
  instances,
  hasFeature,
  userRole,
}: {
  workspace: { id: string; name: string; icon: string | null; plan: string };
  allWorkspaces: Array<{ id: string; name: string; icon: string | null }>;
  bot: Bot;
  sources: Source[];
  stats: Stats;
  instances: any[];
  hasFeature: boolean;
  userRole: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<'config' | 'sources' | 'analytics'>('sources');
  const [bot, setBot] = useState<Bot>(initialBot);
  const [sources, setSources] = useState<Source[]>(initialSources);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const canEdit = ['owner', 'admin', 'editor'].includes(userRole);

  async function updateBot(updates: Partial<Bot>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge/bot', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }
      setBot(data.bot);
    } finally {
      setBusy(false);
    }
  }

  async function addSource(payload: any) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/knowledge/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspace.id, ...payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return false;
      }
      setSources([data.source, ...sources]);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function updateSource(id: string, updates: any) {
    setBusy(true);
    try {
      const res = await fetch(`/api/knowledge/sources/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return false; }
      setSources(sources.map(s => s.id === id ? data.source : s));
      return true;
    } finally { setBusy(false); }
  }

  async function deleteSource(id: string) {
    if (!confirm('למחוק את המקור?')) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/knowledge/sources/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }
      setSources(sources.filter(s => s.id !== id));
    } finally { setBusy(false); }
  }

  if (!hasFeature) {
    return (
      <div className="p-4 md:p-8 max-w-2xl mx-auto">
        <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-3xl p-8 text-white text-center">
          <Crown className="w-16 h-16 mx-auto mb-3 opacity-90" />
          <h1 className="text-3xl font-bold mb-2">בוט מידע AI ללקוחות</h1>
          <p className="opacity-90 mb-6">הפיצ'ר זה זמין בתוכנית עסקי וארגוני בלבד</p>
          <button
            onClick={() => router.push(`/dashboard/billing?ws=${workspace.id}`)}
            className="bg-white text-purple-600 font-bold px-6 py-3 rounded-xl hover:opacity-90"
          >
            <Sparkles className="w-4 h-4 inline ml-2" />
            שדרג עכשיו
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1 flex items-center gap-2">
            <Brain className="w-7 h-7 text-purple-600" />
            בוט מידע AI
          </h1>
          <p className="text-gray-500 text-sm">לקוחות שואלים, הבוט עונה על בסיס המידע שלך</p>
        </div>
        <div className="flex items-center gap-3">
          {allWorkspaces.length > 1 && (
            <select
              value={workspace.id}
              onChange={(e) => router.push(`/dashboard/knowledge?ws=${e.target.value}`)}
              className="text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm"
            >
              {allWorkspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.icon || '📊'} {ws.name}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => updateBot({ is_enabled: !bot.is_enabled })}
            disabled={busy || !canEdit}
            className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 ${
              bot.is_enabled 
                ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <ToggleRight className="w-4 h-4" />
            {bot.is_enabled ? 'הבוט פעיל' : 'הבוט כבוי'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="mr-auto"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <StatCard label="מקורות מידע" value={stats.sources_count || 0} max={stats.sources_limit || 0} icon={BookOpen} />
          <StatCard label="הודעות החודש" value={stats.messages_this_month || 0} max={stats.messages_limit || 0} icon={MessageCircle} />
          <StatCard label="שיחות פעילות" value={stats.conversations_active_30d || 0} icon={Zap} />
          <StatCard label="סה״כ הודעות" value={stats.messages_received_total || 0} icon={BarChart3} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <TabBtn active={tab === 'sources'} onClick={() => setTab('sources')} icon={BookOpen} label="מקורות מידע" count={sources.length} />
        <TabBtn active={tab === 'config'} onClick={() => setTab('config')} icon={Settings} label="הגדרות" />
        <TabBtn active={tab === 'analytics'} onClick={() => setTab('analytics')} icon={BarChart3} label="אנליטיקה" />
      </div>

      {/* Sources tab */}
      {tab === 'sources' && (
        <div className="space-y-3">
          {canEdit && (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full bg-purple-50 hover:bg-purple-100 border-2 border-dashed border-purple-300 rounded-xl p-4 text-purple-700 font-medium flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              הוסף מקור מידע חדש
            </button>
          )}

          {showAdd && <AddSourceForm onAdd={async (p: any) => { const ok = await addSource(p); if (ok) setShowAdd(false); }} onCancel={() => setShowAdd(false)} busy={busy} />}

          {sources.length === 0 && !showAdd && (
            <div className="text-center py-12 text-gray-500">
              <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="font-medium">עדיין אין מקורות מידע</p>
              <p className="text-xs">הוסף שאלות נפוצות, הסברים, או מסמכים</p>
            </div>
          )}

          {sources.map(s => (
            editingSource?.id === s.id ? (
              <EditSourceForm key={s.id} source={s} onSave={async (u: any) => { const ok = await updateSource(s.id, u); if (ok) setEditingSource(null); }} onCancel={() => setEditingSource(null)} busy={busy} />
            ) : (
              <SourceCard key={s.id} source={s} canEdit={canEdit} onEdit={() => setEditingSource(s)} onDelete={() => deleteSource(s.id)} onToggle={() => updateSource(s.id, { is_active: !s.is_active })} />
            )
          ))}
        </div>
      )}

      {/* Config tab */}
      {tab === 'config' && (
        <ConfigTab bot={bot} instances={instances} canEdit={canEdit} onSave={updateBot} busy={busy} />
      )}

      {/* Analytics tab */}
      {tab === 'analytics' && (
        <AnalyticsTab stats={stats} workspace={workspace} />
      )}
    </div>
  );
}

function StatCard({ label, value, max, icon: Icon }: any) {
  const pct = max ? Math.min(100, (Number(value) / Number(max)) * 100) : 0;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="text-xs text-gray-500 flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      <div className="text-xl font-bold">
        {value}
        {max && max < 99999 && <span className="text-xs text-gray-400 mr-1">/ {max}</span>}
      </div>
      {max && max < 99999 && (
        <div className="h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
          <div className={`h-full ${pct > 80 ? 'bg-orange-500' : 'bg-purple-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label, count }: any) {
  return (
    <button onClick={onClick} className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${active ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
      <Icon className="w-4 h-4" />
      {label}
      {count !== undefined && <span className="bg-gray-100 px-1.5 rounded text-xs">{count}</span>}
    </button>
  );
}

function SourceCard({ source, canEdit, onEdit, onDelete, onToggle }: any) {
  const typeMeta = SOURCE_TYPES.find(t => t.key === source.source_type) || SOURCE_TYPES[0];
  const Icon = typeMeta.icon;
  return (
    <div className={`bg-white rounded-xl border ${source.is_active ? 'border-gray-200' : 'border-gray-200 opacity-60'} p-4`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg ${typeMeta.color} grid place-items-center flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-semibold">{source.title}</span>
            <span className="text-xs text-gray-400">{typeMeta.label}</span>
            {!source.is_active && <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">כבוי</span>}
            {source.times_referenced > 0 && (
              <span className="text-xs text-purple-600">· שימשה {source.times_referenced} פעמים</span>
            )}
          </div>
          {source.source_type === 'faq' ? (
            <div className="mt-1.5 text-sm">
              <div className="text-gray-600 italic">❓ {source.question}</div>
              <div className="text-gray-800 mt-0.5">💬 {source.answer}</div>
            </div>
          ) : source.source_type === 'website' ? (
            <a href={source.url} target="_blank" className="text-sm text-purple-600 hover:underline">{source.url}</a>
          ) : (
            <div className="mt-1.5 text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{source.content}</div>
          )}
          {source.tags && source.tags.length > 0 && (
            <div className="mt-2 flex gap-1 flex-wrap">
              {source.tags.map((t: string) => (
                <span key={t} className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded">#{t}</span>
              ))}
            </div>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <button onClick={onToggle} title={source.is_active ? 'כבה' : 'הפעל'} className="p-1.5 hover:bg-gray-100 rounded">
              <ToggleRight className={`w-4 h-4 ${source.is_active ? 'text-emerald-600' : 'text-gray-400'}`} />
            </button>
            <button onClick={onEdit} title="ערוך" className="p-1.5 hover:bg-gray-100 rounded">
              <Edit2 className="w-4 h-4 text-gray-500" />
            </button>
            <button onClick={onDelete} title="מחק" className="p-1.5 hover:bg-red-50 rounded">
              <Trash2 className="w-4 h-4 text-red-500" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddSourceForm({ onAdd, onCancel, busy }: any) {
  const [type, setType] = useState('faq');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');

  async function submit() {
    const payload: any = { source_type: type, title, tags: tags.split(',').map(t => t.trim()).filter(Boolean) };
    if (type === 'faq') { payload.question = question; payload.answer = answer; }
    else if (type === 'text') { payload.content = content; }
    else if (type === 'website') { payload.url = url; payload.content = content; }
    onAdd(payload);
  }

  const valid = title && (
    (type === 'faq' && question && answer) ||
    (type === 'text' && content) ||
    (type === 'website' && url)
  );

  return (
    <div className="bg-purple-50 rounded-xl border-2 border-purple-200 p-4">
      <h3 className="font-bold mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4" /> מקור מידע חדש
      </h3>
      <div className="flex gap-2 mb-3">
        {SOURCE_TYPES.map(t => (
          <button key={t.key} onClick={() => setType(t.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium border-2 ${type === t.key ? 'border-purple-500 bg-white' : 'border-transparent bg-white/50'}`}
          ><t.icon className="w-4 h-4 inline ml-1" />{t.label}</button>
        ))}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="כותרת (לתצוגה פנימית)" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2" />
      {type === 'faq' && (
        <>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="השאלה (איך הלקוח יכול לשאול?)" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2" />
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} placeholder="התשובה" rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2" />
        </>
      )}
      {type === 'text' && (
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="כל מידע שיעזור לבוט לענות..." rows={5} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2" />
      )}
      {type === 'website' && (
        <>
          <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2" dir="ltr" />
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="(אופציונלי) תיאור התוכן באתר" rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-2" />
        </>
      )}
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="תגיות (מופרדות בפסיקים)" className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm mb-3" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={!valid || busy} className="flex-1 bg-purple-600 text-white font-bold py-2 rounded-lg disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'הוסף'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-white rounded-lg">ביטול</button>
      </div>
    </div>
  );
}

function EditSourceForm({ source, onSave, onCancel, busy }: any) {
  const [title, setTitle] = useState(source.title);
  const [content, setContent] = useState(source.content || '');
  const [question, setQuestion] = useState(source.question || '');
  const [answer, setAnswer] = useState(source.answer || '');
  const [url, setUrl] = useState(source.url || '');
  const [tags, setTags] = useState((source.tags || []).join(', '));

  async function submit() {
    const updates: any = { title, tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean) };
    if (source.source_type === 'faq') { updates.question = question; updates.answer = answer; }
    else if (source.source_type === 'text') { updates.content = content; }
    else if (source.source_type === 'website') { updates.url = url; updates.content = content; }
    onSave(updates);
  }

  return (
    <div className="bg-amber-50 rounded-xl border-2 border-amber-200 p-4">
      <h3 className="font-bold mb-3">עריכת מקור</h3>
      <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
      {source.source_type === 'faq' && (
        <>
          <input value={question} onChange={e => setQuestion(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
          <textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
        </>
      )}
      {source.source_type === 'text' && (
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={5} className="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
      )}
      {source.source_type === 'website' && (
        <>
          <input value={url} onChange={e => setUrl(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm mb-2" dir="ltr" />
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm mb-2" />
        </>
      )}
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="תגיות" className="w-full px-3 py-2 rounded-lg border text-sm mb-3" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={busy} className="flex-1 bg-amber-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-1">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> שמור</>}
        </button>
        <button onClick={onCancel} className="px-4 py-2 bg-white rounded-lg">ביטול</button>
      </div>
    </div>
  );
}

function ConfigTab({ bot, instances, canEdit, onSave, busy }: any) {
  const [name, setName] = useState(bot.bot_name);
  const [persona, setPersona] = useState(bot.bot_persona || '');
  const [greeting, setGreeting] = useState(bot.greeting_message || '');
  const [fallback, setFallback] = useState(bot.fallback_message || '');
  const [routing, setRouting] = useState(bot.routing_mode);
  const [dedicatedId, setDedicatedId] = useState(bot.dedicated_instance_id || '');

  async function save() {
    await onSave({
      bot_name: name,
      bot_persona: persona,
      greeting_message: greeting,
      fallback_message: fallback,
      routing_mode: routing,
      dedicated_instance_id: routing === 'dedicated_instance' ? dedicatedId : null,
    });
  }

  return (
    <div className="space-y-5">
      <Section title="זהות הבוט" icon={MessageCircle}>
        <Field label="שם הבוט" hint="כפי שיופיע ללקוחות">
          <input value={name} onChange={e => setName(e.target.value)} disabled={!canEdit} className="input-field" />
        </Field>
        <Field label="הוראות לבוט (Persona)" hint="הסבר לבוט איך הוא צריך להתנהג">
          <textarea value={persona} onChange={e => setPersona(e.target.value)} disabled={!canEdit} rows={3} className="input-field" />
        </Field>
        <Field label="הודעת פתיחה" hint="מה הבוט אומר בהודעה הראשונה">
          <input value={greeting} onChange={e => setGreeting(e.target.value)} disabled={!canEdit} className="input-field" />
        </Field>
        <Field label="הודעת fallback" hint="מה הבוט אומר כשאין לו תשובה">
          <input value={fallback} onChange={e => setFallback(e.target.value)} disabled={!canEdit} className="input-field" />
        </Field>
      </Section>

      <Section title="ניתוב הודעות" icon={Settings}>
        <div className="space-y-2">
          <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer ${routing === 'main_instance' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
            <input type="radio" checked={routing === 'main_instance'} onChange={() => setRouting('main_instance')} disabled={!canEdit} className="mt-1" />
            <div className="flex-1">
              <div className="font-semibold">אותו מספר WhatsApp</div>
              <div className="text-xs text-gray-600 mt-0.5">לקוחות חיצוניים שכותבים למספר הראשי שלך יקבלו תשובה מהבוט. משתמשי ה-CRM שלך יישארו עם הבוט הרגיל.</div>
            </div>
          </label>
          <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer ${routing === 'dedicated_instance' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white'}`}>
            <input type="radio" checked={routing === 'dedicated_instance'} onChange={() => setRouting('dedicated_instance')} disabled={!canEdit} className="mt-1" />
            <div className="flex-1">
              <div className="font-semibold">מספר WhatsApp ייעודי</div>
              <div className="text-xs text-gray-600 mt-0.5">חיבור instance נפרד שכל הודעה אליו הולכת לבוט המידע. למשל מספר תמיכה ייעודי.</div>
              {routing === 'dedicated_instance' && (
                <select value={dedicatedId} onChange={e => setDedicatedId(e.target.value)} disabled={!canEdit} className="mt-2 input-field">
                  <option value="">בחר instance...</option>
                  {instances.map((i: any) => (
                    <option key={i.id} value={i.id}>{i.provider_instance_id}</option>
                  ))}
                </select>
              )}
            </div>
          </label>
        </div>
      </Section>

      {canEdit && (
        <button onClick={save} disabled={busy} className="w-full bg-purple-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-purple-700 disabled:opacity-50">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" /> שמור הגדרות</>}
        </button>
      )}
    </div>
  );
}

function AnalyticsTab({ stats, workspace }: any) {
  if (!stats) return <div className="text-center py-8 text-gray-500">אין מספיק נתונים להציג עדיין</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <BigStat label="הודעות נכנסו" value={stats.messages_received_total || 0} />
        <BigStat label="ענו בהצלחה" value={stats.messages_answered_total || 0} />
        <BigStat label="שיחות סה״כ" value={stats.conversations_total || 0} />
      </div>
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm">
        💡 <b>טיפ:</b> ככל שתוסיף יותר מקורות מידע, הבוט יוכל לענות על יותר שאלות בלי לשלוח את הלקוח לנציג. כדאי להסתכל בשיחות שכשלו ולהוסיף מקור מתאים.
      </div>
    </div>
  );
}

function BigStat({ label, value }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
      <div className="text-2xl font-bold text-purple-600">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
        <Icon className="w-4 h-4 text-purple-600" />
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
