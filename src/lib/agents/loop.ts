import { sessionStore } from '../sessions/store'
import { callLLM } from '../llm/llm'
import { loadYangclawFromDir } from '../config/load-yangclaw'
import type { AgentInput, AgentOutput } from './types'

interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

function getDefaultModel(): string {
  const result = loadYangclawFromDir()
  if (result.ok) {
    const model = result.config.agents?.defaults?.model?.primary
    if (model) return model
  }
  return 'minimax'
}

function getSystemPrompt(_agentId: string): string {
  return `You are YangClaw, a personal AI assistant.
Remember important things the user tells you.
Keep replies concise and helpful.`
}

/**
 * Agent Loop: one complete AI conversation
 *
 * Steps:
 * 1. Read session history
 * 2. Build LLM message list (system + history + new message)
 * 3. Call LLM
 * 4. Store messages to session
 * 5. Return reply
 */
export async function runAgentLoop(input: AgentInput): Promise<AgentOutput> {
  const { sessionKey, userMessage } = input

  // 1. Parse session key to get agent id
  const parts = sessionKey.split(':')
  const agentId = parts[1] ?? 'main'

  // 2. Load history messages
  const history = sessionStore.getMessages(sessionKey)

  // 3. Build LLM message list
  const messages: LLMMessage[] = []

  // System prompt
  const systemPrompt = getSystemPrompt(agentId)
  if (systemPrompt) {
    messages.push({ role: 'system', content: systemPrompt })
  }

  // History messages
  for (const msg of history) {
    messages.push({ role: msg.role, content: msg.content })
  }

  // User new message
  messages.push({ role: 'user', content: userMessage })

  // 4. Call LLM
  const model = getDefaultModel()
  const result = await callLLM({
    model,
    messages,
    maxTokens: 1024,
  })

  // 5. Store messages to session (user first, then AI)
  sessionStore.addMessage(sessionKey, 'user', userMessage)
  sessionStore.addMessage(sessionKey, 'assistant', result.text || '[empty]')

  // 6. Return reply
  return {
    reply: result.text,
    reasoning: result.reasoning,
    usage: result.usage as unknown as { inputTokens: number; outputTokens: number } | undefined,
  }
}
