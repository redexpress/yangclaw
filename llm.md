# 多 Provider LLM 调用架构设计

> 本文档解释如何设计一个支持多模型提供商的 LLM 调用框架。OpenClaw 是这一架构的参考实现。

---

## 一、解决的问题

当你需要同时调用多种 LLM（OpenAI Claude Google 等）时，如果不加抽象，代码会变成：

```typescript
// 噩梦般的 if-else
if (provider === "openai") {
  const client = new OpenAI({ apiKey });
  const result = await client.chat.completions.create({ model, messages });
} else if (provider === "anthropic") {
  const client = new Anthropic({ apiKey });
  const result = await client.messages.create({ model, messages });
} else if (provider === "google") {
  const client = new GoogleGenerativeAI({ apiKey });
  const result = await client.generateContent({ model, contents });
}
```

每次加新 Provider 都要改这段代码，散落在各处。

**目标**：让调用方只说"用这个模型"，不关心背后是谁。

---

## 二、核心设计：三层架构

```
┌─────────────────┐
│   调用方         │  只说 model = "anthropic/claude-sonnet-4-5"
└────────┬────────┘
         │ ModelRef { provider, model }
         ▼
┌─────────────────┐
│   模型选择层     │  解析引用、别名、回退
└────────┬────────┘
         │ { resolved: ModelRef, apiProtocol }
         ▼
┌─────────────────┐
│   Provider 层   │  根据协议调用对应 API
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   外部 API      │  OpenAI / Anthropic / Google ...
└─────────────────┘
```

---

## 三、第一层：模型引用

### 3.1 统一引用格式

定义一种字符串格式定位任意模型：

```
provider/modelId
```

示例：`anthropic/claude-opus-4-5`、`openai/gpt-4o`

### 3.2 解析函数

```typescript
// 模型引用类型
interface ModelRef {
  provider: string;  // 提供商标识
  model: string;      // 模型 ID
}

// 解析 "provider/model" 字符串
function parseModelRef(raw: string, defaultProvider: string): ModelRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const slashIndex = trimmed.indexOf("/");

  if (slashIndex === -1) {
    // 没有斜杠，整串是模型 ID，使用默认 Provider
    return {
      provider: normalizeProvider(defaultProvider),
      model: trimmed,
    };
  }

  // 有斜杠，解析 provider 和 model
  const provider = trimmed.slice(0, slashIndex).trim();
  const model = trimmed.slice(slashIndex + 1).trim();

  if (!provider || !model) return null;

  return {
    provider: normalizeProvider(provider),
    model: model,
  };
}

// Provider ID 规范化（处理别名）
function normalizeProvider(provider: string): string {
  const map: Record<string, string> = {
    "z.ai": "zai",
    "z-ai": "zai",
    "opencode-zen": "opencode",
    "qwen": "qwen-portal",
  };
  return map[provider.toLowerCase()] ?? provider.toLowerCase();
}
```

### 3.3 使用示例

```typescript
parseModelRef("claude-sonnet-4-5", "anthropic")
// → { provider: "anthropic", model: "claude-sonnet-4-5" }

parseModelRef("openai/gpt-4o", "anthropic")
// → { provider: "openai", model: "gpt-4o" }
```

---

## 四、第二层：Provider 抽象

### 4.1 Provider 的职责

Provider 是"适配器"，把统一调用转换成具体 API 请求：

1. 持有配置（baseUrl、apiKey、使用的协议）
2. 知道如何把请求发给自己对应的外部 API
3. 返回统一格式的响应

### 4.2 Provider 配置结构

```typescript
interface ProviderConfig {
  baseUrl: string;           // API 端点
  apiKey?: string;           // 认证密钥
  auth?: "api-key" | "aws-sdk" | "oauth" | "token";
  api: ApiProtocol;          // 使用哪种协议
  models: ModelConfig[];     // 该 Provider 下的模型列表
}

interface ModelConfig {
  id: string;                // 模型 ID
  name: string;              // 显示名
  contextWindow: number;     // 上下文窗口
  maxTokens: number;         // 最大输出
  reasoning: boolean;        // 是否支持推理
  input: ("text" | "image")[];
  cost: {
    input: number;
    output: number;
    cacheRead?: number;
    cacheWrite?: number;
  };
}
```

