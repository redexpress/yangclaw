import type { NextApiResponse } from 'next'
import type { Agent } from 'undici'
import type { ResolvedModel } from './resolve-model'
import { writeSseData } from './ui-message-sse'

type FetchFn = typeof import('undici').fetch

/** Map UI / Anthropic-like roles to OpenAI chat roles. */
function openAiMessages(
  llmMessages: Array<{ role: string; content: string }>,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return llmMessages.map((m) => {
    const r = m.role.toLowerCase()
    if (r === 'system') return { role: 'system' as const, content: m.content }
    if (r === 'assistant') return { role: 'assistant' as const, content: m.content }
    return { role: 'user' as const, content: m.content }
  })
}

export async function openaiCompletionsFetch(params: {
  resolved: ResolvedModel
  llmMessages: Array<{ role: string; content: string }>
  fetchImpl: FetchFn
  dispatcher: Agent
}): Promise<Awaited<ReturnType<FetchFn>>> {
  const { resolved, llmMessages, fetchImpl, dispatcher } = params
  const upstreamUrl = `${resolved.baseUrl}/chat/completions`
  const maxTokensField =
    resolved.model.compat?.maxTokensField === 'max_completion_tokens'
      ? 'max_completion_tokens'
      : 'max_tokens'

  const body: Record<string, unknown> = {
    model: resolved.model.id,
    messages: openAiMessages(llmMessages),
    stream: true,
    [maxTokensField]: resolved.model.maxTokens,
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${resolved.apiKey}`,
    ...(resolved.provider.headers ?? {}),
  }

  return fetchImpl(upstreamUrl, {
    method: 'POST',
    dispatcher,
    headers,
    body: JSON.stringify(body),
  })
}

export async function streamOpenAiSseToUi(params: {
  responseBody: import('stream/web').ReadableStream<Uint8Array>
  res: NextApiResponse
}): Promise<void> {
  const { responseBody, res } = params
  const reader = responseBody.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  let textOpen = false
  let reasoningOpen = false
  const textId = 'text-0'
  const reasoningId = 'reasoning-0'

  const ensureText = () => {
    if (textOpen) return
    textOpen = true
    writeSseData(res, { type: 'text-start', id: textId })
  }
  const ensureReasoning = () => {
    if (reasoningOpen) return
    reasoningOpen = true
    writeSseData(res, { type: 'reasoning-start', id: reasoningId })
  }

  writeSseData(res, { type: 'start' })

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const rawLine of lines) {
        const line = rawLine.replace(/\r$/, '')
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trimStart()
        if (data === '[DONE]') {
          if (reasoningOpen) {
            reasoningOpen = false
            writeSseData(res, { type: 'reasoning-end', id: reasoningId })
          }
          if (textOpen) {
            textOpen = false
            writeSseData(res, { type: 'text-end', id: textId })
          }
          writeSseData(res, { type: 'finish', finishReason: 'stop' })
          res.write('data: [DONE]\n\n')
          if (!res.writableEnded) res.end()
          return
        }
        let parsed: { choices?: Array<{ delta?: Record<string, unknown> }> }
        try {
          parsed = JSON.parse(data) as { choices?: Array<{ delta?: Record<string, unknown> }> }
        } catch {
          continue
        }
        const delta = parsed.choices?.[0]?.delta
        if (!delta || typeof delta !== 'object') continue

        const content = delta.content
        if (typeof content === 'string' && content.length > 0) {
          ensureText()
          writeSseData(res, { type: 'text-delta', id: textId, delta: content })
        }

        const reasoning =
          delta.reasoning_content ?? delta.reasoning ?? (delta as { thinking?: string }).thinking
        if (typeof reasoning === 'string' && reasoning.length > 0) {
          ensureReasoning()
          writeSseData(res, { type: 'reasoning-delta', id: reasoningId, delta: reasoning })
        }
      }
    }

    if (reasoningOpen) {
      reasoningOpen = false
      writeSseData(res, { type: 'reasoning-end', id: reasoningId })
    }
    if (textOpen) {
      textOpen = false
      writeSseData(res, { type: 'text-end', id: textId })
    }
    writeSseData(res, { type: 'finish', finishReason: 'stop' })
    res.write('data: [DONE]\n\n')
  } finally {
    if (!res.writableEnded) {
      res.end()
    }
  }
}
