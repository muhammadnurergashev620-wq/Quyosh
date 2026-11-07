import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import { ApiError } from '@/types/api';
import { calcService } from './calc.service';
import type { EstimateInput, EstimateResult } from './types';

/** U8.9: debounce 800 ms, minimal oraliq — guest 6 s / kirgan 2 s, bitta faol so‘rov, 429 da kutish. */
const DEBOUNCE_MS = 800;
const MIN_INTERVAL_GUEST_MS = 6000;
const MIN_INTERVAL_USER_MS = 2000;
const RATE_LIMIT_WAIT_MS = 10_000;

export interface EstimateState {
  result: EstimateResult | null;
  /** Yangilanmoqda: avvalgi natija 60 % shaffoflik bilan ko‘rinib turadi. */
  pending: boolean;
  error: unknown;
  /** 429: shu vaqtgacha kutish (ms epoch). */
  retryAt: number | null;
  requests: number;
}

/** Faqat yakunlangan kirish (committed) uzatiladi; null — hali yetarli emas. */
export function useEstimate(input: EstimateInput | null): EstimateState {
  const hasSession = useAuthStore((s) => s.hasSession);
  const [state, setState] = useState<EstimateState>({ result: null, pending: false, error: null, retryAt: null, requests: 0 });
  const lastSent = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<number | null>(null);
  const key = input ? JSON.stringify(input) : null;

  useEffect(() => {
    if (!key) return;
    const minInterval = hasSession ? MIN_INTERVAL_USER_MS : MIN_INTERVAL_GUEST_MS;
    const run = () => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      lastSent.current = Date.now();
      setState((s) => ({ ...s, pending: true, error: null }));
      calcService
        .estimate(JSON.parse(key) as EstimateInput, abort.signal)
        .then((result) => setState((s) => ({ result, pending: false, error: null, retryAt: null, requests: s.requests + 1 })))
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          if (error instanceof ApiError && error.statusCode === 429) {
            const retryAt = Date.now() + RATE_LIMIT_WAIT_MS;
            setState((s) => ({ ...s, pending: false, retryAt }));
            timer.current = window.setTimeout(run, RATE_LIMIT_WAIT_MS);
            return;
          }
          setState((s) => ({ ...s, pending: false, error }));
        });
    };
    const wait = Math.max(DEBOUNCE_MS, lastSent.current + minInterval - Date.now());
    setState((s) => ({ ...s, pending: true }));
    timer.current = window.setTimeout(run, wait);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [key, hasSession]);

  useEffect(() => () => controller.current?.abort(), []);
  return state;
}
