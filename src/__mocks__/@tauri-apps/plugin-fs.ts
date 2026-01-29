import { vi } from 'vitest'

// In-memory file system for testing
const fileSystem = new Map<string, string>()

// Base directories mapping
const baseDirs: Record<string, string> = {
  AppData: '/mock/app/data',
  Home: '/mock/home',
  Document: '/mock/documents',
  Desktop: '/mock/desktop',
  Download: '/mock/downloads',
}

export const BaseDirectory = {
  AppData: 'AppData',
  Home: 'Home',
  Document: 'Document',
  Desktop: 'Desktop',
  Download: 'Download',
} as const

type BaseDirectoryValue = (typeof BaseDirectory)[keyof typeof BaseDirectory]

interface FsOptions {
  baseDir?: BaseDirectoryValue
}

/**
 * Resolve path with optional baseDir
 */
function resolvePath(path: string, options?: FsOptions): string {
  if (options?.baseDir && baseDirs[options.baseDir]) {
    const base = baseDirs[options.baseDir]
    // Handle empty path or path that doesn't start with /
    if (!path || path === '') {
      return base
    }
    return path.startsWith('/') ? path : `${base}/${path}`
  }
  return path
}

export const mockFs = {
  /**
   * Set a file's content in the mock file system
   */
  setFile: (path: string, content: string) => {
    fileSystem.set(path, content)
  },

  /**
   * Set a file using baseDir resolution (simulates Tauri's behavior)
   */
  setFileWithBaseDir: (path: string, baseDir: BaseDirectoryValue, content: string) => {
    const resolvedPath = resolvePath(path, { baseDir })
    fileSystem.set(resolvedPath, content)
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

export const readTextFile = vi.fn(async (path: string, options?: FsOptions) => {
  const resolvedPath = resolvePath(path, options)
  const content = fileSystem.get(resolvedPath)
  if (content === undefined) {
    throw new Error(`File not found: ${resolvedPath}`)
  }
  return content
})

export const writeTextFile = vi.fn(async (path: string, content: string, options?: FsOptions) => {
  const resolvedPath = resolvePath(path, options)
  fileSystem.set(resolvedPath, content)
})

export const exists = vi.fn(async (path: string, options?: FsOptions) => {
  const resolvedPath = resolvePath(path, options)
  return fileSystem.has(resolvedPath)
})

export const mkdir = vi.fn(async (_path: string, _options?: { recursive?: boolean; baseDir?: BaseDirectoryValue }) => {
  // No-op for mock - directories aren't tracked
})

export const readDir = vi.fn(async (path: string, options?: FsOptions) => {
  const resolvedPath = resolvePath(path, options)
  const entries: Array<{ name: string; isDirectory: boolean; isFile: boolean }> = []
  for (const filePath of fileSystem.keys()) {
    if (filePath.startsWith(resolvedPath + '/')) {
      const relativePath = filePath.slice(resolvedPath.length + 1)
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

export const remove = vi.fn(async (path: string, _options?: { recursive?: boolean }) => {
  fileSystem.delete(path)
})

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
