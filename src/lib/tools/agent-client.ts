/**
 * Agent client: creates and manages pi-agent-core Agent instances
 */
import { Agent } from '@mariozechner/pi-agent-core'
import type { Model } from '@mariozechner/pi-ai'
import { loadYangclawFromDir } from '../config/load-yangclaw'
import { resolveModel } from '../llm/resolve-model'
import type { ResolvedModel } from '../llm/resolve-model'
import { toolRegistry } from './registry'
import { adaptTools, type ToolContextOptions } from './agent-adapter'
import { getWorkspaceDir } from '../config/load-yangclaw'

export interface AgentClientOptions {
  sessionKey: string
  modelRef: string
  systemPrompt: string
  senderId: string
  channel: string
}

/**
 * pi-ai constructs the Anthropic API endpoint as `${baseUrl}/v1/messages`.
 * If a user configures `baseUrl` with a trailing `/v1`, the resulting URL
 * becomes "…/v1/v1/messages" which the API rejects with a 404.
 *
 * Strip a single trailing `/v1` (with optional trailing slash) from the
 * baseUrl for anthropic-messages models.
 */
function normalizeAnthropicBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/v1\/?$/, '')
}

/**
 * Convert ResolvedModel to pi-ai Model
 */
function toPiAiModel(resolved: ResolvedModel): Model<any> {
  let baseUrl = resolved.baseUrl

  // HACK: Strip trailing /v1 from baseUrl for anthropic-messages models.
  // pi-ai appends /v1/messages itself, so we must avoid double /v1.
  // See: README.md "Anthropic baseUrl Hack"
  if (resolved.api === 'anthropic-messages') {
    baseUrl = normalizeAnthropicBaseUrl(baseUrl)
  }

  return {
    id: resolved.model.id,
    name: resolved.model.name,
    api: resolved.api as any,
    provider: resolved.providerKey as any,
    baseUrl,
    reasoning: resolved.model.reasoning,
    input: resolved.model.input as ('text' | 'image')[],
    cost: resolved.model.cost,
    contextWindow: resolved.model.contextWindow,
    maxTokens: resolved.model.maxTokens,
    apiKey: resolved.apiKey,
  } as Model<any>
}

/**
 * Create an Agent client for a session
 */
export function createAgentClient(options: AgentClientOptions): {
  agent: Agent
  contextOpts: ToolContextOptions
} {
  const { sessionKey, modelRef, systemPrompt, senderId, channel } = options

  // 1. Load config and resolve model
  const loaded = loadYangclawFromDir()
  if (!loaded.ok) {
    throw new Error('Failed to load yangclaw config')
  }

  const resolved = resolveModel(loaded.config, modelRef)
  const model = toPiAiModel(resolved)

  // 2. Create Agent
  const agent = new Agent({
    // Provide API key for the LLM provider
    getApiKey: (provider: string) => resolved.apiKey,
    // Convert messages to LLM format
    convertToLlm: (messages) => {
      const result = messages
        .filter(
          (m): m is Extract<typeof m, { role: 'user' | 'assistant' | 'toolResult' }> =>
            'role' in m && ['user', 'assistant', 'toolResult'].includes(m.role),
        )
        .map((m) => {
          if (m.role === 'user') {
            return {
              role: 'user' as const,
              content: typeof m.content === 'string' ? m.content : (m.content as Array<{ type: string; text?: string }>).map((c) => c.text ?? '').join(''),
              timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
            }
          }
          if (m.role === 'toolResult') {
            return {
              role: 'toolResult' as const,
              toolCallId: 'toolCallId' in m ? m.toolCallId : '',
              toolName: 'toolName' in m ? m.toolName : '',
              content: Array.isArray(m.content)
                ? m.content.map((c) => ('text' in c ? c : { type: 'text', text: '' }))
                : [{ type: 'text' as const, text: String(m.content) }],
              isError: 'isError' in m ? Boolean(m.isError) : false,
              timestamp: typeof m.timestamp === 'number' ? m.timestamp : Date.now(),
            }
          }
          return m as any
        })
      return result
    },
  })

  // 3. Set model
  agent.setModel(model)

  // 3. Set system prompt
  agent.setSystemPrompt(systemPrompt)

  // 4. Register tools
  const tools = toolRegistry.getAll()
  const contextOpts: ToolContextOptions = {
    sessionKey,
    senderId,
    channel,
  }
  const agentTools = adaptTools(tools, contextOpts)
  agent.setTools(agentTools)

  return { agent, contextOpts }
}
