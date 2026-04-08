import { FeishuMessagePayload, ParsedFeishuMessage } from './types'

/**
 * Parse Feishu message
 *
 * Only handles text messages, other types (images, files, etc.) return null
 */
export function parseFeishuMessage(body: any): ParsedFeishuMessage | null {
  const event = body?.event
  if (!event?.message) {
    return null
  }

  const message = event.message

  if (message.message_type !== 'text') {
    return null
  }

  let content: { text?: string }
  try {
    content = JSON.parse(message.content)
  } catch {
    return null
  }

  if (!content.text) {
    return null
  }

  return {
    senderId: event.sender.sender_id.open_id,
    chatId: message.chat_id,
    text: content.text,
    messageId: message.message_id
  }
}
