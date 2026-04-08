import type { BackgroundJob, JobNotifier } from './schema'

/**
 * SSE notifier for job completion events
 */
export class SSENotifier implements JobNotifier {
  private sessions = new Map<string, Set<ReadableStreamDefaultController>>()

  /**
   * Add an SSE stream for a session
   */
  addSessionStream(sessionKey: string, controller: ReadableStreamDefaultController): void {
    if (!this.sessions.has(sessionKey)) {
      this.sessions.set(sessionKey, new Set())
    }
    this.sessions.get(sessionKey)!.add(controller)
  }

  /**
   * Remove an SSE stream for a session
   */
  removeSessionStream(sessionKey: string, controller: ReadableStreamDefaultController): void {
    const streams = this.sessions.get(sessionKey)
    if (streams) {
      streams.delete(controller)
      if (streams.size === 0) this.sessions.delete(sessionKey)
    }
  }

  /**
   * Notify all streams about job completion
   */
  async notify(job: BackgroundJob): Promise<void> {
    const streams = this.sessions.get(job.sessionKey)
    if (!streams || streams.size === 0) return

    const message = this.formatJobMessage(job)
    const data = `data: ${JSON.stringify({ type: 'job_complete', job })}\n\n`

    const dead = new Set<ReadableStreamDefaultController>()
    for (const controller of Array.from(streams)) {
      try {
        controller.enqueue(new TextEncoder().encode(data))
      } catch {
        dead.add(controller)
      }
    }

    for (const controller of Array.from(dead)) {
      this.removeSessionStream(job.sessionKey, controller)
    }
  }

  private formatJobMessage(job: BackgroundJob): string {
    const duration = job.completedAt && job.startedAt ? ` (${job.completedAt - job.startedAt}ms)` : ''

    if (job.status === 'completed') {
      const output = job.stdout.length > 200 ? job.stdout.slice(0, 200) + '...' : job.stdout
      return `[${job.id}] ${job.command ?? job.toolName} completed${duration}\n${output}`
    }

    if (job.status === 'failed') {
      return `[${job.id}] ${job.command ?? job.toolName} failed${duration}\n${job.error ?? job.stderr}`
    }

    return `[${job.id}] ${job.command ?? job.toolName} ${job.status}`
  }
}

/**
 * Global SSE notifier instance
 */
export const sseNotifier = new SSENotifier()
