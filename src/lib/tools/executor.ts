import type { Tool, ToolContext, ToolResult } from './schema'
import { validateArgs, ValidationError } from './validate'
import { isToolAllowed } from './config'

/**
 * Execute a tool with validation and error handling
 */
export async function executeTool(options: {
  tool: Tool
  args: Record<string, unknown>
  context: ToolContext
}): Promise<ToolResult> {
  const { tool, args, context } = options
  const startTime = Date.now()

  // Check if tool is allowed
  if (context.config && !isToolAllowed(context.config, tool.name)) {
    return {
      success: false,
      error: `Tool "${tool.name}" is not allowed`,
      errorType: 'permission',
      durationMs: Date.now() - startTime,
    }
  }

  // Validate arguments
  let validatedArgs: Record<string, unknown>
  try {
    validatedArgs = validateArgs(args, tool.schema)
  } catch (err) {
    if (err instanceof ValidationError) {
      return {
        success: false,
        error: err.message,
        errorType: 'validation',
        durationMs: Date.now() - startTime,
      }
    }
    throw err
  }

  // Execute tool
  try {
    const result = await tool.execute(validatedArgs, context)
    return { ...result, durationMs: Date.now() - startTime }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      errorType: 'execution',
      durationMs: Date.now() - startTime,
    }
  }
}
