import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'fs'
import { resolve } from 'path'
import { MemoryEntry } from './types'
import { getWorkspaceDir } from '@/lib/config/load-yangclaw'

// Memory storage directory: from workspace config
const MEMORY_DIR = resolve(getWorkspaceDir(), 'memory')

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

function ensureDir(): void {
  if (!existsSync(MEMORY_DIR)) {
    mkdirSync(MEMORY_DIR, { recursive: true })
  }
}

export class MemoryStore {
  private entries = new Map<string, MemoryEntry>()
  private loaded = false

  constructor() {
    ensureDir()
    this.load()
  }

  private load(): void {
    if (this.loaded) return

    const memoriesFile = resolve(MEMORY_DIR, 'memories.json')
    if (!existsSync(memoriesFile)) {
      this.loaded = true
      return
    }

    try {
      const data = JSON.parse(readFileSync(memoriesFile, 'utf-8')) as MemoryEntry[]
      for (const entry of data) {
        if (entry && entry.id) {
          this.entries.set(entry.id, entry)
        }
      }
    } catch {
      // Ignore parse errors
    }

    this.loaded = true
    console.log(`[Memory] Loaded ${this.entries.size} entries`)
  }

  private getFilePath(): string {
    return resolve(MEMORY_DIR, 'memories.json')
  }

  private persist(): void {
    const data = Array.from(this.entries.values())
    writeFileSync(this.getFilePath(), JSON.stringify(data, null, 2), 'utf-8')
  }

  add(
    content: string,
    tags: string[] = [],
    metadata?: MemoryEntry['metadata']
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: generateId(),
      content,
      tags,
      createdAt: Date.now(),
      metadata,
    }

    this.entries.set(entry.id, entry)
    this.persist()

    return entry
  }

  search(query: string, limit = 10): MemoryEntry[] {
    const q = query.toLowerCase().trim()

    if (!q) {
      return this.getRecent(limit)
    }

    const results = Array.from(this.entries.values())
      .filter(entry => {
        if (entry.content.toLowerCase().includes(q)) {
          return true
        }
        if (entry.tags.some(tag => tag.toLowerCase().includes(q))) {
          return true
        }
        return false
      })
      .sort((a, b) => b.createdAt - a.createdAt)

    return results.slice(0, limit)
  }

  searchByTag(tag: string, limit = 20): MemoryEntry[] {
    const t = tag.toLowerCase()
    return Array.from(this.entries.values())
      .filter(entry => entry.tags.some(g => g.toLowerCase() === t))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  getRecent(limit = 10): MemoryEntry[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
  }

  get(id: string): MemoryEntry | undefined {
    return this.entries.get(id)
  }

  update(id: string, updates: Partial<Pick<MemoryEntry, 'content' | 'tags'>>): boolean {
    const entry = this.entries.get(id)
    if (!entry) return false

    if (updates.content !== undefined) {
      entry.content = updates.content
    }
    if (updates.tags !== undefined) {
      entry.tags = updates.tags
    }

    this.persist()
    return true
  }

  delete(id: string): boolean {
    const deleted = this.entries.delete(id)
    if (deleted) {
      this.persist()
    }
    return deleted
  }

  getAllTags(): string[] {
    const tagSet = new Set<string>()
    const entries = Array.from(this.entries.values())
    for (const entry of entries) {
      for (const tag of entry.tags) {
        tagSet.add(tag)
      }
    }
    return Array.from(tagSet).sort()
  }

  size(): number {
    return this.entries.size
  }

  clear(): void {
    this.entries.clear()
    this.persist()
  }
}

export const memoryStore = new MemoryStore()
