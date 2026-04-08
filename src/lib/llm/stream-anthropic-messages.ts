import type { NextApiResponse } from 'next'
import type { Agent } from 'undici'
import type { ResolvedModel } from './resolve-model'
import { writeSseData } from './ui-message-sse'

type FetchFn = typeof import('undici').fetch

export async function streamAnthropicMessagesToUi(params: {
  responseBody: import('stream/web').ReadableStream<Uint8Array>
  res: NextApiResponse
}): Promise<void> {
  const { responseBody, res } = params
  const reader = responseBody.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const textPartId = (index: number) => `text-${index}`
  const reasoningPartId = (index: number) => `reasoning-${index}`
  const openTextBlocks = new Set<number>()
  const openReasoningBlocks = new Set<number>()
  let streamFinished = false

  const ensureTextStart = (index: number) => {
    if (openTextBlocks.has(index)) return
    openTextBlocks.add(index)
    writeSseData(res, { type: 'text-start', id: textPartId(index) })
  }

  const ensureReasoningStart = (index: number) => {
    if (openReasoningBlocks.has(index)) return
    openReasoningBlocks.add(index)
    writeSseData(res, { type: 'reasoning-start', id: reasoningPartId(index) })
  }

  writeSseData(res, { type: 'start' })

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].replace(/\r$/, '')
        if (!line.startsWith('event:')) continue

        const eventType = line.slice(6).trim()
        const nextLine = lines[i + 1]?.replace(/\r$/, '')
        if (!nextLine?.startsWith('data:')) continue

        const raw = nextLine.slice(5).trimStart()
        i++

        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(raw) as Record<string, unknown>
        } catch {
          continue
        }

        if (eventType === 'content_block_start') {
          const block = parsed.content_block as { type?: string } | undefined
          const index = typeof parsed.index === 'number' ? parsed.index : null
          if (index === null) continue
          if (block?.type === 'text') {
            ensureTextStart(index)
          } else if (block?.type === 'thinking') {
            ensureReasoningStart(index)
          }
        } else if (eventType === 'content_block_delta') {
          const delta = parsed.delta as {
            type?: string
            text?: string
            thinking?: string
          } | undefined
          const index = typeof parsed.index === 'number' ? parsed.index : null
          if (index === null) continue

          if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
            ensureReasoningStart(index)
            writeSseData(res, {
              type: 'reasoning-delta',
              id: reasoningPartId(index),
              delta: delta.thinking,
            })
          } else if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            ensureTextStart(index)
            writeSseData(res, {
              type: 'text-delta',
              id: textPartId(index),
              delta: delta.text,
            })
          }
        } else if (eventType === 'content_block_stop') {
          const index = typeof parsed.index === 'number' ? parsed.index : null
          if (index === null) continue
          if (openTextBlocks.has(index)) {
            openTextBlocks.delete(index)
            writeSseData(res, { type: 'text-end', id: textPartId(index) })
          } else if (openReasoningBlocks.has(index)) {
            openReasoningBlocks.delete(index)
            writeSseData(res, { type: 'reasoning-end', id: reasoningPartId(index) })
          }
        } else if (eventType === 'message_stop') {
          for (const index of Array.from(openReasoningBlocks)) {
            writeSseData(res, { type: 'reasoning-end', id: reasoningPartId(index) })
          }
          openReasoningBlocks.clear()
          for (const index of Array.from(openTextBlocks)) {
            writeSseData(res, { type: 'text-end', id: textPartId(index) })
          }
          openTextBlocks.clear()
          streamFinished = true
          writeSseData(res, { type: 'finish', finishReason: 'stop' })
          res.write('data: [DONE]\n\n')
        }
      }
    }

    if (!streamFinished) {
      for (const index of Array.from(openReasoningBlocks)) {
        writeSseData(res, { type: 'reasoning-end', id: reasoningPartId(index) })
      }
      openReasoningBlocks.clear()
      for (const index of Array.from(openTextBlocks)) {
        writeSseData(res, { type: 'text-end', id: textPartId(index) })
      }
      openTextBlocks.clear()
      writeSseData(res, { type: 'finish', finishReason: 'stop' })
      res.write('data: [DONE]\n\n')
    }
  } finally {
    if (!res.writableEnded) {
      res.end()
    }
  }
}

export async function anthropicMessagesFetch(params: {
  resolved: ResolvedModel
  llmMessages: Array<{ role: string; content: string }>
  maxTokens: number
  thinkingBudget: number | null
  fetchImpl: FetchFn
  dispatcher: Agent
}): Promise<Awaited<ReturnType<FetchFn>>> {
  const { resolved, llmMessages, maxTokens, thinkingBudget, fetchImpl, dispatcher } = params
  const upstreamUrl = `${resolved.baseUrl}/messages`

  const llmBody: Record<string, unknown> = {
    model: resolved.model.id,
    messages: llmMessages,
    stream: true,
    max_tokens: maxTokens,
    ...(thinkingBudget != null && {
      thinking: {
        type: 'enabled',
        budget_tokens: thinkingBudget,
      },
    }),
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': resolved.apiKey,
    'anthropic-version': '2023-06-01',
    ...(resolved.provider.headers ?? {}),
  }

  return fetchImpl(upstreamUrl, {
    method: 'POST',
    dispatcher,
    headers,
    body: JSON.stringify(llmBody),
  })
}
