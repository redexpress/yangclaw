import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import type { YangclawConfig } from './types.models'
import { yangclawConfigSchema, type ParsedYangclawConfig } from './yangclaw-schema'

const CONFIG_BASENAME = 'yangclaw.yaml'

export function yangclawConfigPath(cwd: string = process.cwd()): string {
  return path.join(cwd, CONFIG_BASENAME)
}

export function expandConfigValue(value: string): string {
  const m = value.match(/^\$\{([^}]+)\}$/)
  if (m) {
    const v = process.env[m[1]]?.trim()
    return v ?? ''
  }
  return value
}

/** Map parsed zod shape into strict YangclawConfig (compat typed). */
function toConfig(parsed: ParsedYangclawConfig): YangclawConfig {
  return parsed as unknown as YangclawConfig
}

export type LoadYangclawResult =
  | { ok: true; config: YangclawConfig }
  | { ok: false; reason: 'missing' | 'invalid'; detail?: string }

const DEFAULT_WORKSPACE = '.data'

export function getWorkspaceDir(cwd: string = process.cwd()): string {
  const loaded = loadYangclawFromDir(cwd)
  if (loaded.ok && loaded.config.workspace) {
    return loaded.config.workspace
  }
  return path.join(cwd, DEFAULT_WORKSPACE)
}

export function loadYangclawFromDir(cwd: string = process.cwd()): LoadYangclawResult {
  const fp = yangclawConfigPath(cwd)
  if (!fs.existsSync(fp)) {
    return { ok: false, reason: 'missing' }
  }
  let raw: unknown
  try {
    raw = YAML.parse(fs.readFileSync(fp, 'utf8'))
  } catch (e) {
    return {
      ok: false,
      reason: 'invalid',
      detail: e instanceof Error ? e.message : String(e),
    }
  }
  const parsed = yangclawConfigSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      ok: false,
      reason: 'invalid',
      detail: parsed.error.message,
    }
  }
  return { ok: true, config: toConfig(parsed.data) }
}
