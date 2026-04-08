import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import type { Tool, ToolContext, ToolResult } from '../schema'

const execAsync = promisify(exec)

/**
 * Resolve command for Windows compatibility
 * On Windows, non-.exe commands like npm, pnpm need .cmd extension
 */
function resolveCommand(command: string): string {
  if (process.platform !== 'win32') {
    return command
  }
  const basename = path.basename(command).toLowerCase()
  const ext = path.extname(basename)
  if (ext) {
    return command
  }
  const cmdCommands = ['npm', 'pnpm', 'yarn', 'npx']
  if (cmdCommands.includes(basename)) {
    return `${command}.cmd`
  }
  return command
}

/**
 * exec tool - execute shell commands
 */
export const execTool: Tool = {
  name: 'exec',
  description:
    'Execute a shell command. Use this for running git, npm, python, node, or other CLI tools. Supports background execution with background=true.',
  supportsBackground: true,
  schema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute',
      },
      workdir: {
        type: 'string',
        description: 'Working directory (defaults to workspace root)',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in seconds (default: 30)',
        default: 30,
      },
      background: {
        type: 'boolean',
        description: 'Run in background immediately',
        default: false,
      },
    },
    required: ['command'],
  },

  async execute(args, context): Promise<ToolResult> {
    const command = args.command as string
    const timeoutSec = (args.timeout as number) ?? 30
    const workdir = (args.workdir as string) ?? context.workspaceDir
    const background = (args.background as boolean) ?? false

    // Security check: command whitelist
    const execConfig = context.config?.exec
    if (execConfig?.allowedCommands?.length) {
      const cmdName = command.trim().split(/\s+/)[0]
      if (!execConfig.allowedCommands.includes(cmdName)) {
        return {
          success: false,
          error: `Command not allowed: ${cmdName}`,
          errorType: 'permission',
        }
      }
    }

    // Security check: command blacklist
    if (execConfig?.deniedCommands?.length) {
      const cmdName = command.trim().split(/\s+/)[0]
      if (execConfig.deniedCommands.some((d) => command.includes(d))) {
        return {
          success: false,
          error: `Command contains disallowed pattern`,
          errorType: 'permission',
        }
      }
    }

    // Background execution
    if (background && context.jobStore && context.notifier) {
      return executeBackground(command, workdir, timeoutSec, context)
    }

    // Synchronous execution
    try {
      const resolvedCmd = resolveCommand(command)
      const { stdout, stderr } = await execAsync(resolvedCmd, {
        cwd: workdir,
        timeout: timeoutSec * 1000,
        maxBuffer: 10 * 1024 * 1024,
      })

      return {
        success: true,
        output: stdout + (stderr ? `\nStderr: ${stderr}` : ''),
      }
    } catch (err: unknown) {
      const error = err as { message?: string; stdout?: string; stderr?: string; code?: number }
      return {
        success: false,
        error: error.message ?? String(err),
        output: error.stdout ?? '',
        errorType: 'execution',
      }
    }
  },
}

async function executeBackground(
  command: string,
  workdir: string,
  timeoutSec: number,
  context: ToolContext,
): Promise<ToolResult> {
  if (!context.jobStore || !context.notifier) {
    return { success: false, error: 'Background execution not available', errorType: 'execution' }
  }

  const job = context.jobStore.create({
    toolName: 'exec',
    args: { command, workdir, timeout: timeoutSec },
    sessionKey: context.sessionKey,
    command,
  })

  // Execute asynchronously
  setImmediate(async () => {
    context.jobStore!.update(job.id, { status: 'running', startedAt: Date.now() })

    const resolvedCmd = resolveCommand(command)

    // Use spawn for background to capture output
    const child = spawn(resolvedCmd, [], {
      cwd: workdir,
      shell: true,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    const timer = setTimeout(() => {
      child.kill('SIGKILL')
    }, timeoutSec * 1000)

    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const status = code === 0 ? 'completed' : 'failed'
      context.jobStore!.update(job.id, {
        status,
        stdout,
        stderr,
        exitCode: code,
        completedAt: Date.now(),
        error: signal ? `Killed by ${signal}` : undefined,
      })

      const updatedJob = context.jobStore!.get(job.id)
      if (updatedJob) {
        context.notifier!.notify(updatedJob)
      }
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      context.jobStore!.update(job.id, {
        status: 'failed',
        stderr: err.message,
        exitCode: 1,
        completedAt: Date.now(),
      })

      const updatedJob = context.jobStore!.get(job.id)
      if (updatedJob) {
        context.notifier!.notify(updatedJob)
      }
    })
  })

  return {
    success: true,
    output: `Command started in background. Job ID: ${job.id}`,
  }
}
