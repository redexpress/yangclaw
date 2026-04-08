import type { NextApiRequest, NextApiResponse } from 'next'
import dns from 'node:dns'
import { loadYangclawFromDir, getWorkspaceDir } from '@/lib/config/load-yangclaw'
import { loadSkills, buildSkillsSnapshot } from '@/lib/skills'
import { resolveTryList } from '@/lib/llm/resolve-model'
import { sessionStore } from '@/lib/sessions/store'
import { buildSessionKey } from '@/lib/sessions/keys'
import type { DailyMemoryStore } from '@/lib/memory/daily'
import { ensureToolsRegistered } from '@/lib/tools'
import { createAgentClient } from '@/lib/tools/agent-client'
import type { AgentEvent } from '@mariozechner/pi-agent-core'

// Lazy-load dailyMemory to avoid module initialization issues with getWorkspaceDir
let _dailyMemory: DailyMemoryStore | null = null
async function getDailyMemory(): Promise<DailyMemoryStore> {
  if (!_dailyMemory) {
    console.log('[chat-agent] loading dailyMemory module...')
    const mod = await import('@/lib/memory/daily')
    _dailyMemory = mod.dailyMemory
    console.log('[chat-agent] dailyMemory module loaded')
  }
  return _dailyMemory
}

dns.setDefaultResultOrder('ipv4first')

function getSystemPrompt(): string {
  return `You are YangClaw personal assistant.
Important rule: when the user shares personal information (name, preferences, experiences, etc.), you MUST immediately call the remember tool to store it.
Before answering questions about past work, decisions, dates, names, preferences or todos, use the read tool to search MEMORY.md and memory/*.md first.
Be concise and helpful.
When you need to perform actions, use tools to complete tasks.`
}

/**
 * Extract text content from useChat UIMessage format
 * UIMessage has parts: [{ type: 'text', text: string }, ...]
 */
function extractTextFromMessage(msg: { role: string; parts?: Array<{ type: string; text?: string }>; content?: string }): string {
  // Handle UIMessage format with parts
  if (msg.parts?.length) {
    return msg.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
  }
  // Fallback to content string
  return typeof msg.content === 'string' ? msg.content : ''
}

/**
 * Convert useChat UIMessage to simple {role, content} format
 */
