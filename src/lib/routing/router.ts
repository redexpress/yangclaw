import { buildSessionKey } from '../sessions/keys'
import { RouteMatch, InboundMessage, BindingRule } from './types'

const bindings: BindingRule[] = []

export function addBinding(rule: BindingRule): void {
  bindings.push(rule)
  bindings.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
}

export function routeMessage(msg: InboundMessage): RouteMatch {
  for (const binding of bindings) {
    if (!matchesBinding(msg, binding)) continue

    return {
      agentId: binding.agentId,
      channel: msg.channel,
      peerId: msg.peer.id,
      sessionKey: buildSessionKey(binding.agentId, msg.channel, msg.peer.kind, msg.peer.id),
    }
  }

  // No match, default to main
  return {
    agentId: 'main',
    channel: msg.channel,
    peerId: msg.peer.id,
    sessionKey: buildSessionKey('main', msg.channel, msg.peer.kind, msg.peer.id),
  }
}

function matchesBinding(msg: InboundMessage, binding: BindingRule): boolean {
  if (binding.channel && binding.channel !== msg.channel) {
    return false
  }

  if (binding.peerId && binding.peerId !== msg.peer.id) {
    return false
  }

  if (binding.peerPattern && !binding.peerPattern.test(msg.peer.id)) {
    return false
  }

  return true
}

export function getBindings(): BindingRule[] {
  return [...bindings]
}

export function clearBindings(): void {
  bindings.length = 0
}
