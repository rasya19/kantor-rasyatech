export const JOBS_ACTIVE_POLL_MS = 4_000;
export const JOBS_IDLE_POLL_MS = 45_000;
export const VIDEOS_ACTIVE_POLL_MS = 6_000;
export const VIDEOS_IDLE_POLL_MS = 60_000;

export function hasActiveStatus(items: ReadonlyArray<{ status: string }> | null | undefined): boolean {
  return Boolean(items?.some((item) => item.status === 'QUEUED' || item.status === 'RUNNING'));
}

export function nextPollDelayMs(hasActive: boolean, activeMs: number, idleMs: number): number {
  return hasActive ? activeMs : idleMs;
}
