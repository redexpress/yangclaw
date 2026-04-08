export interface ModelConfig {
  id: string
  name: string
  api: "openai-completions" | "anthropic-messages"
  provider: string
  baseUrl: string
  reasoning: boolean
  input: Array<"text" | "image">
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
  contextWindow: number
  maxTokens: number
}

export const providers: Record<string, ModelConfig> = {
  // MiniMax - OpenAI Completions protocol
  "minimax": {
    id: "MiniMax-M2.7",
    name: "MiniMax M2.7",
    api: "openai-completions",
    provider: "minimax",
    baseUrl: "https://api.minimax.chat/v1",
    reasoning: true,
    input: ["text"],
    cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
    contextWindow: 200000,
    maxTokens: 8192,
  },

  // Qwen - OpenAI Completions protocol
  "qwen": {
    id: "qwen-plus",
    name: "Qwen Plus",
    api: "openai-completions",
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 131072,
    maxTokens: 8192,
  },

  // DeepSeek - OpenAI Completions protocol
  "deepseek": {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    reasoning: false,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 8192,
  },
}