function normalizeMessages(reqMessages: unknown[]): Array<{ role: string; content: string }> {
  if (!Array.isArray(reqMessages)) return []
  return reqMessages
    .filter((m): m is { role: string; parts?: Array<{ type: string; text?: string }>; content?: string } =>
      m !== null && typeof m === 'object' && 'role' in m)
    .map((m) => ({
      role: String(m.role),
      content: extractTextFromMessage(m),
    }))
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { senderId = 'web_user' } = req.body as { senderId?: string }
  const reqMessages = req.body.messages as unknown[]

  if (!reqMessages?.length) {
    res.status(400).json({ error: 'messages required' })
    return
  }

  const normalizedMessages = normalizeMessages(reqMessages)
  const lastMessage = normalizedMessages[normalizedMessages.length - 1]
  if (!lastMessage || lastMessage.role !== 'user') {
    res.status(400).json({ error: 'last message must be from user' })
    return
  }

  // Support sessionKey from frontend to switch sessions
  const body = req.body as { senderId?: string; sessionKey?: string; messages?: unknown[]; model?: string }
  const sessionKey = body.sessionKey || buildSessionKey('main', 'web', 'dm', senderId)

  // Load daily memories (today + yesterday markdown files)
  let dailyMemoryContext = ''
  try {
    dailyMemoryContext = (await getDailyMemory()).readRecent(2)
  } catch (e) {
    console.error('[chat-agent] dailyMemory.readRecent error:', e)
  }

  // Build system prompt
  const systemPrompt = getSystemPrompt()
  let fullSystemPrompt = systemPrompt + dailyMemoryContext

  // Inject skills into system prompt
  const workspaceDir = getWorkspaceDir()
  const skillsEntries = loadSkills({ workspaceDir })
  const snapshot = buildSkillsSnapshot(skillsEntries)
  if (snapshot.prompt) {
    fullSystemPrompt += `\n\n## Skills\n\n${snapshot.prompt}\n\n**CRITICAL**: Before using ANY skill, you MUST:\n1. First use the Read tool to read the SKILL.md file at the <location> shown above\n2. Follow the EXACT steps in the file\n3. Do NOT skip step 1 or improvise - you MUST read the file first`
  }
  console.log('[chat-agent] skills loaded:', snapshot.skills.length)
  console.log('[chat-agent] systemPrompt:', fullSystemPrompt.slice(0, 200))

  // Store user message
  sessionStore.addMessage(sessionKey, 'user', lastMessage.content)

  // Ensure tools are registered
  await ensureToolsRegistered()

  // Load config and get model
  const loaded = loadYangclawFromDir()
  if (!loaded.ok) {
    res.status(500).json({ error: 'Failed to load config' })
    return
  }

  const requestedModel = typeof body.model === 'string' ? body.model.trim() : ''
  let tryList: string[]
  try {
    tryList = resolveTryList(loaded.config, requestedModel || undefined)
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : String(e) })
    return
  }

  // Use first available model
  const modelRef = tryList[0]

  // Create agent client
  let agentClient: ReturnType<typeof createAgentClient>
  try {
    agentClient = createAgentClient({
      sessionKey,
      modelRef,
      systemPrompt: fullSystemPrompt,
      senderId,
      channel: 'web',
    })
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    return
  }

  const { agent } = agentClient

  // Set SSE headers (match chat2)
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('x-vercel-ai-ui-message-stream', 'v1')

  // Subscribe to agent events and forward to SSE
  let reasoningId = 0
  const unsub = agent.subscribe((event: AgentEvent) => {
    if (res.writableEnded) return

    // Debug log all events
    console.log('[chat-agent] event:', event.type)

    switch (event.type) {
      case 'message_start': {
        console.log('[chat-agent] message_start, role:', event.message.role, 'content:', JSON.stringify(event.message.content).slice(0, 200))
        // Send start event like chat2
        res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`)
        break
      }
      case 'message_end': {
        console.log('[chat-agent] message_end, role:', event.message.role, 'content:', JSON.stringify(event.message.content).slice(0, 200))
        // Don't forward - text_end comes through message_update
        break
      }
      case 'message_update': {
        const ev = event.assistantMessageEvent
        if (ev.type === 'text_start') {
          console.log('[chat-agent] text_start')
          res.write(`data: ${JSON.stringify({ type: 'text-start', id: '1' })}\n\n`)
        } else if (ev.type === 'text_delta') {
          console.log('[chat-agent] text_delta:', ev.delta?.slice(0, 50))
          res.write(`data: ${JSON.stringify({ type: 'text-delta', id: '1', delta: ev.delta })}\n\n`)
        } else if (ev.type === 'text_end') {
          console.log('[chat-agent] text_end')
          res.write(`data: ${JSON.stringify({ type: 'text-end', id: '1' })}\n\n`)
        } else if (ev.type === 'thinking_start') {
          reasoningId++
          res.write(`data: ${JSON.stringify({ type: 'reasoning-start', id: String(reasoningId) })}\n\n`)
        } else if (ev.type === 'thinking_delta') {
          res.write(`data: ${JSON.stringify({ type: 'reasoning-delta', id: String(reasoningId), delta: ev.delta })}\n\n`)
        } else if (ev.type === 'thinking_end') {
          res.write(`data: ${JSON.stringify({ type: 'reasoning-end', id: String(reasoningId) })}\n\n`)
        } else if (ev.type === 'toolcall_start') {
          const toolCall = ev.partial.content[ev.contentIndex]
          const toolCallId = toolCall?.type === 'toolCall' ? toolCall.id : String(ev.contentIndex)
          const toolName = toolCall?.type === 'toolCall' ? toolCall.name : 'unknown'
          res.write(`data: ${JSON.stringify({ type: 'tool-input-start', toolCallId, toolName })}\n\n`)
        } else if (ev.type === 'toolcall_delta') {
          const toolCall = ev.partial.content[ev.contentIndex]
          const toolCallId = toolCall?.type === 'toolCall' ? toolCall.id : String(ev.contentIndex)
          res.write(`data: ${JSON.stringify({ type: 'tool-input-delta', toolCallId, inputTextDelta: ev.delta })}\n\n`)
        } else if (ev.type === 'toolcall_end') {
          // Skip - tool input is complete, tool_execution_start will follow
        }
        break
      }
      case 'tool_execution_start': {
        console.log('[chat-agent] tool_execution_start:', event.toolName, event.args)
        res.write(`data: ${JSON.stringify({ type: 'tool-input-available', toolCallId: event.toolCallId, toolName: event.toolName, input: event.args })}\n\n`)
        break
      }
      case 'tool_execution_end': {
        res.write(`data: ${JSON.stringify({ type: 'tool-output-available', toolCallId: event.toolCallId, output: event.result })}\n\n`)
        break
      }
      case 'turn_end': {
        console.log('[chat-agent] turn_end')
        res.write(`data: ${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n\n`)
        res.write('data: [DONE]\n\n')
        break
      }
      case 'agent_end': {
        console.log('[chat-agent] agent_end')
        break
      }
      case 'agent_start': {
        console.log('[chat-agent] agent_start')
        break
      }
    }
  })

  // Handle client disconnect
  req.on('close', () => {
    unsub()
    agent.abort()
  })

  try {
    // Send user message
    console.log('[chat-agent] Calling agent.prompt with:', lastMessage.content)
    await agent.prompt({
      role: 'user',
      content: lastMessage.content,
      timestamp: Date.now(),
    })
    console.log('[chat-agent] agent.prompt completed')

    // Signal completion
    res.write(`data: ${JSON.stringify({ type: 'finish', finishReason: 'stop' })}\n\n`)
  } catch (err) {
    console.log('[chat-agent] agent.prompt error:', err)
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', errorText: err instanceof Error ? err.message : String(err) })}\n\n`)
    }
  } finally {
    unsub()
    if (!res.writableEnded) {
      res.end()
    }
  }
}
