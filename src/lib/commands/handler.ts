import { sessionStore } from '../sessions/store'
import { ensureToolsRegistered, toolRegistry, executeTool } from '../tools'
import { jobStore } from '../tools/job-store'
import { sseNotifier } from '../tools/job-notifier'
import { getWorkspaceDir } from '../config/load-yangclaw'

export interface CommandResult {
  reply: string
  shouldContinue: boolean
}

export async function handleCommand(
  command: string,
  args: string,
  sessionKey: string
): Promise<CommandResult> {
  switch (command) {
    case 'reset': {
      sessionStore.delete(sessionKey)
      return {
        reply: '✓ Session reset. I no longer remember our previous conversation.',
        shouldContinue: false,
      }
    }

    case 'status': {
      const session = sessionStore.get(sessionKey)
      const msgCount = session?.messages.length ?? 0
      const updatedAt = session?.updatedAt
        ? new Date(session.updatedAt).toLocaleString()
        : 'never'

      return {
        reply: `📊 Session Status\nKey: ${sessionKey}\nMessages: ${msgCount}\nLast updated: ${updatedAt}`,
        shouldContinue: false,
      }
    }

    case 'new': {
      sessionStore.delete(sessionKey)
      return {
        reply: '✨ New chat started. What would you like to talk about?',
        shouldContinue: false,
      }
    }

    case 'help': {
      return {
        reply: `📖 Available commands:

/reset - Clear chat history, start fresh
/status - View current session status
/new - Start a new chat
/tools - List available tools
/tools exec {"command":"ls"} - Execute a tool
/help - Show this help

You can also just chat normally, I will remember the context.`,
        shouldContinue: false,
      }
    }

    case 'tools': {
      ensureToolsRegistered()

      // No args: list all tools
      if (!args.trim()) {
        const tools = toolRegistry.getToolList()
        const list = tools
          .map((t) => `• **${t.name}**: ${t.description}`)
          .join('\n')
        return {
          reply: `🔧 Available tools (${tools.length}):\n\n${list}`,
          shouldContinue: false,
        }
      }

      // Parse tool call: /tools exec {"command":"ls"}
      // Everything after tool name is JSON args
      const trimmed = args.trim()
      const spaceIdx = trimmed.indexOf(' ')
      if (spaceIdx < 0) {
        return {
          reply: `Usage: /tools <tool-name> <JSON-args>\nExample: /tools exec {"command":"ls"}`,
          shouldContinue: false,
        }
      }

      const toolName = trimmed.slice(0, spaceIdx)
      const argJson = trimmed.slice(spaceIdx + 1)

      const tool = toolRegistry.get(toolName)
      if (!tool) {
        return {
          reply: `Tool not found: ${toolName}\nAvailable: ${toolRegistry.getAll().map((t) => t.name).join(', ')}`,
          shouldContinue: false,
        }
      }

      let parsedArgs: Record<string, unknown>
      try {
        parsedArgs = JSON.parse(argJson)
      } catch {
        return { reply: 'JSON argument parse failed', shouldContinue: false }
      }

      const workspaceDir = getWorkspaceDir()
      const context = {
        sessionKey,
        workspaceDir,
        senderId: sessionKey.split(':').pop() ?? '',
        channel: sessionKey.split(':')[1] ?? 'web',
        jobStore,
        notifier: sseNotifier,
      }

      const result = await executeTool({ tool, args: parsedArgs, context })
      if (result.success) {
        return { reply: result.output ?? '(no output)', shouldContinue: false }
      } else {
        return { reply: `❌ ${result.error}`, shouldContinue: false }
      }
    }

    default: {
      return {
        reply: `Unknown command: /${command}\n\nType /help to see available commands.`,
        shouldContinue: false,
      }
    }
  }
}
