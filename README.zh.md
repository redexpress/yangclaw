# YangClaw

个人 AI 助手，支持工具调用。

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a>
</p>

## 开始使用

```bash
pnpm install
pnpm dev
```

访问 http://localhost:3000

## 配置

### 1. 复制配置文件

```bash
cp yangclaw.example.yaml yangclaw.yaml
```

### 2. 填入 API Key

编辑 `yangclaw.yaml`，将 `YOUR_ANTHROPIC_API_KEY` 等占位符替换为你的实际 API Key。

## Docker 部署

```bash
docker build -t yangclaw .
docker run -p 3000:3000 yangclaw
```

### yangclaw.yaml 结构

```yaml
models:
  mode: merge          # merge: merge all providers; replace: only use primary
  providers:
    provider-name:     # custom provider name
      baseUrl: ""      # API address
      api: anthropic-messages | openai-completions
      apiKey: "YOUR_API_KEY"  # direct API key
      models:
        - id: ""       # model ID
          name: ""     # display name
          reasoning: true | false  # supports reasoning
          input: [text]
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }
          contextWindow: 200000
          maxTokens: 8192

agents:
  defaults:
    model:
      primary: provider/model-id   # primary model
      fallbacks:                  # fallback models
        - provider/model-id

workspace: .data   # data storage directory
```

## 功能

- **对话**：支持多轮对话，AI 记住上下文
- **工具**：内置 exec、read、write 等工具，AI 可主动调用
- **记忆**：AI 主动调用 `remember` 工具保存重要信息到 `memory/MEMORY.md`
- **会话**：会话历史自动持久化，切换页面不丢失
- **飞书**：支持接入飞书机器人（见 `src/pages/api/webhooks/feishu/route.ts`）

## 页面

- `/agent` — 主对话页面
- `/test/tools` — 工具测试页面

## 目录结构

```
src/
├── lib/
│   ├── agents/       # Agent Loop
│   ├── channels/     # 渠道（飞书等）
│   ├── commands/      # 命令解析（/help, /reset 等）
│   ├── handlers/     # 消息处理
│   ├── llm/          # LLM 调用封装
│   ├── memory/       # 记忆系统（Markdown 存储）
│   ├── routing/      # 消息路由
│   ├── sessions/     # 会话管理
│   └── tools/        # 工具注册与执行
└── pages/
    ├── api/          # API 路由
    ├── agent.tsx     # 主聊天页面
    └── test/tools.tsx # 工具测试
```

## 命令

- `/reset` — 清空会话历史
- `/status` — 查看当前会话状态
- `/new` — 开始新会话
- `/tools` — 列出可用工具
- `/help` — 显示帮助

## 架构笔记

### Minimax baseUrl 处理

`pi-ai` SDK 会把 baseUrl 拼接成 `${baseUrl}/v1/messages`。如果配置中 baseUrl 带了 `/v1`（如 `https://api.minimaxi.com/anthropic/v1`），就会变成 `/v1/v1/messages` 导致 404。

解决：在 `src/lib/tools/agent-client.ts` 的 `toPiAiModel()` 中，会自动去掉末尾的 `/v1`。

