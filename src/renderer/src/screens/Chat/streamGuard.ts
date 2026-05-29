/**
 * Prevents IPC stream events from one conversation mutating another session's UI.
 *
 * `invalidate()` on session switch; `claim()` when a send starts. Handlers ignore
 * events unless `isActive()` and (for terminal events) `acceptsSession(id)`.
 */
export interface StreamGuard {
  invalidate(): void;
  claim(): void;
  isActive(): boolean;
  acceptsSession(eventSessionId: string | undefined): boolean;
}

export function createStreamGuard(
  getBoundSessionId: () => string | null,
): StreamGuard {
  let generation = 0;
  let claimedGeneration = -1;

  return {
    invalidate(): void {
      generation += 1;
    },
    claim(): void {
      claimedGeneration = generation;
    },
    isActive(): boolean {
      return claimedGeneration === generation;
    },
    acceptsSession(eventSessionId: string | undefined): boolean {
      if (!this.isActive()) return false;
      const bound = getBoundSessionId();
      if (!eventSessionId) return true;
      if (!bound) return true;
      return eventSessionId === bound;
    },
  };
}
