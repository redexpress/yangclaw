export interface ParsedSessionKey {
  agentId: string
  channel: string
  kind: 'dm' | 'group'
  peerId: string
}

export function parseSessionKey(key: string): ParsedSessionKey | null {
  const parts = key.split(':')

  if (parts[0] !== 'agent' || parts.length !== 5) {
    return null
  }

  const [_, agentId, channel, kind, peerId] = parts

  if (kind !== 'dm' && kind !== 'group') {
    return null
  }

  return { agentId, channel, kind, peerId }
}

export function buildSessionKey(
  agentId: string,
  channel: string,
  kind: 'dm' | 'group',
  peerId: string
): string {
  return `agent:${agentId}:${channel}:${kind}:${peerId}`
}