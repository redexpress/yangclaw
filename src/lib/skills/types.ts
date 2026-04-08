/**
 * Skill entry - represents a single skill
 */
export interface Skill {
  /** Unique skill name */
  name: string
  /** Skill description */
  description?: string
  /** Path to SKILL.md file */
  filePath: string
  /** Skill directory path */
  baseDir: string
  /** Source for debugging */
  source?: string
}

/**
 * Parsed skill entry with frontmatter
 */
export interface SkillEntry {
  skill: Skill
  /** Raw frontmatter from SKILL.md */
  frontmatter: Record<string, string>
}

/**
 * Skills Snapshot - for injection into System Prompt
 */
export interface SkillsSnapshot {
  /** Formatted skills list as prompt text */
  prompt: string
  /** All skill names and descriptions */
  skills: Array<{ name: string; description?: string }>
}
