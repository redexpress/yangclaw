import { routeMessage, InboundMessage } from '../routing'
import { parseCommand, handleCommand } from '../commands'
import { runAgentLoop } from '../agents/loop'

export interface MessageResult {
  reply: string
  sessionKey: string
  agentId: string
  isCommand: boolean
  reasoning?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}

export async function handleMessage(msg: InboundMessage): Promise<MessageResult> {
  // 1. Route
  const route = routeMessage(msg)

  // 2. Check if it's a command
  const parsed = parseCommand(msg.text)

  if (parsed.isCommand) {
    const result = await handleCommand(parsed.command!, parsed.args ?? '', route.sessionKey)
    return {
      reply: result.reply,
      sessionKey: route.sessionKey,
      agentId: route.agentId,
      isCommand: true,
    }
  }

  // 3. Not a command, run Agent
  const result = await runAgentLoop({
    sessionKey: route.sessionKey,
    userMessage: msg.text,
    senderId: msg.sender,
    channel: msg.channel,
  })

  return {
    reply: result.reply,
    sessionKey: route.sessionKey,
    agentId: route.agentId,
    isCommand: false,
    reasoning: result.reasoning,
    usage: result.usage,
  }
}
