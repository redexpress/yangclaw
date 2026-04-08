# YangClaw

Personal AI assistant with tool calling capabilities.

## Getting Started

```bash
pnpm install
pnpm dev
```

Visit http://localhost:3000

## Setup

### 1. Copy config file

```bash
cp yangclaw.example.yaml yangclaw.yaml
```

### 2. Fill in API Key

Edit `yangclaw.yaml`, replace `YOUR_ANTHROPIC_API_KEY` placeholders with your actual API keys.

## Docker Deployment

```bash
docker build -t yangclaw .
docker run -p 3000:3000 yangclaw
```

### yangclaw.yaml Structure

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

## Features

- **Chat**: Multi-turn conversations with context memory
- **Tools**: Built-in exec, read, write tools that AI can call proactively
- **Memory**: AI actively calls `remember` tool to save important info to `memory/MEMORY.md`
- **Sessions**: Chat history persisted automatically, survives page refresh
- **Feishu**: Supports Feishu bot integration (see `src/pages/api/webhooks/feishu/route.ts`)

## Pages

- `/agent` — Main chat page
- `/test/tools` — Tool testing page

## Directory Structure

```
src/
├── lib/
│   ├── agents/       # Agent Loop
│   ├── channels/     # Channels (Feishu, etc.)
│   ├── commands/      # Command parsing (/help, /reset, etc.)
│   ├── handlers/     # Message handling
│   ├── llm/          # LLM call wrappers
│   ├── memory/       # Memory system (Markdown storage)
│   ├── routing/      # Message routing
│   ├── sessions/     # Session management
│   └── tools/        # Tool registration and execution
└── pages/
    ├── api/          # API routes
    ├── agent.tsx     # Main chat page
    └── test/tools.tsx # Tool testing
```

## Commands

- `/reset` — Clear chat history
- `/status` — View current session status
- `/new` — Start new session
- `/tools` — List available tools
- `/help` — Show help

## Architecture Notes

### Minimax baseUrl Handling

`pi-ai` SDK constructs the Anthropic API endpoint as `${baseUrl}/v1/messages`. If the config has baseUrl with trailing `/v1` (e.g., `https://api.minimaxi.com/anthropic/v1`), the URL becomes `/v1/v1/messages` causing 404.

Solution: `src/lib/tools/agent-client.ts` `toPiAiModel()` automatically strips trailing `/v1`.

