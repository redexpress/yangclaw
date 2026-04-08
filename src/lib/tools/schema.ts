/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean
  output?: string
  error?: string
  errorType?: 'validation' | 'permission' | 'timeout' | 'execution' | 'unknown'
  durationMs?: number
}

/**
 * Tool parameter definition
 */
export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object'
  description?: string
  enum?: string[]
  default?: unknown
}

/**
 * Tool schema definition
 */
export interface ToolSchema {
  type: 'object'
  properties: Record<string, ToolParameter>
  required?: string[]
}

/**
 * Tool execution context
 */
export interface ToolContext {
  sessionKey: string
  workspaceDir: string
  cwd?: string
  senderId: string
  channel: string
  memory?: import('../memory/store').MemoryStore
  sessions?: import('../sessions/store').SessionStore
  jobStore?: JobStore
  notifier?: JobNotifier
  config?: import('./config').ToolsConfig
}

/**
 * Tool definition
 */
export interface Tool {
  name: string
  description: string
  schema: ToolSchema
  hidden?: boolean
  supportsBackground?: boolean
  execute(args: Record<string, unknown>, context: ToolContext): Promise<ToolResult>
}

/**
 * Job status
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * Background job
 */
export interface BackgroundJob {
  id: string
  toolName: string
  args: Record<string, unknown>
  sessionKey: string
  status: JobStatus
  command?: string
  stdout: string
  stderr: string
  exitCode: number | null
  createdAt: number
  startedAt: number | null
  completedAt: number | null
  error?: string
}

/**
 * Job store interface
 */
export interface JobStore {
  create(options: CreateJobOptions): BackgroundJob
  get(id: string): BackgroundJob | undefined
  update(id: string, updates: Partial<BackgroundJob>): boolean
  delete(id: string): boolean
  listBySession(sessionKey: string): BackgroundJob[]
  listRunning(): BackgroundJob[]
  size(): number
}

/**
 * Options for creating a job
 */
export interface CreateJobOptions {
  toolName: string
  args: Record<string, unknown>
  sessionKey: string
  command?: string
}

/**
 * Job notifier interface
 */
export interface JobNotifier {
  notify(job: BackgroundJob): Promise<void>
}
