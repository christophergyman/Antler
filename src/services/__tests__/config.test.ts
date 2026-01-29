import { describe, it, expect, beforeEach } from 'vitest'
import { mockFs, BaseDirectory } from '../../__mocks__/@tauri-apps/plugin-fs'
import { mockShell } from '../../__mocks__/@tauri-apps/plugin-shell'
import {
  loadConfig,
  saveConfig,
  getCachedConfig,
  clearConfigCache,
} from '../config'

describe('Config Service', () => {
  beforeEach(() => {
    mockFs.clear()
    mockShell.clear()
    clearConfigCache() // Clear cache between tests
  })

  describe('Repository Validation (via loadConfig)', () => {
    it('accepts valid repository format (owner/repo)', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.github.repository).toBe('owner/repo')
      }
    })

    it('accepts repository with numbers and special chars', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: org-name_123/repo.name-456
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.github.repository).toBe('org-name_123/repo.name-456')
      }
    })

    it('rejects repository without owner', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: repo-only
`)
      const result = await loadConfig()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_invalid')
        expect(result.error.message).toContain('Invalid repository format')
      }
    })

    it('rejects repository with spaces', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: "owner / repo"
`)
      const result = await loadConfig()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_invalid')
      }
    })

    it('rejects empty repository', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: ""
`)
      const result = await loadConfig()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_invalid')
      }
    })
  })

  describe('Terminal Settings Validation', () => {
    it('accepts terminal settings with app only', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
terminal:
  app: iTerm
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.terminal?.app).toBe('iTerm')
        expect(result.value.terminal?.postOpenCommand).toBeUndefined()
      }
    })

    it('accepts terminal settings with postOpenCommand only', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
terminal:
  postOpenCommand: bun run dev
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.terminal?.postOpenCommand).toBe('bun run dev')
      }
    })

    it('accepts terminal settings with both app and postOpenCommand', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
terminal:
  app: /Applications/iTerm.app
  postOpenCommand: npm start
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.terminal?.app).toBe('/Applications/iTerm.app')
        expect(result.value.terminal?.postOpenCommand).toBe('npm start')
      }
    })

    it('ignores empty terminal settings', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
terminal:
  app: ""
  postOpenCommand: "  "
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.terminal).toBeUndefined()
      }
    })

    it('trims whitespace from terminal settings', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
terminal:
  app: "  iTerm  "
  postOpenCommand: "  bun run dev  "
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.terminal?.app).toBe('iTerm')
        expect(result.value.terminal?.postOpenCommand).toBe('bun run dev')
      }
    })
  })

  describe('Config Structure Validation', () => {
    it('rejects missing github section', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
terminal:
  app: iTerm
`)
      const result = await loadConfig()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_invalid')
        expect(result.error.message).toContain("Missing 'github' section")
      }
    })

    it('rejects non-object config', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `"just a string"`)
      const result = await loadConfig()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_invalid')
      }
    })

    it('handles config file not found', async () => {
      // Don't set any file - it won't exist
      const result = await loadConfig()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_not_found')
      }
    })

    it('handles invalid YAML syntax', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
  invalid yaml: [unclosed
`)
      const result = await loadConfig()

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_parse_error')
      }
    })
  })

  describe('Config Immutability', () => {
    it('returns frozen config objects', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
terminal:
  app: iTerm
`)
      const result = await loadConfig()

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(Object.isFrozen(result.value)).toBe(true)
        expect(Object.isFrozen(result.value.github)).toBe(true)
        if (result.value.terminal) {
          expect(Object.isFrozen(result.value.terminal)).toBe(true)
        }
      }
    })
  })

  describe('saveConfig', () => {
    it('saves valid config', async () => {
      const config = {
        github: { repository: 'owner/repo' as const },
        terminal: { app: 'iTerm' },
      }

      const result = await saveConfig(config)

      expect(result.ok).toBe(true)
    })

    it('validates config before saving', async () => {
      const invalidConfig = {
        github: { repository: 'invalid-repo' as const },
      }

      const result = await saveConfig(invalidConfig)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.code).toBe('config_invalid')
      }
    })
  })

  describe('Cache Management', () => {
    it('clearConfigCache clears the cache', async () => {
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: owner/repo
`)

      // Load to populate cache
      await loadConfig()

      // Clear cache
      clearConfigCache()

      // Change the file
      mockFs.setFileWithBaseDir('antler.yaml', BaseDirectory.AppData, `
github:
  repository: different/repo
`)

      // Should get new value after cache clear
      const result = await getCachedConfig()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.github.repository).toBe('different/repo')
      }
    })
  })
})
