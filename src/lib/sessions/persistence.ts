import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { getWorkspaceDir } from '@/lib/config/load-yangclaw'

// Persistence directory: from workspace config
const SESSION_DIR = resolve(getWorkspaceDir(), 'sessions')

// Index file path
const INDEX_FILE = resolve(SESSION_DIR, 'sessions.json')

// Index data structure
interface SessionIndex {
  sessions: Record<string, {
    filename: string
    createdAt: number
    updatedAt: number
    title: string
    preview: string
    messageCount: number
  }>
}

/**
 * Ensure directory exists
 */
function ensureDir(): void {
  if (!existsSync(SESSION_DIR)) {
    mkdirSync(SESSION_DIR, { recursive: true })
  }
}

/**
 * Generate timestamp-based filename
 */
function generateSessionFilename(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 10)
  return `${year}-${month}-${day}_${hours}${minutes}_${rand}.json`
}

/**
 * Load index file
 */
function loadIndex(): SessionIndex {
  ensureDir()
  if (!existsSync(INDEX_FILE)) {
    return { sessions: {} }
  }
  try {
    const content = readFileSync(INDEX_FILE, 'utf-8')
    return JSON.parse(content) as SessionIndex
  } catch {
    return { sessions: {} }
  }
}

/**
 * Save index file
 */
function saveIndex(index: SessionIndex): void {
  ensureDir()
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8')
}

/**
 * Get session file path by key (via index)
 */
function getSessionPath(key: string): string | null {
  const index = loadIndex()
  const entry = index.sessions[key]
  if (!entry) return null
  return resolve(SESSION_DIR, entry.filename)
}

/**
 * Save session to disk
 */
export function saveSession(
  key: string,
  data: unknown,
  metadata?: { title?: string; preview?: string; messageCount?: number }
): void {
  ensureDir()
  const index = loadIndex()
  const now = Date.now()

  let filename: string
  if (index.sessions[key]) {
    // Existing, use original filename
    filename = index.sessions[key].filename
    index.sessions[key].updatedAt = now
    if (metadata?.title) index.sessions[key].title = metadata.title
    if (metadata?.preview) index.sessions[key].preview = metadata.preview
    if (metadata?.messageCount !== undefined) index.sessions[key].messageCount = metadata.messageCount
  } else {
    // New session, generate new filename
    filename = generateSessionFilename()
    index.sessions[key] = {
      filename,
      createdAt: now,
      updatedAt: now,
      title: metadata?.title || '',
      preview: metadata?.preview || '',
      messageCount: metadata?.messageCount || 0,
    }
  }

  const path = resolve(SESSION_DIR, filename)
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  saveIndex(index)
}

/**
 * Load session from disk
 */
export function loadSession(key: string): unknown | null {
  const path = getSessionPath(key)
  if (!path || !existsSync(path)) {
    return null
  }
  const content = readFileSync(path, 'utf-8')
  return JSON.parse(content)
}

/**
 * Delete session file from disk
 */
export function deleteSessionFile(key: string): boolean {
  const index = loadIndex()
  const entry = index.sessions[key]
  if (!entry) return false

  const path = resolve(SESSION_DIR, entry.filename)
  if (existsSync(path)) {
    unlinkSync(path)
  }

  delete index.sessions[key]
  saveIndex(index)
  return true
}

/**
 * List all session keys (from index)
 */
export function listSessionFiles(): string[] {
  const index = loadIndex()
  return Object.keys(index.sessions)
}

/**
 * Get index info
 */
export function getSessionIndex(): SessionIndex {
  return loadIndex()
}

/**
 * Check if filename is legacy format (agent_main_web_dm_user1.json)
 * For migration: read-only, don't modify old files
 */
function isLegacyFilename(filename: string): boolean {
  return !/\d{4}-\d{2}-\d{2}_\d{4}/.test(filename)
}

/**
 * List all session files (including legacy)
 */
export function listAllSessionFiles(): string[] {
  ensureDir()
  const files = readdirSync(SESSION_DIR)
  return files
    .filter(f => f.endsWith('.json') && f !== 'sessions.json')
    .map(f => resolve(SESSION_DIR, f))
}
