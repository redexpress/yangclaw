import { toolRegistry } from '../registry'
import { readTool } from './read'
import { writeTool } from './write'
import { execTool } from './exec'
import { rememberTool } from './remember'

/**
 * Register all builtin tools
 */
export function registerBuiltinTools(): void {
  toolRegistry.registerAll([readTool, writeTool, execTool, rememberTool])
}

export { readTool, writeTool, execTool, rememberTool }
