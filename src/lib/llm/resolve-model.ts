import { expandConfigValue } from '../config/load-yangclaw'
import type {
  ModelDefinitionConfig,
  ModelProviderConfig,
  SupportedModelApi,
  YangclawConfig,
} from '../config/types.models'

export type ResolvedModel = {
  ref: string
  providerKey: string
  provider: ModelProviderConfig
  model: ModelDefinitionConfig
  apiKey: string
  baseUrl: string
  api: SupportedModelApi
}

export function parseModelRef(ref: string): { providerKey: string; modelId: string } {
  const s = ref.trim()
  const i = s.indexOf('/')
  if (i <= 0 || i === s.length - 1) {
    throw new Error(`Invalid model ref "${ref}" (expected providerKey/modelId)`)
  }
  return { providerKey: s.slice(0, i).trim(), modelId: s.slice(i + 1).trim() }
}

export function resolveModel(config: YangclawConfig, ref: string): ResolvedModel {
  const { providerKey, modelId } = parseModelRef(ref)
  const provider = config.models.providers[providerKey]
  if (!provider) {
    throw new Error(`Unknown provider "${providerKey}"`)
  }
  const model = provider.models.find((m) => m.id === modelId)
  if (!model) {
    throw new Error(`Unknown model "${modelId}" for provider "${providerKey}"`)
  }
  const apiKey = expandConfigValue(provider.apiKey).trim()
  if (!apiKey) {
    throw new Error(`Missing API key for provider "${providerKey}" (check apiKey or env)`)
  }
  return {
    ref,
    providerKey,
    provider,
    model,
    apiKey,
    baseUrl: provider.baseUrl.replace(/\/+$/, ''),
    api: provider.api,
  }
}

/** When user picks a model, only that ref. Otherwise primary + deduped fallbacks. */
export function resolveTryList(config: YangclawConfig, requestedRef: string | undefined): string[] {
  const trimmed = requestedRef?.trim()
  if (trimmed) {
    return [trimmed]
  }
  const primary = config.agents?.defaults?.model?.primary?.trim()
  if (!primary) {
    throw new Error('agents.defaults.model.primary is not set in yangclaw.yaml')
  }
  const fallbacks = config.agents?.defaults?.model?.fallbacks ?? []
  const out: string[] = [primary]
  for (const f of fallbacks) {
    const t = f.trim()
    if (t && !out.includes(t)) out.push(t)
  }
  return out
}
