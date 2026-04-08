'use client'

import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useMemo, useState } from 'react'
import styles from './ChatUI.module.scss'

function textFromMessage(m: UIMessage): string {
  if (!m.parts?.length) return ''
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

export function ChatUI() {
  const [input, setInput] = useState('')

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat2',
      }),
    [],
  )

  const chat = useChat({
    id: 'chat-legacy-ui',
    transport,
  })

  const busy = chat.status === 'streaming' || chat.status === 'submitted'

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = input.trim()
    if (!t || busy) return
    setInput('')
    void chat.sendMessage({ text: t })
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>YangClaw Chat</h1>
        <span style={{ fontSize: 12, color: '#999' }}>status: {chat.status}</span>
      </div>

      <div className={styles.messages}>
        {chat.messages.length === 0 && (
          <div className={styles.empty}>Send a message to start chatting</div>
        )}
        {chat.messages.map((msg) => (
          <div key={msg.id} className={`${styles.message} ${styles[msg.role]}`}>
            <div className={styles.role}>{msg.role === 'user' ? 'You' : 'AI'}</div>
            <div className={styles.content}>{textFromMessage(msg)}</div>
          </div>
        ))}
        {chat.error && (
          <div className={`${styles.message} ${styles.assistant}`}>
            <div className={styles.role}>AI</div>
            <div className={styles.content}>[Error: {String(chat.error.message)}]</div>
          </div>
        )}
      </div>

      <form className={styles.inputArea} onSubmit={onSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={busy}
        />
        <button type="submit" disabled={!input.trim() || busy}>
          Send
        </button>
      </form>
    </div>
  )
}
