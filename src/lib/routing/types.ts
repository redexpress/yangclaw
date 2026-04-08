// Route match result
export interface RouteMatch {
  agentId: string
  channel: string
  peerId: string
  sessionKey: string
}

// Inbound message (from channel)
export interface InboundMessage {
  channel: string
  peer: {
    kind: 'dm' | 'group'
    id: string
  }
  sender: string
  text: string
  timestamp: number
}

// Binding rule
export interface BindingRule {
  agentId: string
  channel?: string
  peerId?: string
  peerPattern?: RegExp
  priority?: number
}
