import type { Tool } from './schema'

/**
 * Tool registry for managing available tools
 */
export class ToolRegistry {
  private tools = new Map<string, Tool>()
  private hiddenTools = new Set<string>()

  /**
   * Register a tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
    if (tool.hidden) {
      this.hiddenTools.add(tool.name)
    }
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Get all non-hidden tools
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values()).filter((t) => !this.hiddenTools.has(t.name))
  }

  /**
   * Get tool list for LLM (name, description, schema)
   */
  getToolList(): Array<{ name: string; description: string; schema: Tool['schema'] }> {
    return this.getAll().map((tool) => ({
      name: tool.name,
      description: tool.description,
      schema: tool.schema,
    }))
  }

  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Check if tool supports background execution
   */
  supportsBackground(name: string): boolean {
    return this.tools.get(name)?.supportsBackground ?? false
  }

  /**
   * Get total tool count
   */
  size(): number {
    return this.tools.size
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry()

let registered = false
let registerPromise: Promise<void> | null = null

/**
 * Ensure tools are registered (only once) - returns promise
 */
export function ensureToolsRegistered(): Promise<void> {
  if (registered) return Promise.resolve()
  if (registerPromise) return registerPromise

  registered = true
  registerPromise = import('./builtin/index').then(({ registerBuiltinTools }) => {
    registerBuiltinTools()
  })
  return registerPromise
}
