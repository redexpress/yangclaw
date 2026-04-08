import { Session, SessionMessage } from './types.js'
import { saveSession, loadSession, deleteSessionFile, listSessionFiles, getSessionIndex } from './persistence'

export interface SessionSummary {
  key: string
  title: string
  preview: string
  createdAt: number
  updatedAt: number
  messageCount: number
}

export class SessionStore {
  private sessions = new Map<string, Session>()

  constructor() {
    this.loadFromDisk()
  }

  /**
   * Load all sessions from disk into memory
   */
  private loadFromDisk(): void {
    const keys = listSessionFiles()
    for (const key of keys) {
      const data = loadSession(key)
      if (data && typeof data === 'object' && (data as any).key) {
        this.sessions.set(key, data as Session)
      }
    }
    if (keys.length > 0) {
      console.log(`[Session] Loaded ${this.sessions.size} sessions from disk`)
    }
  }

  /**
   * Generate session title (first 30 chars of first user message)
   */
  private generateTitle(messages: SessionMessage[]): { title: string; preview: string } {
    const firstUserMsg = messages.find(m => m.role === 'user')
    if (!firstUserMsg) {
      return { title: 'New Chat', preview: '' }
    }
    const content = firstUserMsg.content.slice(0, 30)
    const title = content.length === firstUserMsg.content.slice(0, 30).length
      ? content
      : content + '...'
    return { title, preview: firstUserMsg.content.slice(0, 50) }
  }

  getOrCreate(key: string, metadata: Session['metadata'] = {}): Session {
    const existing = this.sessions.get(key)
    if (existing) return existing

    const session: Session = {
      id: `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata,
    }

    this.sessions.set(key, session)
    saveSession(key, session, {
      title: 'New Chat',
      preview: '',
      messageCount: 0,
    })
    return session
  }

  addMessage(key: string, role: 'user' | 'assistant', content: string): Session {
    const session = this.getOrCreate(key)
    session.messages.push({
      role,
      content,
      timestamp: Date.now(),
    })
    session.updatedAt = Date.now()

    const { title, preview } = this.generateTitle(session.messages)
    saveSession(key, session, {
      title,
      preview,
      messageCount: session.messages.length,
    })
    return session
  }

  getMessages(key: string): SessionMessage[] {
    return this.get(key)?.messages ?? []
  }

  get(key: string): Session | undefined {
    return this.sessions.get(key)
  }

  delete(key: string): boolean {
    const deleted = this.sessions.delete(key)
    if (deleted) {
      deleteSessionFile(key)
    }
    return deleted
  }

  /**
   * Return session list summary (sorted by update time descending)
   */
  list(): SessionSummary[] {
    const index = getSessionIndex()
    const entries = Object.entries(index.sessions)
      .map(([key, entry]) => ({
        key,
        title: entry.title,
        preview: entry.preview,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        messageCount: entry.messageCount,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)

    return entries
  }

  size(): number {
    return this.sessions.size
  }

  /**
   * Prune expired sessions and oversized message lists
   *
   * @param maxAgeMs - Max session age in ms (default 30 days)
   * @param maxMessages - Max messages per session (default 500)
   * @returns Number of sessions pruned
   */
  prune(maxAgeMs = 30 * 24 * 60 * 60 * 1000, maxMessages = 500): number {
    let pruned = 0
    const now = Date.now()
    const entries = Array.from(this.sessions.entries())

    for (const [key, session] of entries) {
      // Check if expired
      if (now - session.updatedAt > maxAgeMs) {
        this.sessions.delete(key)
        deleteSessionFile(key)
        pruned++
        continue
      }

      // Check message count limit
      if (session.messages.length > maxMessages) {
        // Keep only the latest maxMessages
        session.messages = session.messages.slice(-maxMessages)
        session.updatedAt = now
        const { title, preview } = this.generateTitle(session.messages)
        saveSession(key, session, {
          title,
          preview,
          messageCount: session.messages.length,
        })
        pruned++
      }
    }

    return pruned
  }
}

export const sessionStore = new SessionStore()
