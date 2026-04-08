export interface FeishuMessagePayload {
  event: {
    sender: {
      sender_id: {
        open_id: string
      }
    }
    message: {
      chat_id: string
      message_type: string
      content: string
      message_id: string
      create_time: string
    }
  }
  schema: string
  token: string
  ts: string
  type: string
}

export interface ParsedFeishuMessage {
  senderId: string
  chatId: string
  text: string
  messageId: string
}
