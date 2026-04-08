import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { parseFrontmatter, extractSkillDescription } from './frontmatter'
import type { Skill, SkillEntry } from './types'

const SKILL_FILENAME = 'SKILL.md'

interface LoadSkillsOptions {
  /** Workspace root directory */
  workspaceDir: string
  /** Extra directories to scan for skills */
  extraDirs?: string[]
}

/**
 * Load all skills from workspace and extra directories
 */
export function loadSkills(options: LoadSkillsOptions): SkillEntry[] {
  const { workspaceDir, extraDirs = [] } = options

  const skills: Skill[] = []

  // 1. Scan workspace/skills/ directory
  const workspaceSkillsDir = join(workspaceDir, 'skills')
  if (existsSync(workspaceSkillsDir)) {
    const workspaceSkills = scanSkillsDir(workspaceSkillsDir, 'workspace')
    skills.push(...workspaceSkills)
  }

  // 2. Scan extra directories
  for (const dir of extraDirs) {
    if (existsSync(dir)) {
      const extraSkills = scanSkillsDir(dir, 'extra')
      skills.push(...extraSkills)
    }
  }

  // 3. Deduplicate by name
  const uniqueSkills = deduplicateByName(skills)

  // 4. Convert to SkillEntry with frontmatter
  return uniqueSkills.map((skill) => ({
    skill,
    frontmatter: loadSkillFrontmatter(skill.filePath),
  }))
}

/**
 * Scan a single skills directory
 */
function scanSkillsDir(dir: string, source: string): Skill[] {
  const skills: Skill[] = []

  if (!existsSync(dir)) {
    return skills
  }

  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    if (entry.name === 'node_modules') continue

    const skillDir = join(dir, entry.name)
    const skillFile = join(skillDir, SKILL_FILENAME)

    if (!existsSync(skillFile)) continue

    try {
      const content = readFileSync(skillFile, 'utf-8')
      const frontmatter = parseFrontmatter(content)

      const name = frontmatter.name || entry.name
      const description = extractSkillDescription(content, frontmatter)

      skills.push({
        name,
        description,
        filePath: skillFile,
        baseDir: skillDir,
        source,
      })
    } catch {
      // Skip files that can't be read
    }
  }

  return skills
}

/**
 * Load SKILL.md frontmatter
 */
function loadSkillFrontmatter(filePath: string): Record<string, string> {
  try {
    const content = readFileSync(filePath, 'utf-8')
    return parseFrontmatter(content)
  } catch {
    return {}
  }
}

/**
 * Deduplicate skills by name
 */
function deduplicateByName(skills: Skill[]): Skill[] {
  const seen = new Map<string, Skill>()
  for (const skill of skills) {
    if (!seen.has(skill.name)) {
      seen.set(skill.name, skill)
    }
  }
  return Array.from(seen.values())
}
