import { vi } from 'vitest'

type CommandOutput = {
  code: number
  stdout: string
  stderr: string
}

type SpawnedChild = {
  write: (data: string) => Promise<void>
  kill: () => Promise<void>
  pid: number
}

// Store for configuring mock command outputs
const commandOutputs = new Map<string, CommandOutput>()
const commandPatterns: Array<{ pattern: RegExp; output: CommandOutput }> = []

export const mockShell = {
  /**
   * Configure output for a specific command
   */
  setCommandOutput: (command: string, output: Partial<CommandOutput>) => {
    commandOutputs.set(command, {
      code: output.code ?? 0,
      stdout: output.stdout ?? '',
      stderr: output.stderr ?? '',
    })
  },

  /**
   * Configure output for commands matching a pattern
   */
  setCommandPattern: (pattern: RegExp, output: Partial<CommandOutput>) => {
    commandPatterns.push({
      pattern,
      output: {
        code: output.code ?? 0,
        stdout: output.stdout ?? '',
        stderr: output.stderr ?? '',
      },
    })
  },

  /**
   * Clear all configured outputs
   */
  clear: () => {
    commandOutputs.clear()
    commandPatterns.length = 0
  },

  /**
   * Get the call history
   */
  getCalls: () => executeHistory,
}

// Track all execute calls for assertions
const executeHistory: Array<{ program: string; args: string[] }> = []

const createMockCommand = (program: string, args: string[] = []) => {
  const execute = vi.fn(async (): Promise<CommandOutput> => {
    executeHistory.push({ program, args })

    // Check exact command match first
    const commandKey = `${program} ${args.join(' ')}`.trim()
    const exactMatch = commandOutputs.get(commandKey)
    if (exactMatch) {
      return exactMatch
    }

    // Check program-only match
    const programMatch = commandOutputs.get(program)
    if (programMatch) {
      return programMatch
    }

    // Check patterns
    for (const { pattern, output } of commandPatterns) {
      if (pattern.test(commandKey)) {
        return output
      }
    }

    // Default success response
    return { code: 0, stdout: '', stderr: '' }
  })

  const spawn = vi.fn(async (): Promise<SpawnedChild> => {
    executeHistory.push({ program, args })
    return {
      write: vi.fn(async () => {}),
      kill: vi.fn(async () => {}),
      pid: Math.floor(Math.random() * 10000),
    }
  })

  return {
    execute,
    spawn,
  }
}

export const Command = {
  create: vi.fn((program: string, args?: string | string[]) => {
    const argsArray = args === undefined ? [] : Array.isArray(args) ? args : [args]
    return createMockCommand(program, argsArray)
  }),
}

// Reset function for use in beforeEach
export const resetMocks = () => {
  commandOutputs.clear()
  commandPatterns.length = 0
  executeHistory.length = 0
  Command.create.mockClear()
}
