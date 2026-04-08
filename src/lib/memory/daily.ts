import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { getWorkspaceDir } from '@/lib/config/load-yangclaw'

// Memory directory: from workspace config
const MEMORY_DIR = resolve(getWorkspaceDir(), 'memory')

/**
 * Ensure directory exists
 */
function ensureDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true })
  }
}

/**
 * Get daily filename
 */
function getDailyFilename(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}.md`
}

/**
 * Format time string from date
 */
function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

/**
 * Daily Memory Store
 * Manages daily Markdown file format memory
 */
export class DailyMemoryStore {
  /**
   * Append content to today's file
   */
  append(content: string, tags: string[], metadata?: { sessionKey?: string; channel?: string }): void {
    console.log('[dailyMemory] append called, MEMORY_DIR:', MEMORY_DIR)
    ensureDir()
    const today = new Date()
    const filename = getDailyFilename(today)
    const filepath = resolve(MEMORY_DIR, filename)
    console.log('[dailyMemory] filepath:', filepath)

    const time = formatTime(today)
    const tagStr = tags.length > 0 ? `[${tags.join(', ')}]` : ''
    const sessionInfo = metadata?.sessionKey ? `(${metadata.sessionKey.split(':').slice(2).join(':')}, ${time})` : `(${time})`

    const entry = `- ${tagStr ? `${tagStr} ` : ''}${content} ${sessionInfo}\n`

    // If file exists, append content
    if (existsSync(filepath)) {
      const existing = readFileSync(filepath, 'utf-8')
      // Check for duplicate entries
      if (existing.includes(content)) {
        return
      }
      writeFileSync(filepath, existing + entry, 'utf-8')
    } else {
      // Create new file with header
      const header = `# Memory - ${today.toISOString().slice(0, 10)}\n\n`
      writeFileSync(filepath, header + entry, 'utf-8')
    }
  }

  /**
   * Read recent N days of memory files
   */
  readRecent(days: number = 2): string {
    ensureDir()
    const results: string[] = []
    const today = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      const filename = getDailyFilename(date)
      const filepath = resolve(MEMORY_DIR, filename)

      if (existsSync(filepath)) {
        const content = readFileSync(filepath, 'utf-8')
        results.push(content)
      }
    }

    return results.join('\n\n')
  }

  /**
   * Read long-term memory file MEMORY.md
   */
  readMemories(): string {
    ensureDir()
    const filepath = resolve(MEMORY_DIR, 'MEMORY.md')

    if (!existsSync(filepath)) {
      return ''
    }

    return readFileSync(filepath, 'utf-8')
  }
}

export const dailyMemory = new DailyMemoryStore()
