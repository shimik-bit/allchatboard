'use client';

import { useState, useMemo } from 'react';
import type { Field, RecordRow } from '@/lib/types/database';
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay,
  addMonths, subMonths,
} from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export default function CalendarView({
  records, dateField, primaryField, onRecordClick,
}: {
  records: RecordRow[];
  dateField: Field | null;
  primaryField: Field | null;
  onRecordClick: (r: RecordRow) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const recordsByDate = useMemo(() => {
    if (!dateField) return new Map();
    const map = new Map<string, RecordRow[]>();
    for (const r of records) {
      const v = r.data?.[dateField.slug];
      if (!v) continue;
      try {
        const key = format(new Date(v), 'yyyy-MM-dd');
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
      } catch {}
    }
    return map;
  }, [records, dateField]);

  if (!dateField) {
    return (
      <div className="text-center py-16 text-gray-500">
        <div className="text-4xl mb-3">📅</div>
        <p className="font-medium">אין שדה תאריך</p>
        <p className="text-sm mt-1">תצוגת לוח שנה דורשת שדה מסוג תאריך</p>
      </div>
    );
  }

  const weekDays = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-3 py-1 text-sm rounded hover:bg-gray-100"
          >
            היום
          </button>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 rounded hover:bg-gray-100"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <h2 className="font-display font-bold text-lg">
          {format(currentMonth, 'MMMM yyyy', { locale: he })}
        </h2>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-gray-200">
        {weekDays.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-gray-500 bg-gray-50">
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayRecords = recordsByDate.get(format(day, 'yyyy-MM-dd')) || [];
          const isCurrent = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] p-1.5 border-b border-l border-gray-100 ${
                isCurrent ? 'bg-white' : 'bg-gray-50/50'
              }`}
            >
              <div
                className={`text-xs mb-1 inline-block px-1.5 rounded-full ${
                  isToday
                    ? 'bg-brand-600 text-white font-bold'
                    : isCurrent
                    ? 'text-gray-700'
                    : 'text-gray-400'
                }`}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayRecords.slice(0, 3).map((r: RecordRow) => {
                  const title = primaryField
                    ? r.data?.[primaryField.slug]
                    : Object.values(r.data || {})[0];
                  return (
                    <button
                      key={r.id}
                      onClick={() => onRecordClick(r)}
                      className="block w-full text-right px-1.5 py-0.5 rounded text-[11px] bg-brand-50 text-brand-700 hover:bg-brand-100 truncate transition-colors"
                    >
                      {String(title || 'ללא כותרת')}
                    </button>
                  );
                })}
                {dayRecords.length > 3 && (
                  <div className="text-[10px] text-gray-500 px-1.5">
                    +{dayRecords.length - 3} עוד
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
