/**
 * Tool policy configuration
 */
export interface ToolPolicy {
  enabled?: boolean
  requireApproval?: boolean
  permission?: 'none' | 'read' | 'write' | 'execute'
}

/**
 * Exec tool configuration
 */
export interface ExecConfig {
  allowedCommands?: string[]
  deniedCommands?: string[]
  timeoutMs?: number
  allowBackground?: boolean
  backgroundMs?: number
}

/**
 * FS tool configuration
 */
export interface FsConfig {
  workspaceOnly?: boolean
}

/**
 * Tools configuration
 */
export interface ToolsConfig {
  defaultPolicy: ToolPolicy
  policies: Record<string, Partial<ToolPolicy>>
  allowList?: string[]
  denyList?: string[]
  workspaceRoot?: string
  exec?: ExecConfig
  fs?: FsConfig
}

/**
 * Check if a tool is allowed by config
 */
export function isToolAllowed(config: ToolsConfig, toolName: string): boolean {
  // Check deny list first
  if (config.denyList?.includes(toolName)) return false

  // Check allow list (if set, only those are allowed)
  if (config.allowList && config.allowList.length > 0) {
    return config.allowList.includes(toolName)
  }

  // Check tool-specific policy
  const policy = config.policies[toolName]
  if (policy?.enabled === false) return false

  return true
}
