import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { resolve, dirname, isAbsolute } from 'path'
import type { Tool, ToolContext, ToolResult } from '../schema'

/**
 * Write tool - write content to file
 */
export const writeTool: Tool = {
  name: 'write',
  description: 'Write content to a file. Creates the file if it does not exist, or overwrites it if it does.',
  schema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write (absolute or relative to workspace)',
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
      },
    },
    required: ['path', 'content'],
  },

  async execute(args, context): Promise<ToolResult> {
    let filePath = args.path as string
    const content = args.content as string

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

    // Check dangerous paths
    const dangerousPatterns = ['/etc/', '/root/', '/.ssh/']
    if (dangerousPatterns.some((p) => filePath.startsWith(p))) {
      return {
        success: false,
        error: 'Writing to system directories is not allowed',
        errorType: 'permission',
      }
    }

    try {
      // Ensure directory exists
      const dir = dirname(filePath)
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
      }

      writeFileSync(filePath, content, 'utf-8')

      return {
        success: true,
        output: `File written successfully: ${filePath} (${content.length} characters)`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        errorType: 'execution',
      }
    }
  },
}
