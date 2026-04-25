'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Check, Search, X } from 'lucide-react';

type City = {
  name: string;
  district?: string;
  region?: string;
  code?: string;
};

/**
 * CityAutocomplete - Israeli city picker backed by data.gov.il
 *
 * Behavior:
 * - Empty input → shows popular city list immediately
 * - Typing → debounced search against /api/cities
 * - Selecting → fills the field with the city name (Hebrew)
 * - Free text allowed if user wants to type a city not in the list
 */
export default function CityAutocomplete({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  inputDir = 'rtl',
}: {
  value: string | null;
  onChange: (newVal: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  inputDir?: 'rtl' | 'ltr';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<City[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external value changes
  useEffect(() => {
    if (!open) setQuery(value || '');
  }, [value, open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/cities?q=${encodeURIComponent(query.trim())}`)
        .then((r) => r.json())
        .then((d) => {
          setResults(Array.isArray(d.cities) ? d.cities : []);
          setLoading(false);
          setHighlightedIdx(0);
        })
        .catch(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // Restore the saved value if user didn't pick anything
        setQuery(value || '');
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open, value]);

  function handleSelect(city: City) {
    onChange(city.name);
    setQuery(city.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleConfirmFreeText() {
    // Save whatever user typed as the value (allow free text)
    const v = query.trim();
    if (v !== (value || '')) onChange(v);
    setOpen(false);
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[highlightedIdx]) {
        handleSelect(results[highlightedIdx]);
      } else {
        handleConfirmFreeText();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setQuery(value || '');
    }
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          dir={inputDir}
          disabled={disabled}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKey}
          placeholder={placeholder || 'בחר עיר...'}
          className={`${className || 'input-field'} pr-9 ${query ? 'pl-9' : ''}`}
          autoComplete="off"
        />
        {query && !disabled && (
          <button
            type="button"
            onMouseDown={handleClear}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-100"
            tabIndex={-1}
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-2xl border border-gray-100 max-h-72 overflow-y-auto">
          {loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 animate-pulse" />
              מחפש...
            </div>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <button
              type="button"
              onClick={handleConfirmFreeText}
              className="w-full text-right px-4 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-100"
            >
              <div className="flex items-center justify-between">
                <span>השתמש ב-<strong>"{query}"</strong></span>
                <span className="text-[10px] text-gray-400">טקסט חופשי</span>
              </div>
            </button>
          )}

          {results.map((city, i) => {
            const selected = city.name === value;
            const highlighted = i === highlightedIdx;
            return (
              <button
                key={city.code || city.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(city)}
                onMouseEnter={() => setHighlightedIdx(i)}
                className={`w-full text-right px-4 py-2.5 text-sm flex items-center justify-between border-b border-gray-50 last:border-b-0 transition-colors ${
                  highlighted ? 'bg-brand-50' : 'hover:bg-gray-50'
                } ${selected ? 'font-medium' : ''}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="truncate">{city.name}</div>
                  {city.district && (
                    <div className="text-[11px] text-gray-400 mt-0.5">{city.district}</div>
                  )}
                </div>
                {selected && <Check className="w-4 h-4 text-brand-600 flex-shrink-0 mr-2" />}
              </button>
            );
          })}

          {!loading && results.length > 0 && (
            <div className="px-3 py-2 text-[10px] text-gray-400 bg-gray-50/50 border-t border-gray-100 text-center">
              נתונים מ-data.gov.il · ניתן גם להקליד עיר חופשית
            </div>
          )}
        </div>
      )}
    </div>
  );
}
