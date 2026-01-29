import { vi } from 'vitest'

// In-memory file system for testing
const fileSystem = new Map<string, string>()

export const mockFs = {
  /**
   * Set a file's content in the mock file system
   */
  setFile: (path: string, content: string) => {
    fileSystem.set(path, content)
  },

  /**
   * Remove a file from the mock file system
   */
  removeFile: (path: string) => {
    fileSystem.delete(path)
  },

  /**
   * Clear all files from the mock file system
   */
  clear: () => {
    fileSystem.clear()
  },

  /**
   * Get all files in the mock file system (for debugging)
   */
  getFiles: () => new Map(fileSystem),
}

export const readTextFile = vi.fn(async (path: string) => {
  const content = fileSystem.get(path)
  if (content === undefined) {
    throw new Error(`File not found: ${path}`)
  }
  return content
})

export const writeTextFile = vi.fn(async (path: string, content: string) => {
  fileSystem.set(path, content)
})

export const exists = vi.fn(async (path: string) => {
  return fileSystem.has(path)
})

export const mkdir = vi.fn(async (_path: string, _options?: { recursive?: boolean }) => {
  // No-op for mock - directories aren't tracked
})

export const readDir = vi.fn(async (path: string) => {
  const entries: Array<{ name: string; isDirectory: boolean; isFile: boolean }> = []
  for (const filePath of fileSystem.keys()) {
    if (filePath.startsWith(path + '/')) {
      const relativePath = filePath.slice(path.length + 1)
      const parts = relativePath.split('/')
      if (parts.length === 1 && parts[0]) {
        entries.push({
          name: parts[0],
          isDirectory: false,
          isFile: true,
        })
      }
    }
  }
  return entries
})

export const remove = vi.fn(async (path: string) => {
  fileSystem.delete(path)
})

export const BaseDirectory = {
  AppData: 'AppData',
  Home: 'Home',
  Document: 'Document',
  Desktop: 'Desktop',
  Download: 'Download',
} as const

// Reset function for use in beforeEach
export const resetMocks = () => {
  fileSystem.clear()
  readTextFile.mockClear()
  writeTextFile.mockClear()
  exists.mockClear()
  mkdir.mockClear()
  readDir.mockClear()
  remove.mockClear()
}
