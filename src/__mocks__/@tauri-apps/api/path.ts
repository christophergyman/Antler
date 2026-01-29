import { vi } from 'vitest'

let mockAppDataPath = '/mock/app/data'
let mockHomePath = '/mock/home'

export const mockPath = {
  /**
   * Set the app data directory path
   */
  setAppDataDir: (path: string) => {
    mockAppDataPath = path
  },

  /**
   * Set the home directory path
   */
  setHomeDir: (path: string) => {
    mockHomePath = path
  },

  /**
   * Reset to default paths
   */
  reset: () => {
    mockAppDataPath = '/mock/app/data'
    mockHomePath = '/mock/home'
  },
}

export const appDataDir = vi.fn(async () => mockAppDataPath)

export const homeDir = vi.fn(async () => mockHomePath)

export const join = vi.fn(async (...parts: string[]) => {
  return parts.filter(Boolean).join('/')
})

export const dirname = vi.fn(async (path: string) => {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/') || '/'
})

export const basename = vi.fn(async (path: string) => {
  const parts = path.split('/')
  return parts[parts.length - 1] || ''
})

export const resolve = vi.fn(async (...parts: string[]) => {
  return '/' + parts.filter(Boolean).join('/')
})

// Reset function for use in beforeEach
export const resetMocks = () => {
  mockAppDataPath = '/mock/app/data'
  mockHomePath = '/mock/home'
  appDataDir.mockClear()
  homeDir.mockClear()
  join.mockClear()
  dirname.mockClear()
  basename.mockClear()
  resolve.mockClear()
}
