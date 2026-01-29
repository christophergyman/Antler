import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'

// Import mock reset functions
import { resetMocks as resetFsMocks } from '../__mocks__/@tauri-apps/plugin-fs'
import { resetMocks as resetShellMocks } from '../__mocks__/@tauri-apps/plugin-shell'
import { resetMocks as resetOsMocks } from '../__mocks__/@tauri-apps/plugin-os'
import { resetMocks as resetPathMocks } from '../__mocks__/@tauri-apps/api/path'

// Mock Tauri plugins globally
vi.mock('@tauri-apps/plugin-fs', () => import('../__mocks__/@tauri-apps/plugin-fs'))
vi.mock('@tauri-apps/plugin-shell', () => import('../__mocks__/@tauri-apps/plugin-shell'))
vi.mock('@tauri-apps/plugin-os', () => import('../__mocks__/@tauri-apps/plugin-os'))
vi.mock('@tauri-apps/api/path', () => import('../__mocks__/@tauri-apps/api/path'))

// Reset all mocks before each test
beforeEach(() => {
  resetFsMocks()
  resetShellMocks()
  resetOsMocks()
  resetPathMocks()
})
