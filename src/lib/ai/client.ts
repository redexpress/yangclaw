import { getModelConfig } from './config'
import { Message } from './types'
import { streamText } from 'ai'

let openaiProvider: any = null
let anthropicProvider: any = null

function getOpenAIProvider() {
  if (!openaiProvider) {
    const { createOpenAI } = require('@ai-sdk/openai')
    const config = getModelConfig()
    openaiProvider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
  }
  return openaiProvider
}

function getAnthropicProvider() {
  if (!anthropicProvider) {
    const { createAnthropic } = require('@ai-sdk/anthropic')
    const config = getModelConfig()
    anthropicProvider = createAnthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    })
  }
  return anthropicProvider
}

export async function createAIStream(messages: Message[]) {
  const config = getModelConfig()

  if (config.provider === 'anthropic') {
    const provider = getAnthropicProvider()
    const model = provider(config.model)

    const result = await streamText({
      model,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    })

    return result
  }

  // OpenAI
  const provider = getOpenAIProvider()
  const model = provider(config.model)

  const result = await streamText({
    model,
    messages: messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  return result
}
