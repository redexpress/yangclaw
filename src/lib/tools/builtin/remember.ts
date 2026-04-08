import type { Tool, ToolContext, ToolResult } from '../schema'

// Lazy-load dailyMemory to avoid module initialization issues
let _dailyMemory: import('../../memory/daily').DailyMemoryStore | null = null

async function getDailyMemory(): Promise<import('../../memory/daily').DailyMemoryStore> {
  if (!_dailyMemory) {
    const mod = await import('../../memory/daily')
    _dailyMemory = mod.dailyMemory
  }
  return _dailyMemory
}

/**
 * Remember tool - store important information for later recall
 */
export const rememberTool: Tool = {
  name: 'remember',
  description:
    'Store important information that should be remembered for future conversations. Use this when the user shares personal details, preferences, or any information they want you to recall later. The information will be stored in memory and retrieved automatically in future conversations.',
  schema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The information to remember. Be specific and concise.',
      },
      tags: {
        type: 'string',
        description: 'Optional comma-separated tags for categorization, e.g. "personal,name,preference"',
      },
    },
    required: ['content'],
  },

  async execute(args, context): Promise<ToolResult> {
    const content = args.content as string
    const tagsStr = args.tags as string | undefined

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return {
        success: false,
        error: 'content is required and must be a non-empty string',
        errorType: 'validation',
      }
    }

    const tags = tagsStr
      ? tagsStr.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean)
      : []

    try {
      // Append to daily markdown file
      const daily = await getDailyMemory()
      daily.append(content.trim(), tags, { sessionKey: context.sessionKey })

      return {
        success: true,
        output: `Remembered: "${content.trim()}"${tags.length ? ` [${tags.join(', ')}]` : ''}`,
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        errorType: 'execution',
      }
    }
  },
}
