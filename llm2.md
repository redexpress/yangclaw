# 多 Provider LLM 调用实现方案

> 参考 OpenClaw，使用 `@mariozechner/pi-ai` 的 `completeSimple` / `streamSimple` 接口。

---

## 一、安装依赖

```bash
npm install @mariozechner/pi-ai @mariozechner/pi-coding-agent
```

---

## 二、Provider 配置

```typescript
// src/lib/llm/providers.ts

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
  // MiniMax - Anthropic Messages 协议
  "minimax": {
    id: "MiniMax-M2.7",
    name: "MiniMax M2.7",
    api: "anthropic-messages",
    provider: "minimax",
    baseUrl: "https://api.minimax.io/anthropic",
    reasoning: true,
    input: ["text"],
    cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
    contextWindow: 200000,
    maxTokens: 8192,
  },

  // Qwen - OpenAI Completions 协议
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
}
```

---

## 三、调用接口

```typescript
// src/lib/llm/llm.ts

import { completeSimple, streamSimple, type Model } from "@mariozechner/pi-ai"
import { providers } from "./providers"

export interface LLMRequest {
  model: string  // "minimax" 或 "qwen"
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>
  stream?: boolean
  maxTokens?: number
}

// 非流式调用
export async function callLLM(request: LLMRequest) {
  const config = providers[request.model]
  if (!config) {
    throw new Error(`Unknown provider: ${request.model}`)
  }

  const apiKey = process.env[`${request.model.toUpperCase()}_API_KEY`] ||
                 process.env.ANTHROPIC_API_KEY ||
                 ""

  const model: Model<typeof config.api> = {
    id: config.id,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: config.reasoning,
    input: config.input,
    cost: config.cost,
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
  }

  const res = await completeSimple(
    model,
    {
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: Date.now(),
      })),
    },
    { apiKey, maxTokens: request.maxTokens ?? config.maxTokens }
  )

  // 解析 content blocks
  let text = ""
  let reasoning = ""

  for (const block of res.content) {
    if (block.type === "text") {
      text += block.text
    } else if (block.type === "thinking") {
      reasoning += block.thinking
    }
  }

  return { text, reasoning, usage: res.usage }
}

// 流式调用
export async function streamLLM(
  request: LLMRequest,
  onChunk: (text: string, type: "text" | "thinking") => void
) {
  const config = providers[request.model]
  if (!config) {
    throw new Error(`Unknown provider: ${request.model}`)
  }

  const apiKey = process.env[`${request.model.toUpperCase()}_API_KEY`] ||
                 process.env.ANTHROPIC_API_KEY ||
                 ""

  const model: Model<typeof config.api> = {
    id: config.id,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: config.reasoning,
    input: config.input,
    cost: config.cost,
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
  }

  await streamSimple(
    model,
    {
      messages: request.messages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: Date.now(),
      })),
    },
    (chunk) => {
      onChunk(chunk.text, chunk.type)
    },
    { apiKey, maxTokens: request.maxTokens ?? config.maxTokens }
  )
}
```

---

## 四、环境变量

```bash
# .env
MINIMAX_API_KEY=your_minimax_key
QWEN_API_KEY=your_qwen_key
# 或者用通用的
ANTHROPIC_API_KEY=your_key
```

---

## 五、使用示例

```typescript
// 调用 MiniMax
const res = await callLLM({
  model: "minimax",
  messages: [{ role: "user", content: "回复 OK" }],
  maxTokens: 1024,
})
console.log(res.text)

// 调用 Qwen
const qwenRes = await callLLM({
  model: "qwen",
  messages: [{ role: "user", content: "Hello" }],
})
console.log(qwenRes.text)

// 流式调用
await streamLLM(
  { model: "minimax", messages: [{ role: "user", content: "Hello" }] },
  (text, type) => {
    console.log(`[${type}] ${text}`)
  }
)
```

---

## 六、文件结构

```
src/
├── lib/
│   └── llm/
│       ├── providers.ts  # Provider 配置
│       └── llm.ts       # 调用接口
```

---

## 七、关键类型

```typescript
// pi-ai 的 Model 类型
type Model<ApiType> = {
  id: string
  name: string
  api: ApiType
  provider: string
  baseUrl: string
  reasoning: boolean
  input: Array<"text" | "image">
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
  contextWindow: number
  maxTokens: number
}

// completeSimple 返回
type CompleteResult = {
  content: Array<{ type: "text"; text: string } | { type: "thinking"; thinking: string }>
  usage?: { input: number; output: number }
}
```
