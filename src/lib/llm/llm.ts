import { completeSimple, streamSimple, type Model } from "@mariozechner/pi-ai"
import { providers, type ModelConfig } from "./providers"
import { loadYangclawFromDir } from '../config/load-yangclaw'

export interface LLMRequest {
  model: string
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
  stream?: boolean
  maxTokens?: number
}

function getApiKey(provider: string): string {
  // First check env var
  const envKey = process.env[`${provider.toUpperCase()}_API_KEY`]
  if (envKey) return envKey
  // Fall back to yangclaw.yaml config
  const result = loadYangclawFromDir()
  if (result.ok) {
    const apiKey = result.config.models.providers[provider]?.apiKey
    if (apiKey) return apiKey
  }
  // Last fallback to ANTHROPIC_API_KEY
  return process.env.ANTHROPIC_API_KEY || ""
}

function resolveModel(modelSpec: string): { provider: string; modelId: string; config: ModelConfig } {
  // Handle "provider/model" format (e.g. "deepseek/deepseek-chat")
  if (modelSpec.includes('/')) {
    const [provider, modelId] = modelSpec.split('/')
    const config = providers[provider]
    if (!config) throw new Error(`Unknown provider: ${provider}`)
    return { provider, modelId, config }
  }
  // Handle just provider name (e.g. "minimax")
  const config = providers[modelSpec]
  if (!config) throw new Error(`Unknown provider: ${modelSpec}`)
  return { provider: modelSpec, modelId: config.id, config }
}

export async function callLLM(request: LLMRequest) {
  const resolved = resolveModel(request.model)
  const { provider, modelId, config } = resolved

  const apiKey = getApiKey(provider)
  if (!apiKey) {
    throw new Error(`No API key for provider: ${provider}`)
  }

  const model: Model<typeof config.api> = {
    id: modelId,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: config.reasoning,
    input: config.input,
    cost: config.cost,
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
  }

  const messagesPayload = {
    messages: request.messages.map((m) => {
      const content = typeof m.content === 'string'
        ? [{ type: 'text' as const, text: m.content }]
        : m.content
      return { role: m.role, content }
    }),
  } as Parameters<typeof completeSimple<typeof config.api>>[1]

  const result = await completeSimple(
    model,
    messagesPayload,
    { apiKey, maxTokens: request.maxTokens ?? config.maxTokens }
  )

  let text = ""
  let reasoning = ""

  // Handle content as string or array
  if (typeof result.content === 'string') {
    text = result.content
  } else if (Array.isArray(result.content)) {
    for (const block of result.content) {
      if (block.type === "text") {
        text += block.text
      } else if (block.type === "thinking") {
        reasoning += block.thinking
      }
    }
  }

  return { text, reasoning, usage: result.usage }
}

export async function streamLLM(
  request: LLMRequest,
  onChunk: (text: string, type: "text" | "thinking") => void
) {
  const resolved = resolveModel(request.model)
  const { provider, modelId, config } = resolved

  const apiKey = getApiKey(provider)
  if (!apiKey) {
    throw new Error(`No API key for provider: ${provider}`)
  }

  const model: Model<typeof config.api> = {
    id: modelId,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: config.reasoning,
    input: config.input,
    cost: config.cost,
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
  }

  const streamMessages = {
    messages: request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  } as Parameters<typeof streamSimple<typeof config.api>>[1]

  const eventStream = streamSimple(model, streamMessages, {
    apiKey,
    maxTokens: request.maxTokens ?? config.maxTokens,
  })

  for await (const ev of eventStream) {
    if (ev.type === 'text_delta') {
      onChunk(ev.delta, 'text')
    } else if (ev.type === 'thinking_delta') {
      onChunk(ev.delta, 'thinking')
    }
  }
}
