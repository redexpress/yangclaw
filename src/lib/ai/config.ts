import { Provider, ModelConfig } from './types'

const AI_PROVIDER = (process.env.AI_PROVIDER || 'openai') as Provider

export function getModelConfig(): ModelConfig {
  const provider = AI_PROVIDER

  if (provider === 'anthropic') {
    return {
      provider: 'anthropic',
      model: process.env.ANTHROPIC_MODEL || 'MiniMax-M2.7',
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseUrl: process.env.ANTHROPIC_BASE_URL,
    }
  }

  return {
    provider: 'openai',
    model: 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL,
  }
}

export function getProvider(): Provider {
  return AI_PROVIDER
}
