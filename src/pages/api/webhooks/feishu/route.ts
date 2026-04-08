import {
  handleFeishuChallenge,
  verifyFeishuSignature,
  parseFeishuMessage,
  sendFeishuMessage,
  getFeishuAccessToken
} from '@/lib/channels/feishu'
import { routeMessage } from '@/lib/routing/router'
import { parseCommand } from '@/lib/commands/parser'
import { handleCommand } from '@/lib/commands/handler'
import { runAgentLoop } from '@/lib/agents/loop'

const FEISHU_APP_ID = process.env.FEISHU_APP_ID ?? ''
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET ?? ''

/**
 * GET: Feishu event subscription verification
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const result = handleFeishuChallenge({
    challenge: searchParams.get('challenge') ?? undefined,
    token: searchParams.get('token') ?? undefined,
    type: searchParams.get('type') ?? undefined
  })

  if (result) {
    return result
  }

  return Response.json({ error: 'Invalid GET request' }, { status: 400 })
}

/**
 * POST: Receive Feishu message
 */
export async function POST(request: Request) {
  const body = await request.text()
  const timestamp = request.headers.get('x-lark-timestamp') ?? ''
  const sign = request.headers.get('x-lark-signature') ?? ''

  // 1. Verify signature
  if (!verifyFeishuSignature(body, timestamp, sign, FEISHU_APP_SECRET)) {
    console.error('[Feishu] Signature verification failed')
    return Response.json({ error: 'Signature mismatch' }, { status: 401 })
  }

  // 2. Parse message
  const parsed = parseFeishuMessage(JSON.parse(body))
  if (!parsed) {
    return Response.json({ message: 'ok' })
  }

  const { senderId, chatId, text } = parsed

  // 3. Route
  const route = routeMessage({
    channel: 'feishu',
    peer: { kind: 'dm', id: chatId },
    sender: senderId,
    text,
    timestamp: Date.now()
  })

  // 4. Get access token
  const token = await getFeishuAccessToken(FEISHU_APP_ID, FEISHU_APP_SECRET)

  // 5. Handle command
  const parsedCmd = parseCommand(text)
  if (parsedCmd.isCommand) {
    const result = await handleCommand(parsedCmd.command!, parsedCmd.args ?? '', route.sessionKey)
    await sendFeishuMessage(chatId, result.reply, token)
    return Response.json({ message: 'ok' })
  }

  // 6. Run AI
  const aiResult = await runAgentLoop({
    sessionKey: route.sessionKey,
    userMessage: text,
    senderId,
    channel: 'feishu'
  })

  // 7. Send AI reply
  await sendFeishuMessage(chatId, aiResult.reply, token)

  return Response.json({ message: 'ok' })
}
