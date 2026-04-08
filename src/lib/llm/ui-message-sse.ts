import type { NextApiResponse } from 'next'

export function writeSseData(res: NextApiResponse, payload: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export function setAiUiStreamHeaders(res: NextApiResponse) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('x-vercel-ai-ui-message-stream', 'v1')
}
