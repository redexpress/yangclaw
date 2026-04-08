import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureToolsRegistered, toolRegistry } from '@/lib/tools'
import { buildToolContext } from '@/lib/tools/agent-adapter'
import type { ToolContext } from '@/lib/tools/schema'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureToolsRegistered()

    const { tool: toolName, args = {} } = req.body as { tool?: string; args?: Record<string, unknown> }

    if (!toolName) {
      res.status(400).json({ error: 'tool name required' })
      return
    }

    const tool = toolRegistry.get(toolName)
    if (!tool) {
      res.status(404).json({ error: `Tool not found: ${toolName}` })
      return
    }

    // Build context
    const context: ToolContext = buildToolContext({
      sessionKey: 'test-session',
      senderId: 'test-user',
      channel: 'test',
    })

    // Execute
    const result = await tool.execute(args, context)

    res.json(result)
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}