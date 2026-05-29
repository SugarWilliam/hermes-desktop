import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage } from "../types";

const STALL_WARN_MS = 90_000;

interface UseStreamStallArgs {
  isLoading: boolean;
  messages: ChatMessage[];
  toolProgress: string | null;
  toolProgressLog: string[];
}

export interface StreamStallState {
  elapsedSec: number;
  stalled: boolean;
  stallSec: number;
}

/**
 * Detects when an in-flight agent stream has produced no UI-visible
 * activity for a while (gateway tool loop, large attachment ingest, etc.).
 */
export function useStreamStall({
  isLoading,
  messages,
  toolProgress,
  toolProgressLog,
}: UseStreamStallArgs): StreamStallState {
  const startedAtRef = useRef(0);
  const lastActivityRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isLoading) {
      startedAtRef.current = 0;
      return;
    }
    const ts = Date.now();
    if (!startedAtRef.current) {
      startedAtRef.current = ts;
      lastActivityRef.current = ts;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!isLoading) return;
    lastActivityRef.current = Date.now();
  }, [isLoading, messages, toolProgress, toolProgressLog]);

  return useMemo(() => {
    if (!isLoading || !startedAtRef.current) {
      return { elapsedSec: 0, stalled: false, stallSec: 0 };
    }
    const elapsedSec = Math.max(0, Math.floor((now - startedAtRef.current) / 1000));
    const idleMs = now - lastActivityRef.current;
    const stalled = idleMs >= STALL_WARN_MS;
    const stallSec = stalled ? Math.floor(idleMs / 1000) : 0;
    return { elapsedSec, stalled, stallSec };
  }, [isLoading, now]);
}
