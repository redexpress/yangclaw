export interface ParsedCommand {
  isCommand: boolean
  command?: string
  args?: string
  rawText?: string
}

export function parseCommand(text: string): ParsedCommand {
  if (!text.startsWith('/')) {
    return { isCommand: false }
  }

  const rest = text.slice(1)

  const match = rest.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?:\s+(.*))?$/)

  if (!match) {
    if (rest.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      return {
        isCommand: true,
        command: rest.toLowerCase(),
        args: '',
        rawText: text,
      }
    }
    return { isCommand: false }
  }

  const [, command, args = ''] = match

  return {
    isCommand: true,
    command: command.toLowerCase(),
    args: args.trim(),
    rawText: text,
  }
}