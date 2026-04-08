import { MemoryEntry } from './types'

/**
 * Extract "remember" command from message
 * Supported formats:
 * - "remember that ..."
 * - "Remember ..."
 * - "/remember ..."
 */
export function extractRememberCommand(text: string): string | null {
  const patterns = [
    /^remember\s+(?:that\s+)?(.+)/i,
    /^\/remember\s+(.+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Extract tags from text
 * Supported formats:
 * - "remember X #work #project"
 * - "remember X [#tag1, #tag2]"
 */
export function extractTags(text: string): { content: string; tags: string[] } {
  const tags: string[] = []

  // Extract #tag format
  const hashMatches = text.match(/#[^\s]+/g)
  if (hashMatches) {
    for (const tag of hashMatches) {
      tags.push(tag.slice(1).toLowerCase())
    }
  }

  // Extract [tag1, tag2] format
  const bracketMatch = text.match(/\[([^\]]+)\]/)
  if (bracketMatch) {
    const bracketTags = bracketMatch[1].split(',').map(t => t.trim().toLowerCase())
    tags.push(...bracketTags)
  }

  // Remove tags from content
  let content = text
    .replace(/#[^\s]+/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .trim()

  return { content, tags }
}

/**
 * Build memory context snippet
 * For injection into system prompt
 */
export function buildMemoryContext(memories: MemoryEntry[]): string {
  if (memories.length === 0) {
    return ''
  }

  const lines = ['\n\n## Relevant Memories:']
  for (const mem of memories) {
    const tagStr = mem.tags.length > 0 ? ` [${mem.tags.join(', ')}]` : ''
    lines.push(`- ${mem.content}${tagStr}`)
  }

  return lines.join('\n')
}

/**
 * Process user message, check if needs to remember
 */
export function processRememberCommand(
  text: string
): { shouldRemember: boolean; content?: string; tags?: string[] } {
  const rememberContent = extractRememberCommand(text)

  if (rememberContent) {
    const { content, tags } = extractTags(rememberContent)
    return {
      shouldRemember: true,
      content,
      tags,
    }
  }

  return { shouldRemember: false }
}
