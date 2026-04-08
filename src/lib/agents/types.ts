export interface AgentInput {
  sessionKey: string
  userMessage: string
  senderId: string
  channel: string
}

export interface AgentOutput {
  reply: string
  reasoning?: string
  usage?: {
    inputTokens: number
    outputTokens: number
  }
}