### 4.3 定义支持的 API 协议

这是关键设计：**不要按 Provider 分类，按 API 协议分类**。

```typescript
type ApiProtocol =
  | "openai-completions"   // OpenAI Chat Completions 格式
  | "openai-responses"     // OpenAI Responses API
  | "anthropic-messages"   // Anthropic Messages API
  | "google-generative-ai" // Google Gemini
  | "github-copilot"      // GitHub Copilot
  | "bedrock-converse";   // AWS Bedrock Converse
```

为什么这样分？因为不同 Provider 可能用同一个协议：

```
openai-completions 协议:
  - minimax
  - moonshot
  - ollama
  - venice

anthropic-messages 协议:
  - anthropic
  - minimax-portal
  - xiaomi
```

### 4.4 Provider 配置示例

```typescript
const providers: Record<string, ProviderConfig> = {
  "anthropic": {
    baseUrl: "https://api.anthropic.com/v1",
    apiKey: process.env.ANTHROPIC_API_KEY,
    auth: "api-key",
    api: "anthropic-messages",
    models: [
      {
        id: "claude-opus-4-5",
        name: "Claude Opus 4.5",
        contextWindow: 200000,
        maxTokens: 8192,
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 7.5 },
      },
    ],
  },

  "openai": {
    baseUrl: "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY,
    auth: "api-key",
    api: "openai-responses",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        contextWindow: 128000,
        maxTokens: 16384,
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 5, output: 15 },
      },
    ],
  },

  "minimax": {
    baseUrl: "https://api.minimax.chat/v1",
    apiKey: process.env.MINIMAX_API_KEY,
    auth: "api-key",
    api: "openai-completions",  // 和 openai 用同一协议！
    models: [
      {
        id: "MiniMax-M2.1",
        name: "MiniMax M2.1",
        contextWindow: 200000,
        maxTokens: 8192,
        reasoning: false,
        input: ["text"],
        cost: { input: 15, output: 60 },
      },
    ],
  },
};
```

---

## 五、第三层：统一调用接口

### 5.1 定义统一消息格式

不管背后用哪个 API，请求和响应用统一格式：

```typescript
interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface LLMRequest {
  model: ModelRef;
  messages: LLMMessage[];
  stream?: boolean;
  maxTokens?: number;
  systemPrompt?: string;
}

interface LLMResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
  finishReason: "stop" | "length" | "content_filter" | "error";
}
```

### 5.2 调用分发函数

```typescript
async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  const { model, messages, stream, maxTokens, systemPrompt } = request;

  // 1. 根据 Provider 获取配置
  const providerConfig = providers[model.provider];
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${model.provider}`);
  }

  // 2. 找到具体模型配置
  const modelConfig = providerConfig.models.find(m => m.id === model.model);
  if (!modelConfig) {
    throw new Error(`Model not found: ${model.provider}/${model.model}`);
  }

  // 3. 根据协议分发到具体实现
  switch (providerConfig.api) {
    case "anthropic-messages":
      return callAnthropic(providerConfig, modelConfig, request);
    case "openai-responses":
    case "openai-completions":
      return callOpenAI(providerConfig, modelConfig, request);
    case "google-generative-ai":
      return callGoogle(providerConfig, modelConfig, request);
    default:
      throw new Error(`Unsupported API: ${providerConfig.api}`);
  }
}
```

### 5.3 协议实现示例

```typescript
// Anthropic Messages API 实现
async function callAnthropic(
  provider: ProviderConfig,
  model: ModelConfig,
  request: LLMRequest
): Promise<LLMResponse> {
  const client = new Anthropic({ apiKey: provider.apiKey });

  const response = await client.messages.create({
    model: model.id,
    max_tokens: request.maxTokens ?? model.maxTokens,
    system: request.systemPrompt,
    messages: request.messages.map(m => ({
      role: m.role,
      content: m.content,
    })),
  });

  return {
    content: response.content[0].text,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_tokens,
      cacheWriteTokens: response.usage.cache_creation_tokens,
    },
    finishReason: response.stop_reason === "end_turn" ? "stop" : "length",
  };
}

