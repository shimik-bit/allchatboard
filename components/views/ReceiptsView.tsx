'use client';

import { useState } from 'react';
import type { Field, RecordRow } from '@/lib/types/database';
import { format, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';
import { FileText, Image as ImageIcon, X, Calendar, Hash, Tag } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

/**
 * ReceiptsView - displays records as horizontal cards optimized for receipts/invoices.
 *
 * Layout (per row, RTL):
 *   [thumbnail 96x96] | amount + vendor + date + status badges | meta (invoice #, category)
 *
 * - Click thumbnail → full-screen lightbox preview of the image/PDF
 * - Click anywhere else on the card → opens edit modal (same behavior as GridView)
 * - Designed for expense/income invoice tables where the attachment IS the data
 */
export default function ReceiptsView({
  fields,
  records,
  onRecordClick,
}: {
  fields: Field[];
  records: RecordRow[];
  onRecordClick: (r: RecordRow) => void;
}) {
  const { t } = useT();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);

  // Identify the most important fields by their conventional slugs and types.
  // We look for: amount/currency, vendor/customer name, date, invoice number,
  // category, status. Falls back gracefully if any are missing.
  const amountField = fields.find(
    (f) =>
      f.type === 'currency' &&
      ['amount', 'amount_total', 'total'].includes(f.slug)
  ) || fields.find((f) => f.type === 'currency');

  const vendorField =
    fields.find((f) => ['vendor', 'customer_name', 'supplier_name'].includes(f.slug)) ||
    fields.find((f) => f.is_primary && f.type === 'text');

  const dateField =
    fields.find((f) =>
      ['expense_date', 'invoice_date', 'transaction_date', 'date'].includes(f.slug)
    ) || fields.find((f) => f.type === 'date');

  const invoiceNumberField = fields.find((f) =>
    ['invoice_number', 'reference_number'].includes(f.slug)
  );

  const categoryField = fields.find((f) =>
    ['category', 'document_type'].includes(f.slug)
  );

  const statusField = fields.find((f) => f.type === 'status');

  if (records.length === 0) {
    return (
      <div className="text-center py-20 text-gray-400">
        <div className="text-5xl mb-3">🧾</div>
        <p>{t('records.no_records')}</p>
        <p className="text-sm mt-2">
          שלח חשבונית בוואטסאפ והיא תופיע כאן אוטומטית
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {records.map((r) => (
          <ReceiptCard
            key={r.id}
            record={r}
            amountField={amountField}
            vendorField={vendorField}
            dateField={dateField}
            invoiceNumberField={invoiceNumberField}
            categoryField={categoryField}
            statusField={statusField}
            onClick={() => onRecordClick(r)}
            onPreview={(url, type) => {
              setPreviewUrl(url);
              setPreviewType(type);
            }}
          />
        ))}
      </div>

      {/* Lightbox for full-screen image/PDF preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300 p-2 rounded-full bg-white/10 hover:bg-white/20 transition"
            onClick={() => setPreviewUrl(null)}
            aria-label="סגור"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-5xl max-h-full w-full" onClick={(e) => e.stopPropagation()}>
            {previewType?.includes('pdf') ? (
              <iframe
                src={previewUrl}
                className="w-full h-[85vh] rounded-lg bg-white"
                title="תצוגת מסמך"
              />
            ) : (
              <img
                src={previewUrl}
                alt="חשבונית"
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ReceiptCard({
  record,
  amountField,
  vendorField,
  dateField,
  invoiceNumberField,
  categoryField,
  statusField,
  onClick,
  onPreview,
}: {
  record: RecordRow;
  amountField?: Field;
  vendorField?: Field;
  dateField?: Field;
  invoiceNumberField?: Field;
  categoryField?: Field;
  statusField?: Field;
  onClick: () => void;
  onPreview: (url: string, type: string | null) => void;
}) {
  const amount = amountField ? record.data?.[amountField.slug] : null;
  const vendor = vendorField ? record.data?.[vendorField.slug] : null;
  const date = dateField ? record.data?.[dateField.slug] : null;
  const invoiceNumber = invoiceNumberField
    ? record.data?.[invoiceNumberField.slug]
    : null;
  const categoryValue = categoryField ? record.data?.[categoryField.slug] : null;
  const statusValue = statusField ? record.data?.[statusField.slug] : null;

  const categoryOption = categoryField?.config?.options?.find(
    (o: any) => o.value === categoryValue
  );
  const statusOption = statusField?.config?.options?.find(
    (o: any) => o.value === statusValue
  );

  const isPdf = record.attachment_type?.includes('pdf');
  const isImage = record.attachment_type?.startsWith('image');

  return (
    <div
      className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-300 hover:shadow-sm transition cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start gap-4" dir="rtl">
        {/* Thumbnail */}
        <div
          className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-50 border border-gray-100 flex items-center justify-center relative"
          onClick={(e) => {
            e.stopPropagation();
            if (record.attachment_url) {
              onPreview(record.attachment_url, record.attachment_type);
            }
          }}
        >
          {record.attachment_url && isImage ? (
            <>
              <img
                src={record.attachment_url}
                alt="חשבונית"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition" />
            </>
          ) : record.attachment_url && isPdf ? (
            <div className="text-gray-400 flex flex-col items-center">
              <FileText className="w-8 h-8" />
              <span className="text-xs mt-1">PDF</span>
            </div>
          ) : (
            <div className="text-gray-300">
              <ImageIcon className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Top row: amount + status */}
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <div className="flex items-baseline gap-2">
              {amount != null && amount !== '' && (
                <span className="text-2xl font-bold text-gray-900">
                  {formatCurrency(amount)}
                </span>
              )}
              {amount != null && amount !== '' && (
                <span className="text-gray-400 text-sm">₪</span>
              )}
            </div>
            {statusOption && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                style={{
                  backgroundColor: (statusOption.color || '#94A3B8') + '20',
                  color: statusOption.color || '#475569',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: statusOption.color || '#94A3B8' }}
                />
                {statusOption.label}
              </span>
            )}
          </div>

          {/* Vendor name */}
          {vendor && (
            <div className="text-base text-gray-800 font-medium truncate mb-1">
              {vendor}
            </div>
          )}

          {/* Meta row: date, invoice number, category */}
          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
            {date && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(date)}
              </span>
            )}
            {invoiceNumber && (
              <span className="inline-flex items-center gap-1">
                <Hash className="w-3 h-3" />
                {invoiceNumber}
              </span>
            )}
            {categoryOption && (
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: categoryOption.color || '#94A3B8' }}
                />
                {categoryOption.label}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: any): string {
  const n = Number(value);
  if (isNaN(n)) return String(value);
  return n.toLocaleString('he-IL', {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: any): string {
  try {
    const d = typeof value === 'string' ? parseISO(value) : new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return format(d, 'dd/MM/yyyy', { locale: he });
  } catch {
    return String(value);
  }
}
