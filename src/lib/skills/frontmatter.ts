/**
 * Parse YAML frontmatter from SKILL.md content
 * Format:
 * ---
 * name: skill_name
 * description: Skill description
 * ---
 */
export function parseFrontmatter(content: string): Record<string, string> {
  const frontmatter: Record<string, string> = {}

  if (!content.startsWith('---')) {
    return frontmatter
  }

  const endIndex = content.indexOf('\n---', 3)
  if (endIndex === -1) {
    return frontmatter
  }

  const yamlContent = content.slice(3, endIndex).trim()
  const lines = yamlContent.split('\n')

  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex === -1) continue

    const key = line.slice(0, colonIndex).trim()
    const value = line.slice(colonIndex + 1).trim()

    if (key && value) {
      frontmatter[key] = value
    }
  }

  return frontmatter
}

/**
 * Extract skill description from content
 * Priority: frontmatter.description > first ## section content
 */
export function extractSkillDescription(
  content: string,
  frontmatter: Record<string, string>,
): string | undefined {
  // Use frontmatter description if available
  if (frontmatter.description) {
    return frontmatter.description
  }

  // Extract from first ## section
  const lines = content.split('\n')
  let inDescription = false
  const descriptionLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('##')) {
      if (inDescription) break
      inDescription = true
      continue
    }
    if (inDescription && line.trim()) {
      descriptionLines.push(line.trim())
      if (descriptionLines.length >= 2) break
    }
  }

  const result = descriptionLines.join(' ').slice(0, 200)
  return result || undefined
}