// OpenAI 协议实现
async function callOpenAI(
  provider: ProviderConfig,
  model: ModelConfig,
  request: LLMRequest
): Promise<LLMResponse> {
  const client = new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseUrl });

  const response = await client.chat.completions.create({
    model: model.id,
    max_tokens: request.maxTokens ?? model.maxTokens,
    messages: [
      ...(request.systemPrompt ? [{ role: "system" as const, content: request.systemPrompt }] : []),
      ...request.messages,
    ],
  });

  const usage = response.usage;
  return {
    content: response.choices[0].message.content ?? "",
    usage: {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
    },
    finishReason: response.choices[0].finish_reason ?? "stop",
  };
}
```

---

## 六、配置系统设计

### 6.1 多层配置合并

不要让用户覆盖一切，而是逐层合并：

```
内置默认配置 (硬编码的 Provider 列表)
    ↓ merge
用户配置文件 (models.providers)
    ↓ merge
环境变量 (API Key 等)
```

```typescript
interface ModelsConfig {
  mode: "merge" | "replace";  // merge=追加, replace=覆盖
  providers?: Record<string, ProviderConfig>;
}

// 合并逻辑
function mergeProviders(
  builtin: Record<string, ProviderConfig>,
  user: Record<string, ProviderConfig>,
  mode: "merge" | "replace"
): Record<string, ProviderConfig> {
  if (mode === "replace") {
    return user;
  }

  const result = { ...builtin };

  for (const [key, userProvider] of Object.entries(user)) {
    if (result[key]) {
      // 合并：用户配置 + 内置模型（去重）
      result[key] = mergeProviderModels(result[key], userProvider);
    } else {
      result[key] = userProvider;
    }
  }

  return result;
}

function mergeProviderModels(
  builtin: ProviderConfig,
  user: ProviderConfig
): ProviderConfig {
  // 用户指定的模型优先，内置中不冲突的保留
  const userModelIds = new Set(user.models.map(m => m.id));

  const mergedModels = [
    ...user.models,
    ...builtin.models.filter(m => !userModelIds.has(m.id)),
  ];

  return {
    ...builtin,
    ...user,
    models: mergedModels,
  };
}
```

### 6.2 环境变量驱动

某些 Provider 只配个 API Key 就够了，自动启用：

```typescript
function resolveImplicitProviders(): Record<string, ProviderConfig> {
  const providers: Record<string, ProviderConfig> = {};

  if (process.env.MINIMAX_API_KEY) {
    providers.minimax = {
      baseUrl: "https://api.minimax.chat/v1",
      apiKey: process.env.MINIMAX_API_KEY,
      api: "openai-completions",
      models: [{ id: "MiniMax-M2.1", ... }],
    };
  }

  if (process.env.MOONSHOT_API_KEY) {
    providers.moonshot = {
      baseUrl: "https://api.moonshot.ai/v1",
      apiKey: process.env.MOONSHOT_API_KEY,
      api: "openai-completions",
      models: [{ id: "kimi-k2.5", ... }],
    };
  }

  // AWS 凭证自动检测
  if (process.env.AWS_PROFILE || process.env.AWS_ACCESS_KEY_ID) {
    providers["amazon-bedrock"] = {
      baseUrl: `https://bedrock-runtime.${process.env.AWS_REGION ?? "us-east-1"}.amazonaws.com`,
      auth: "aws-sdk",
      api: "bedrock-converse",
      models: [], // 动态发现
    };
  }

  return providers;
}
```

### 6.3 模型别名

用户可以给常用模型起简短名字：

```typescript
interface ModelAlias {
  alias: string;           // 短名字，如 "claude"
  provider: string;        // anthropic
  model: string;           // claude-sonnet-4-5
}

