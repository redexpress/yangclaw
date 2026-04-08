export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Session {
  id: string
  key: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
  metadata: {
    channel?: string
    senderId?: string
    agentId?: string
  }
}