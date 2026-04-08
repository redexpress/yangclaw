import { readFileSync, existsSync } from 'fs'
import { resolve, isAbsolute } from 'path'
import type { Tool, ToolResult } from '../schema'

/**
 * Read tool - read file contents
 */
export const readTool: Tool = {
  name: 'read',
  description:
    'Read the contents of a file. Use this to read source code, configuration files, or any text-based files.',
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read (absolute or relative to workspace)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of characters to read (for large files)',
        default: 50000,
      },
    },
    required: ['path'],
  },

  async execute(args, context): Promise<ToolResult> {
    let filePath = args.path as string
    const limit = (args.limit as number) ?? 50000

    // Resolve to absolute path
    if (!isAbsolute(filePath)) {
      filePath = resolve(context.workspaceDir, filePath)
    }

    // Security check: workspace only
    if (context.config?.fs?.workspaceOnly) {
      if (!filePath.startsWith(context.workspaceDir)) {
        return {
          success: false,
          error: 'Path outside workspace is not allowed',
          errorType: 'permission',
        }
      }
    }

    // Security check: memory directory only for memory reads
    const memoryDir = resolve(context.workspaceDir, 'memory')
    if (!filePath.startsWith(memoryDir)) {
      return {
        success: false,
        error: 'Only memory/ directory files can be read via memory read',
        errorType: 'permission',
      }
    }

    // Check file exists
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`,
        errorType: 'validation',
      }
    }

    try {
      const content = readFileSync(filePath, 'utf-8')

      if (content.length > limit) {
        return {
          success: true,
          output:
            content.slice(0, limit) + `\n\n... [truncated, ${content.length - limit} characters omitted]`,
        }
      }

      return { success: true, output: content }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        errorType: 'execution',
      }
    }
  },
}
