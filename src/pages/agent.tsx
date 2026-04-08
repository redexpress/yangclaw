'use client'

import { useChat, type UIMessage } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
} from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import styles from './agent.module.scss'

// ============ Types ============

type SessionSummary = {
  key: string
  title: string
  preview: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

type UIMessageInput = {
  role: 'user' | 'assistant'
  parts: Array<{ type: 'text'; text: string }>
}

// ============ Helpers ============

function buildNewSessionKey(): string {
  return `agent:main:web:dm:${crypto.randomUUID()}`
}

function textFromMessage(m: UIMessage): string {
  if (!m.parts?.length) return ''
  return m.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('')
}

function reasoningFromMessage(m: UIMessage): string {
  if (!m.parts?.length) return ''
  return m.parts
    .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
    .map((p) => p.text)
    .join('')
}

function isReasoningStreaming(m: UIMessage): boolean {
  return (
    m.parts?.some((p) => p.type === 'reasoning' && p.state === 'streaming') ?? false
  )
}

function messagesToUIMessages(
  messages: Array<{ role: string; content: string; timestamp: number }>
): UIMessageInput[] {
  return messages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    parts: [{ type: 'text' as const, text: m.content }],
  }))
}

// ============ SessionSidebar ============

function SessionSidebar({
  sessions,
  currentKey,
  onSelect,
  onNew,
}: {
  sessions: SessionSummary[]
  currentKey: string | null
  onSelect: (key: string) => void
  onNew: () => void
}) {
  return (
    <div className={styles.sidebar}>
      <div className={styles.sidebarHeader}>
        <button className={styles.newChatBtn} onClick={onNew}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Chat
        </button>
      </div>
      <div className={styles.sessionList}>
        {sessions.length === 0 ? (
          <div className={styles.emptySessions}>No sessions yet</div>
        ) : (
          sessions.map((s) => (
            <button
              key={s.key}
              className={styles.sessionItem}
              data-active={s.key === currentKey}
              onClick={() => onSelect(s.key)}
            >
              <div className={styles.sessionTitle}>{s.title || 'New Chat'}</div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ============ CodeBlock Copy ============

async function copyPlainToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-9999px'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

function MarkdownPreWithCopy({ children, ...rest }: ComponentPropsWithoutRef<'pre'>) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    const pre = preRef.current
    if (!pre) return
    const code = pre.querySelector('code')
    const text = code?.textContent ?? pre.textContent ?? ''
    const ok = await copyPlainToClipboard(text)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className={styles.codeBlockWrap}>
      <button
        type="button"
        className={styles.codeCopyBtn}
        onClick={() => void copy()}
        aria-label={copied ? 'Copied' : 'Copy code'}
        title={copied ? 'Copied' : 'Copy'}
      >
        <img
          src={copied ? '/icons/copy-done.svg' : '/icons/copy.svg'}
          alt=""
          width={18}
          height={18}
          className={styles.codeCopyIcon}
        />
      </button>
      <pre ref={preRef} {...rest}>
        {children}
      </pre>
    </div>
  )
}

function AssistantReplyMarkdownCopy({ markdown }: { markdown: string }) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    const ok = await copyPlainToClipboard(markdown)
    if (ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    }
  }

  if (!markdown.trim()) return null

  return (
    <div className={styles.replyCopyRow}>
      <button
        type="button"
        className={styles.replyCopyBtn}
        onClick={() => void onCopy()}
        aria-label={copied ? 'Copied Markdown' : 'Copy full Markdown'}
        title={copied ? 'Copied' : 'Copy Markdown source'}
      >
        <img
          src={copied ? '/icons/copy-done.svg' : '/icons/copy.svg'}
          alt=""
          width={18}
          height={18}
          className={styles.replyCopyIcon}
        />
        <span className={styles.replyCopyLabel}>{copied ? 'Copied' : 'Copy Markdown'}</span>
      </button>
    </div>
  )
}

// ============ Message Components ============

function ChatAssistantBody({ message, live }: { message: UIMessage; live: boolean }) {
  const reasoning = reasoningFromMessage(message)
  const text = textFromMessage(message)
  const reasoningBusy = live && isReasoningStreaming(message)

  // Empty response - show error
  if (!text && !reasoning) {
    return (
      <div className={styles.emptyAssistantError} role="alert">
        AI error: empty response, please retry
      </div>
    )
  }

  return (
    <>
      {reasoning ? (
        <details
          className={styles.thinking}
          {...{ defaultOpen: true }}
          data-streaming={reasoningBusy ? 'true' : undefined}
        >
          <summary className={styles.thinkingSummary}>Thinking</summary>
          <pre className={styles.thinkingContent}>{reasoning}</pre>
        </details>
      ) : null}
      {text ? (
        <div className={styles.markdownBody}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              pre: MarkdownPreWithCopy,
              a: ({ href, children, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {text}
          </ReactMarkdown>
        </div>
      ) : null}
      <AssistantReplyMarkdownCopy markdown={text} />
    </>
  )
}

function ChatMessageBody({
  message,
  liveAssistant,
}: {
  message: UIMessage
  liveAssistant: boolean
}) {
  if (message.role !== 'assistant') {
    return <p className={styles.messageParagraph}>{textFromMessage(message)}</p>
  }
  return <ChatAssistantBody message={message} live={liveAssistant} />
}

// ============ Model Picker Types ============

type CatalogModel = {
  id: string
  name: string
  provider: string
  reasoning: boolean
  input: Array<'text' | 'image'>
}

type ModelsApiResponse = {
  mode: 'env' | 'yaml'
  models: CatalogModel[]
  defaultModel: string | null
}

// ============ Main Component ============

export default function Chata() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [currentSessionKey, setCurrentSessionKey] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [catalog, setCatalog] = useState<CatalogModel[]>([])
  const [modelPickerMode, setModelPickerMode] = useState<'env' | 'yaml'>('env')
  const [selectedModel, setSelectedModel] = useState('')
  const selectedModelRef = useRef('')
  selectedModelRef.current = selectedModel
  const sessionKeyRef = useRef<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ============ Load sessions on mount ============
  useEffect(() => {
    void fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      const data = await res.json() as { sessions: SessionSummary[] }
      setSessions(data.sessions)
      if (data.sessions.length > 0 && !currentSessionKey) {
        const RECENT_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours
        const mostRecent = data.sessions[0]
        if (Date.now() - mostRecent.updatedAt < RECENT_THRESHOLD_MS) {
          // Auto-select only if updated within 2 hours
          setCurrentSessionKey(mostRecent.key)
        } else {
          // Session stale, start a real new session immediately
          const newKey = buildNewSessionKey()
          setCurrentSessionKey(newKey)
          setSessions(prev => [{
            key: newKey,
            title: 'New Chat',
            preview: '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: 0,
          }, ...prev])
        }
      }
      // If no sessions or most recent is stale, user starts fresh - API creates session on first message
    } catch {
      // ignore
    }
  }

  const loadSessionMessages = useCallback(async (key: string) => {
    try {
      const res = await fetch(`/api/sessions?key=${encodeURIComponent(key)}`)
      const data = await res.json() as { key: string; messages: Array<{ role: string; content: string; timestamp: number }> }
      // Ignore if session changed while loading
      if (key !== currentSessionKey) {
        return
      }
      const uiMessages = messagesToUIMessages(data.messages)
      setMessages(uiMessages as unknown as UIMessage[])
    } catch {
      // ignore
    }
  }, [currentSessionKey])

  // ============ Load LLM models ============
  useEffect(() => {
    let cancelled = false
    void fetch('/api/llm/models')
      .then((r) => r.json() as Promise<ModelsApiResponse>)
      .then((data) => {
        if (cancelled) return
        setModelPickerMode(data.mode)
        setCatalog(data.models)
        if (data.defaultModel) {
          setSelectedModel(data.defaultModel)
        } else if (data.models[0]) {
          setSelectedModel(data.models[0].id)
        }
      })
      .catch(() => {
        if (cancelled) return
        setModelPickerMode('env')
        setCatalog([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // ============ Transport (memoized) ============
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat-agent',
        prepareSendMessagesRequest: ({ id, messages, body, trigger, messageId }) => ({
          body: {
            ...(body ?? {}),
            id,
            messages,
            trigger,
            messageId,
            sessionKey: sessionKeyRef.current,
            ...(selectedModelRef.current ? { model: selectedModelRef.current } : {}),
          },
        }),
      }),
    []
  )

  const { messages, setMessages, sendMessage, status, error, stop } = useChat({
    id: 'agent',
    transport,
  })

  // ============ Load session messages when session changes ============
  useEffect(() => {
    if (currentSessionKey) {
      void loadSessionMessages(currentSessionKey)
    }
  }, [currentSessionKey, loadSessionMessages])

  // Keep sessionKeyRef in sync with currentSessionKey
  useEffect(() => {
    sessionKeyRef.current = currentSessionKey
  }, [currentSessionKey])

  const busy = status === 'streaming' || status === 'submitted'

  // Track previous busy state to detect transition from busy→idle
  const prevBusyRef = useRef(false)

  // Save assistant messages when streaming completes (busy → idle transition)
  useEffect(() => {
    if (!currentSessionKey) return

    // Only save when transitioning from busy to not busy
    if (prevBusyRef.current && !busy) {
      // Find the latest assistant message
      const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant')
      if (!latestAssistant) return

      const text = textFromMessage(latestAssistant)
      if (!text) return

      // Save to session store
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: currentSessionKey, role: 'assistant', content: text }),
      }).catch(console.error)
    }

    prevBusyRef.current = busy
  }, [busy, currentSessionKey, messages])

  // Detect empty assistant response (computed, no state)
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTop = viewport.scrollHeight
  }, [messages])

  // ============ Session handlers ============
  const handleNewChat = useCallback(() => {
    const newKey = buildNewSessionKey()
    setCurrentSessionKey(newKey)
    setMessages([])
    // Immediately add to sessions list so sidebar shows new session
    setSessions(prev => [{
      key: newKey,
      title: 'New Chat',
      preview: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
    }, ...prev])
  }, [setMessages])

  const handleSelectSession = useCallback((key: string) => {
    setCurrentSessionKey(key)
  }, [])

  // ============ Submit handler ============
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const t = input.trim()
      if (!t || busy) return
      setInput('')
      await sendMessage({ text: t })
    },
    [input, busy, sendMessage],
  )

  return (
    <div className={styles.container}>
      <SessionSidebar
        sessions={sessions}
        currentKey={currentSessionKey}
        onSelect={handleSelectSession}
        onNew={handleNewChat}
      />
      <div className={`${styles.thread}${messages.length === 0 ? ' ' + styles.threadEmpty : ''}`}>
        <div className={`${styles.viewport}${messages.length === 0 ? ' ' + styles.viewportEmpty : ''}`} ref={viewportRef}>
          {messages.length === 0 ? (
            <div className={styles.empty}>
              <p>AI assistant with tool calling</p>
              <p>Try saying: &quot;list current directory files&quot;</p>
            </div>
          ) : (
            messages.map((m, idx) => {
              const liveAssistant =
                busy && idx === messages.length - 1 && m.role === 'assistant'
              return (
                <div
                  key={m.id}
                  className={m.role === 'user' ? styles.userMessage : styles.assistantMessage}
                >
                  <ChatMessageBody message={m} liveAssistant={liveAssistant} />
                </div>
              )
            })
          )}
          {error ? (
            <div className={styles.chatError} role="alert">
              {error.message}
            </div>
          ) : null}
        </div>
        <footer className={styles.footer}>
          <form className={styles.composer} onSubmit={onSubmit}>
            {modelPickerMode === 'yaml' && catalog.length > 0 ? (
              <label className={styles.modelRow}>
                <span className={styles.modelLabel}>Model</span>
                <select
                  className={styles.modelSelect}
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={busy}
                  aria-label="Model"
                >
                  {catalog.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.provider} / {m.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <textarea
              className={styles.input}
              placeholder="Type your message... (supports tool calling)"
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                // Auto-resize textarea
                const ta = e.target
                ta.style.height = 'auto'
                ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void onSubmit(e as unknown as React.FormEvent)
                }
              }}
              rows={1}
              ref={inputRef}
              disabled={busy}
            />
            <button type="submit" className={styles.send} disabled={busy || !input.trim()}>
              Send
            </button>
            {busy ? (
              <button type="button" className={styles.send} onClick={() => void stop()}>
                Stop
              </button>
            ) : null}
          </form>
        </footer>
      </div>
    </div>
  )
}
