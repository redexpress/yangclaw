import type { Skill, SkillEntry } from './types'

/**
 * Build SkillsSnapshot for system prompt injection
 */
export function buildSkillsSnapshot(entries: SkillEntry[]): {
  prompt: string
  skills: Array<{ name: string; description?: string }>
} {
  // Filter out disabled skills
  const available = entries.filter((e) => e.frontmatter.disabled !== 'true')

  // Format for prompt
  const prompt = formatSkillsForPrompt(available.map((e) => e.skill))

  return {
    prompt,
    skills: available.map((e) => ({
      name: e.skill.name,
      description: e.skill.description,
    })),
  }
}

/**
 * Format skills as <available_skills> XML block
 *
 * Generates:
 * <available_skills>
 *   <skill>
 *     <name>skill-name</name>
 *     <description>Skill description</description>
 *     <path>./skills/skill-name/SKILL.md</path>
 *   </skill>
 * </available_skills>
 */
export function formatSkillsForPrompt(skills: Skill[]): string {
  if (skills.length === 0) {
    return ''
  }

  const skillBlocks = skills.map((skill) => {
    const path = getRelativePath(skill.filePath)
    const description = skill.description ? escapeXml(skill.description) : ''

    return `  <skill>
    <name>${escapeXml(skill.name)}</name>${
      description ? `\n    <description>${description}</description>` : ''
    }
    <path>${escapeXml(path)}</path>
  </skill>`
  })

  return `<available_skills>\n${skillBlocks.join('\n')}\n</available_skills>`
}

/**
 * Get path relative to workspace root
 */
function getRelativePath(filePath: string): string {
  // Extract path after /skills/ directory
  const parts = filePath.split(/[/\\]/)
  const skillsIndex = parts.findIndex((p) => p === 'skills')
  if (skillsIndex >= 0 && skillsIndex < parts.length - 1) {
    return './' + parts.slice(skillsIndex).join('/')
  }
  // Fallback: return last two segments
  if (parts.length >= 2) {
    return './' + parts.slice(-2).join('/')
  }
  return filePath
}

/**
 * XML escape for safety
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
