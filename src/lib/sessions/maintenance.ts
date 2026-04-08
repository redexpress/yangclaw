import { sessionStore } from './store'

let pruneTimer: ReturnType<typeof setInterval> | null = null

/**
 * Start periodic cleanup task
 * @param intervalMs Cleanup interval (default 1 hour)
 */
export function startMaintenance(intervalMs = 60 * 60 * 1000): void {
  if (pruneTimer) return // Prevent duplicate start

  pruneTimer = setInterval(() => {
    const pruned = sessionStore.prune()
    if (pruned > 0) {
      console.log(`[Session] Pruned ${pruned} sessions`)
    }
  }, intervalMs)
}

/**
 * Stop periodic cleanup task
 */
export function stopMaintenance(): void {
  if (pruneTimer) {
    clearInterval(pruneTimer)
    pruneTimer = null
  }
}