interface AgentDefaults {
  model: string | { primary: string; fallbacks?: string[] };
  models?: Record<string, { primary: string; alias?: string }>;
}

// 解析时先查别名表
function resolveModelRef(raw: string, defaults: AgentDefaults): ModelRef {
  const aliasMap = new Map(
    Object.entries(defaults.models ?? {}).map(([key, val]) => [key, val.primary])
  );

  const aliased = aliasMap.get(raw) ?? raw;
  return parseModelRef(aliased, "anthropic");
}

// 使用
// 配置: models: { claude: "anthropic/claude-sonnet-4-5" }
// 调用: resolveModelRef("claude") → { provider: "anthropic", model: "claude-sonnet-4-5" }
```

---

## 七、回退机制

### 7.1 问题

当主模型挂了（限流、宕机），请求会直接失败。

### 7.2 方案：回退链

```typescript
async function callWithFallback(params: {
  candidates: ModelRef[];  // 候选模型列表
  request: LLMRequest;
  onError?: (error: Error, provider: string, model: string) => void;
}): Promise<LLMResponse> {
  const errors: Array<{ provider: string; model: string; error: string }> = [];

  for (const candidate of params.candidates) {
    try {
      return await callLLM({ ...params.request, model: candidate });
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      errors.push({ provider: candidate.provider, model: candidate.model, error: err });
      params.onError?.(error, candidate.provider, candidate.model);
    }
  }

  throw new Error(
    `All models failed:\n${errors.map(e => `${e.provider}/${e.model}: ${e.error}`).join("\n")}`
  );
}

// 使用
const candidates = [
  { provider: "anthropic", model: "claude-opus-4-5" },
  { provider: "anthropic", model: "claude-sonnet-4-5" },
  { provider: "openai", model: "gpt-4o" },
];

await callWithFallback({ candidates, request });
```

### 7.3 配置回退

```typescript
interface ModelWithFallback {
  primary: string;           // "anthropic/claude-opus-4-5"
  fallbacks?: string[];     // ["anthropic/claude-sonnet-4-5", "openai/gpt-4o"]
}

// 解析成候选列表
function resolveCandidates(
  model: string | ModelWithFallback
): ModelRef[] {
  const refs: ModelRef[] = [];

  if (typeof model === "string") {
    refs.push(parseModelRef(model, "anthropic"));
  } else {
    refs.push(parseModelRef(model.primary, "anthropic"));
    for (const fallback of model.fallbacks ?? []) {
      refs.push(parseModelRef(fallback, "anthropic"));
    }
  }

  return refs;
}
```

### 7.4 冷却机制（可选）

失败后一段时间内不再尝试：

```typescript
const cooldownTracker = new Map<string, number>(); // key = "provider/model", value = earliest retry timestamp

const COOLDOWN_MS = 60_000; // 1分钟

function isInCooldown(provider: string, model: string): boolean {
  const key = `${provider}/${model}`;
  const until = cooldownTracker.get(key);
  if (!until) return false;
  return Date.now() < until;
}

function markFailed(provider: string, model: string): void {
  const key = `${provider}/${model}`;
  cooldownTracker.set(key, Date.now() + COOLDOWN_MS);
}
```

---

## 八、认证体系

### 8.1 多认证模式

```typescript
interface ProviderConfig {
  // ...
  auth?: "api-key" | "aws-sdk" | "oauth" | "token";
}

// api-key: Authorization: Bearer <apiKey>
// aws-sdk: 自动从环境变量/配置获取 AWS 凭证
// oauth: OAuth 2.0 流程
// token: 直接作为 Bearer Token
```

### 8.2 多 Profile 支持

同一 Provider 可以有多个认证配置，按优先级尝试：

```typescript
interface AuthProfile {
  id: string;
  type: "api_key" | "token";
  key: string;
  lastUsed?: number;
}

interface AuthProfiles {
  [provider: string]: AuthProfile[];
}

