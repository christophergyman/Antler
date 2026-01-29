import { vi } from 'vitest'

let currentPlatform = 'darwin'

export const mockOs = {
  /**
   * Set the platform for testing
   */
  setPlatform: (platform: string) => {
    currentPlatform = platform
  },

  /**
   * Reset to default platform
   */
  reset: () => {
    currentPlatform = 'darwin'
  },
}

export const platform = vi.fn(async () => currentPlatform)

export const arch = vi.fn(async () => 'x86_64')

export const type = vi.fn(async () => 'Darwin')

export const version = vi.fn(async () => '14.0.0')

export const hostname = vi.fn(async () => 'localhost')

export const locale = vi.fn(async () => 'en-US')

// Reset function for use in beforeEach
export const resetMocks = () => {
  currentPlatform = 'darwin'
  platform.mockClear()
  arch.mockClear()
  type.mockClear()
  version.mockClear()
  hostname.mockClear()
  locale.mockClear()
}
