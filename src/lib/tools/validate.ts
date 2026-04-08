import type { ToolSchema, ToolParameter } from './schema'

/**
 * Validation error
 */
export class ValidationError extends Error {
  constructor(message: string, public readonly param?: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Validate arguments against schema
 */
export function validateArgs(args: unknown, schema: ToolSchema): Record<string, unknown> {
  if (typeof args !== 'object' || args === null) {
    throw new ValidationError('Arguments must be an object')
  }

  const obj = args as Record<string, unknown>
  const errors: string[] = []

  // Check required params
  for (const paramName of schema.required ?? []) {
    if (obj[paramName] === undefined) {
      errors.push(`Missing required parameter: ${paramName}`)
    }
  }

  // Validate each param
  for (const [key, value] of Object.entries(obj)) {
    const paramDef = schema.properties[key]
    if (!paramDef) {
      errors.push(`Unknown parameter: ${key}`)
      continue
    }
    const error = validateParam(value, paramDef, key)
    if (error) errors.push(error)
  }

  if (errors.length > 0) {
    throw new ValidationError(errors.join('; '))
  }

  return obj
}

function validateParam(value: unknown, def: ToolParameter, name: string): string | null {
  if (value === undefined) return null

  switch (def.type) {
    case 'string':
      if (typeof value !== 'string') return `Parameter ${name} must be a string`
      if (def.enum && !def.enum.includes(value)) {
        return `Parameter ${name} must be one of: ${def.enum.join(', ')}`
      }
      break
    case 'number':
      if (typeof value !== 'number') return `Parameter ${name} must be a number`
      break
    case 'boolean':
      if (typeof value !== 'boolean') return `Parameter ${name} must be a boolean`
      break
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return `Parameter ${name} must be an object`
      }
      break
  }

  return null
}
