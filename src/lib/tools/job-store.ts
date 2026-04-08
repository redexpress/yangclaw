import type { BackgroundJob, CreateJobOptions, JobStore as IJobStore } from './schema'

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

/**
 * In-memory job store implementation
 */
export class InMemoryJobStore implements IJobStore {
  private jobs = new Map<string, BackgroundJob>()

  create(options: CreateJobOptions): BackgroundJob {
    const job: BackgroundJob = {
      id: generateJobId(),
      toolName: options.toolName,
      args: options.args,
      sessionKey: options.sessionKey,
      command: options.command,
      status: 'pending',
      stdout: '',
      stderr: '',
      exitCode: null,
      createdAt: Date.now(),
      startedAt: null,
      completedAt: null,
    }
    this.jobs.set(job.id, job)
    return job
  }

  get(id: string): BackgroundJob | undefined {
    return this.jobs.get(id)
  }

  update(id: string, updates: Partial<BackgroundJob>): boolean {
    const job = this.jobs.get(id)
    if (!job) return false
    Object.assign(job, updates)
    return true
  }

  delete(id: string): boolean {
    return this.jobs.delete(id)
  }

  listBySession(sessionKey: string): BackgroundJob[] {
    return Array.from(this.jobs.values())
      .filter((j) => j.sessionKey === sessionKey)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  listRunning(): BackgroundJob[] {
    return Array.from(this.jobs.values()).filter(
      (j) => j.status === 'running' || j.status === 'pending',
    )
  }

  size(): number {
    return this.jobs.size
  }
}

/**
 * Global job store instance
 */
export const jobStore = new InMemoryJobStore()
