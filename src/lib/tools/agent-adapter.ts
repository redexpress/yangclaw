/**
 * Agent adapter: converts our Tool interface to pi-agent-core's AgentTool interface
 */
import type { AgentTool, AgentToolResult } from '@mariozechner/pi-agent-core'
import type { Tool, ToolContext } from './schema'
import type { Static, TSchema } from '@sinclair/typebox'
import { Type } from '@sinclair/typebox'
import { getWorkspaceDir } from '../config/load-yangclaw'

/**
 * Convert our ToolSchema to TypeBox schema
 */
function toolSchemaToTypeBox(schema: {
  type: 'object'
  properties: Record<string, { type: string; description?: string; enum?: string[] }>
  required?: string[]
}): TSchema {
  const properties: Record<string, TSchema> = {}

  for (const [key, param] of Object.entries(schema.properties)) {
    switch (param.type) {
      case 'string':
        properties[key] = Type.String({ description: param.description })
        break
      case 'number':
        properties[key] = Type.Number()
        break
      case 'boolean':
        properties[key] = Type.Boolean()
        break
      case 'object':
        properties[key] = Type.Object({})
        break
      default:
        properties[key] = Type.String({ description: param.description })
    }
  }

  return Type.Object(properties, { required: schema.required })
}

/**
 * Build ToolContext for a tool execution
 */
export interface ToolContextOptions {
  sessionKey: string
  senderId: string
  channel: string
}

export function buildToolContext(options: ToolContextOptions): ToolContext {
  return {
    sessionKey: options.sessionKey,
    workspaceDir: getWorkspaceDir(),
    senderId: options.senderId,
    channel: options.channel,
  }
}

/**
 * Adapt our Tool to pi-agent-core's AgentTool
 */
export function adaptTool(tool: Tool, contextOpts: ToolContextOptions): AgentTool {
  return {
    name: tool.name,
    label: tool.name,
    description: tool.description,
    parameters: toolSchemaToTypeBox(tool.schema as Parameters<typeof toolSchemaToTypeBox>[0]),
    execute: async (
      toolCallId: string,
      params: unknown,
      signal?: AbortSignal,
      onUpdate?: (partial: AgentToolResult<unknown>) => void,
    ) => {
      const context = buildToolContext(contextOpts)

      try {
        const result = await tool.execute(params as Record<string, unknown>, context)

        return {
          content: [{ type: 'text' as const, text: result.output ?? '' }],
          details: result,
          isError: !result.success,
        } as AgentToolResult<unknown>
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: err instanceof Error ? err.message : String(err) }],
          details: { error: err instanceof Error ? err.message : String(err) },
          isError: true,
        } as AgentToolResult<unknown>
      }
    },
  }
}

/**
 * Adapt multiple tools
 */
export function adaptTools(
  tools: Tool[],
  contextOpts: ToolContextOptions,
): AgentTool[] {
  return tools.map((tool) => adaptTool(tool, contextOpts))
}
