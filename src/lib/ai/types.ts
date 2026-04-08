export type Provider = 'openai' | 'anthropic'

export interface ModelConfig {
  provider: Provider
  model: string
  apiKey: string
  baseUrl?: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: Date
}
