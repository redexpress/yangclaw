import type { NextApiRequest, NextApiResponse } from 'next'
import { ensureToolsRegistered, toolRegistry } from '@/lib/tools'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    await ensureToolsRegistered()
    const tools = toolRegistry.getToolList()
    res.json({ tools })
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) })
  }
}