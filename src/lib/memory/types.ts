export interface MemoryEntry {
  id: string
  content: string
  tags: string[]
  createdAt: number
  metadata?: {
    source?: string
    sessionKey?: string
  }
}

export interface MemorySearchResult {
  entry: MemoryEntry
  score?: number
}
