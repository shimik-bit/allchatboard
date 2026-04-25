'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * useDevMode — global dev-mode state.
 *
 * Properties:
 *  - Persisted in sessionStorage (resets on browser close)
 *  - Auto-disables after 30 minutes of inactivity
 *  - Cross-tab synchronized via storage events
 *  - Activity (any click/keypress while enabled) resets the timer
 *
 * UI patterns:
 *  - Wrap destructive buttons with `<DevModeOnly>...</DevModeOnly>`
 *  - Or: `const { enabled } = useDevMode(); if (!enabled) return null;`
 */

const STORAGE_KEY = 'allchatboard:dev-mode';
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = ['click', 'keydown'];

type DevModeRecord = { enabled: boolean; expiresAt: number };

function readState(): DevModeRecord {
  if (typeof window === 'undefined') return { enabled: false, expiresAt: 0 };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, expiresAt: 0 };
    const parsed = JSON.parse(raw) as DevModeRecord;
    if (parsed.enabled && parsed.expiresAt > Date.now()) return parsed;
    return { enabled: false, expiresAt: 0 };
  } catch {
    return { enabled: false, expiresAt: 0 };
  }
}

function writeState(rec: DevModeRecord) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(rec));
    // Dispatch a fake storage event so other tabs/components in same tab pick it up
    window.dispatchEvent(new CustomEvent('devmode:change', { detail: rec }));
  } catch {}
}

export function useDevMode() {
  const [state, setState] = useState<DevModeRecord>({ enabled: false, expiresAt: 0 });

  // Initial read + setup listeners
  useEffect(() => {
    setState(readState());

    function onChange(e: any) {
      const next = e?.detail || readState();
      setState(next);
    }
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setState(readState());
    }
    window.addEventListener('devmode:change', onChange as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('devmode:change', onChange as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  // Activity tracker: while enabled, refresh expiry on user interaction
  useEffect(() => {
    if (!state.enabled) return;

    function refresh() {
      const next = { enabled: true, expiresAt: Date.now() + EXPIRY_MS };
      writeState(next);
    }

    // Throttle to once per 30s
    let lastRefresh = Date.now();
    function throttledRefresh() {
      if (Date.now() - lastRefresh < 30_000) return;
      lastRefresh = Date.now();
      refresh();
    }

    ACTIVITY_EVENTS.forEach((ev) => document.addEventListener(ev, throttledRefresh));
    return () => {
      ACTIVITY_EVENTS.forEach((ev) => document.removeEventListener(ev, throttledRefresh));
    };
  }, [state.enabled]);

  // Expiry checker — every 60s verify we haven't expired
  useEffect(() => {
    if (!state.enabled) return;
    const interval = setInterval(() => {
      if (Date.now() >= state.expiresAt) {
        const next = { enabled: false, expiresAt: 0 };
        writeState(next);
        setState(next);
      }
    }, 60_000);
    return () => clearInterval(interval);
  }, [state.enabled, state.expiresAt]);

  const enable = useCallback(() => {
    const next = { enabled: true, expiresAt: Date.now() + EXPIRY_MS };
    writeState(next);
    setState(next);
  }, []);

  const disable = useCallback(() => {
    const next = { enabled: false, expiresAt: 0 };
    writeState(next);
    setState(next);
  }, []);

  const toggle = useCallback(() => {
    if (state.enabled) {
      const next = { enabled: false, expiresAt: 0 };
      writeState(next);
      setState(next);
    } else {
      const next = { enabled: true, expiresAt: Date.now() + EXPIRY_MS };
      writeState(next);
      setState(next);
    }
  }, [state.enabled]);

  const minutesRemaining = state.enabled
    ? Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 60_000))
    : 0;

  return {
    enabled: state.enabled,
    minutesRemaining,
    enable,
    disable,
    toggle,
  };
}