// 选择可用 Profile
function selectAuthProfile(
  profiles: AuthProfile[],
  inCooldown: (id: string) => boolean
): AuthProfile | null {
  const available = profiles.filter(p => !inCooldown(p.id));
  if (available.length === 0) return null;

  // 按最近使用排序，刚失败的排后面
  return available.sort((a, b) => (b.lastUsed ?? 0) - (a.lastUsed ?? 0))[0];
}
```

### 8.3 API Key 环境变量约定

```typescript
// 支持多种格式
// "KEY" → 直接使用
// "${ENV_VAR}" → 引用环境变量
// "shell env: ENV_VAR" → Shell 环境变量

function resolveApiKey(raw: string): string {
  // 处理 ${ENV_VAR} 格式
  const envMatch = raw.match(/^\$\{([A-Z0-9_]+)\}$/);
  if (envMatch) {
    return process.env[envMatch[1]] ?? raw;
  }

  // 处理 shell env: 前缀
  const shellMatch = raw.match(/^shell env: ([A-Z0-9_]+)$/);
  if (shellMatch) {
    return process.env[shellMatch[1]] ?? raw;
  }

  return raw;
}
```

---

## 九、模型发现（可选）

### 9.1 静态 vs 动态

**静态**：配置里写死模型列表

**动态**：运行时自动探测可用模型

### 9.2 Ollama 本地发现示例

```typescript
async function discoverOllamaModels(): Promise<ModelConfig[]> {
  const response = await fetch("http://127.0.0.1:11434/api/tags");
  const data = await response.json();

  return data.models.map((model: { name: string }) => ({
    id: model.name,
    name: model.name,
    contextWindow: 128000,  // 默认值
    maxTokens: 8192,
    reasoning: model.name.toLowerCase().includes("r1"),
    input: ["text"] as const,
    cost: { input: 0, output: 0 },
  }));
}
```

### 9.3 AWS Bedrock 发现

```typescript
async function discoverBedrockModels(region: string): Promise<ModelConfig[]> {
  const client = new BedrockClient({ region });
  const command = new ListFoundationModelsCommand({});
  const response = await client.send(command);

  return response.modelSummaries.map(model => ({
    id: model.modelId,
    name: model.modelName ?? model.modelId,
    contextWindow: model.inputModalities,
    maxTokens: 4096,
    reasoning: false,
    input: model.inputModalities?.includes("TEXT") ? ["text"] : [],
    cost: { input: 0, output: 0 },
  }));
}
```

---

## 十、完整调用流程

```
用户调用
    │
    ▼
resolveModelRef("claude")  ──── 别名解析
    │
    ▼
parseModelRef("anthropic/claude-sonnet-4-5")  ──── 字符串解析
    │
    ▼
getProviderConfig("anthropic")  ──── Provider 查找
    │
    ▼
getModelConfig("claude-sonnet-4-5")  ──── 模型查找
    │
    ▼
selectAuthProfile()  ──── 认证选择
    │
    ▼
callWithFallback(candidates, request)  ──── 带上回退
    │
    ├── try: callAnthropic()  ──── 协议分发
    │       │
    │       ▼
    │       anthropic.messages.create()
    │
    └── catch
        ├── markFailed()
        └── retry next candidate
