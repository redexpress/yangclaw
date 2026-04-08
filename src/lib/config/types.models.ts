/** Aligned with OpenClaw naming; Yangclaw supports a subset at runtime. */
export const SUPPORTED_MODEL_APIS = ['openai-completions', 'anthropic-messages'] as const

export type SupportedModelApi = (typeof SUPPORTED_MODEL_APIS)[number]

export type ModelCompatConfig = {
  supportsStore?: boolean
  supportsDeveloperRole?: boolean
  supportsReasoningEffort?: boolean
  maxTokensField?: 'max_completion_tokens' | 'max_tokens'
  thinkingFormat?: 'openai' | 'zai' | 'qwen'
  requiresToolResultName?: boolean
  requiresAssistantAfterToolResult?: boolean
  requiresThinkingAsText?: boolean
}

export type ModelDefinitionConfig = {
  id: string
  name: string
  reasoning: boolean
  input: Array<'text' | 'image'>
  cost: {
    input: number
    output: number
    cacheRead: number
    cacheWrite: number
  }
  contextWindow: number
  maxTokens: number
  compat?: ModelCompatConfig
}

export type ModelProviderConfig = {
  baseUrl: string
  api: SupportedModelApi
  auth?: 'api-key' | 'aws-sdk' | 'oauth' | 'token'
  apiKey: string
  headers?: Record<string, string>
  authHeader?: boolean
  models: ModelDefinitionConfig[]
}

export type ModelsConfig = {
  mode?: 'merge' | 'replace'
  providers: Record<string, ModelProviderConfig>
}

export type AgentsDefaultsModel = {
  primary: string
  fallbacks?: string[]
}

export type YangclawConfig = {
  models: ModelsConfig
  agents?: {
    defaults?: {
      model?: AgentsDefaultsModel
    }
  }
  workspace?: string
}
