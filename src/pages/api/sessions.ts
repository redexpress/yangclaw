import type { NextApiRequest, NextApiResponse } from 'next'
import { sessionStore as store, type SessionSummary } from '@/lib/sessions/store'

export type SessionListResponse = {
  sessions: SessionSummary[]
}

export type SessionMessagesResponse = {
  key: string
  messages: Array<{
    role: string
    content: string
    timestamp: number
  }>
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SessionListResponse | SessionMessagesResponse | { error: string } | { ok: boolean }>
) {
  if (req.method === 'POST') {
    const { key, role, content } = req.body as { key?: string; role?: string; content?: string }
    if (!key || !role || !content) {
      res.status(400).json({ error: 'key, role, content required' })
      return
    }
    store.addMessage(key, role as 'user' | 'assistant', content)
    res.json({ ok: true })
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { searchParams } = new URL(req.url!, 'http://localhost')
  const key = searchParams.get('key')

  if (key) {
    // Get messages for specified session
    const messages = store.getMessages(key)
    res.json({ key, messages })
  } else {
    // List all sessions
    const sessions = store.list()
    res.json({ sessions })
  }
}
