'use client';

import { useRouter } from 'next/navigation';
import { Receipt, Download, ExternalLink, FileText, Calendar } from 'lucide-react';

type Invoice = {
  id: string;
  cardcom_invoice_number: string | null;
  cardcom_invoice_type: string | null;
  cardcom_invoice_url: string | null;
  customer_name: string | null;
  customer_email: string | null;
  amount_total: string | number;
  currency: string;
  description: string | null;
  issued_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  tax_invoice_receipt: 'חשבונית מס/קבלה',
  tax_invoice: 'חשבונית מס',
  receipt: 'קבלה',
};

export default function InvoicesClient({
  workspace,
  allWorkspaces,
  invoices,
}: {
  workspace: { id: string; name: string; icon: string | null };
  allWorkspaces: Array<{ id: string; name: string; icon: string | null }>;
  invoices: Invoice[];
}) {
  const router = useRouter();
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.amount_total || 0), 0);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-3xl mb-1 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-purple-600" />
            חשבוניות מס/קבלות
          </h1>
          <p className="text-gray-500">היסטוריית מסמכים שהונפקו עבור הסביבה</p>
        </div>
        {allWorkspaces.length > 1 && (
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
            <span className="text-xs text-gray-500 font-medium">סביבה:</span>
            <select
              value={workspace.id}
              onChange={(e) => router.push(`/dashboard/invoices?ws=${e.target.value}`)}
              className="text-sm font-medium bg-transparent border-0 focus:outline-none cursor-pointer"
            >
              {allWorkspaces.map(ws => (
                <option key={ws.id} value={ws.id}>{ws.icon || '📊'} {ws.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">מסמכים סה"כ</div>
          <div className="text-2xl font-bold text-purple-600">{invoices.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-xs text-gray-500 mb-1">סה"כ שולם</div>
          <div className="text-2xl font-bold text-emerald-600">₪{totalPaid.toFixed(2)}</div>
        </div>
      </div>

      {/* List */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <Receipt className="w-16 h-16 mx-auto mb-3 text-gray-300" />
          <h3 className="font-bold text-lg mb-1">עדיין אין חשבוניות</h3>
          <p className="text-gray-500 text-sm">חשבוניות יופיעו כאן באופן אוטומטי לאחר תשלום מוצלח</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {invoices.map(inv => (
              <li key={inv.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 grid place-items-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-bold">
                        {TYPE_LABELS[inv.cardcom_invoice_type || ''] || 'מסמך'} #{inv.cardcom_invoice_number || '?'}
                      </span>
                      <span className="text-emerald-600 font-bold">₪{Number(inv.amount_total).toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-gray-600 mt-0.5">{inv.description || 'TaskFlow AI Pro'}</div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(inv.issued_at).toLocaleDateString('he-IL', { dateStyle: 'medium' })}
                      </span>
                      {inv.customer_name && <span>· {inv.customer_name}</span>}
                      {inv.customer_email && <span>· {inv.customer_email}</span>}
                    </div>
                  </div>
                  {inv.cardcom_invoice_url && (
                    <a
                      href={inv.cardcom_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-sm font-medium flex items-center gap-1.5 flex-shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span className="hidden sm:inline">הורד PDF</span>
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[10px] text-gray-400 mt-4 text-center">
        כל המסמכים מונפקים אוטומטית ע"י Cardcom · מסמכים חוקיים בתקנות מ"ה
      </p>
    </div>
  );
}