```

---

## 十一、关键设计原则

| 原则 | 说明 |
|------|------|
| **按协议分类，不按 Provider** | 减少重复代码，minimax 和 openai 都是 OpenAI 协议 |
| **配置驱动** | 硬编码越少越灵活 |
| **渐进式覆盖** | 用户配置 + 内置配置合并，不是全有全无 |
| **统一抽象** | 调用方只感知 ModelRef，不知道背后是谁 |
| **Fail-Fast 分离** | 发现错误尽快抛，但留足回退空间 |
| **冷却机制** | 失败的 Provider/Model 一段时间不尝试 |

---

## 十二、OpenClaw 参考

openclaw 目录 D:/git/openclaw

OpenClaw 是这一架构的完整实现：

| 组件 | 文件 | 作用 |
|------|------|------|
| 类型定义 | `src/config/types.models.ts` | ApiProtocol、ModelConfig、ProviderConfig |
| Provider 构建 | `src/agents/models-config.providers.ts` | 内置 Provider 定义、环境变量解析 |
| 配置合并 | `src/agents/models-config.ts` | 内置 + 用户配置合并逻辑 |
| 模型选择 | `src/agents/model-selection.ts` | parseModelRef、别名解析、回退解析 |
| 模型回退 | `src/agents/model-fallback.ts` | runWithModelFallback、冷却机制 |
| 模型目录 | `src/agents/model-catalog.ts` | 模型元数据存储和查询 |
| 认证管理 | `src/agents/auth-profiles.ts` | 多 Profile 管理 |

这些文件在 `ex1-2/openclaw/src/agents/` 目录下。

---

## 十三、核心依赖库

OpenClaw 的多 Provider 能力并非自己实现所有 Provider 的 HTTP 调用，而是依赖 `@mariozechner/pi-ai` 这个核心库：

```
@mariozechner/pi-ai  0.50.7
```

### 13.1 这个库做了什么

| 能力 | 说明 |
|------|------|
| **Provider 封装** | 内置 OpenAI、Anthropic、Google 等 Provider 的 HTTP 调用 |
| **统一接口** | `Model`、`streamSimple` 等抽象 |
| **Agent 运行时** | `createAgentSession`、`agent.run()` 等 |
| **函数调用** | 工具/函数调用的生成和执行 |

### 13.2 OpenClaw 在这之上做了什么

OpenClaw 作为**配置层**和**编排层**：

```
OpenClaw（配置 + 编排）
    │
    ├── 模型选择、别名解析、回退链
    ├── 认证管理、多 Profile
    ├── 配置合并、环境变量驱动
    └── 会话管理、Channel 集成
            │
            ▼
    @mariozechner/pi-ai（实际 HTTP 调用）
            │
            ├── openai provider
            ├── anthropic provider
            └── google provider
```

### 13.3 如果你自己实现

**方案 A：直接用 `@mariozechner/pi-ai`**

```
npm install @mariozechner/pi-ai
```

优点：开箱即用，支持主流 Provider
缺点：依赖这个库，扩展新 Provider 需要改这个库

**方案 B：自己实现 Provider 抽象**

如果你不想依赖这个库，需要自己实现：

```typescript
// 定义 Provider 接口
interface LLMProvider {
  readonly name: string;
  readonly apiProtocol: ApiProtocol;

  createSession(params: {
    model: string;
    messages: LLMMessage[];
    tools?: Tool[];
    systemPrompt?: string;
  }): ProviderSession;
}

interface ProviderSession {
  run(): Promise<ProviderResponse>;
  stream(fn: (chunk: string) => void): Promise<ProviderResponse>;
}

// 按协议实现
class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  readonly apiProtocol = "anthropic-messages";
  // ...
}

class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  readonly apiProtocol = "openai-responses";
  // ...
}

// 注册
const providers: Record<string, LLMProvider> = {
  anthropic: new AnthropicProvider(),
  openai: new OpenAIProvider(),
};

// 分发
function callProvider(provider: string, params: LLMRequest): Promise<LLMResponse> {
  const p = providers[provider];
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  return p.createSession(params).run();
}
```

### 13.4 相关 OpenClaw 依赖

| 库 | 版本 | 作用 |
|---|------|------|
| `@mariozechner/pi-ai` | 0.50.7 | LLM 调用核心 |
| `@mariozechner/pi-agent-core` | 0.50.7 | Agent 运行时核心 |
| `@mariozechner/pi-coding-agent` | 0.50.7 | 代码相关 Agent |
| `@mariozechner/pi-tui` | 0.50.7 | TUI 界面 |
| `@aws-sdk/client-bedrock` | ^3.980.0 | AWS Bedrock 调用 |
| `zod` | ^4.3.6 | 配置校验 |
| `@sinclair/typebox` | 0.34.48 | JSON Schema 类型 |
