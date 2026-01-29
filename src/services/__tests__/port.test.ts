import { describe, it, expect } from 'vitest'
import { buildCommandWithPort } from '../port'

describe('Port Service', () => {
  describe('buildCommandWithPort', () => {
    it('prepends PORT environment variable to command', () => {
      const result = buildCommandWithPort('bun run dev', 3000)
      expect(result).toBe('PORT=3000 bun run dev')
    })

    it('works with npm commands', () => {
      const result = buildCommandWithPort('npm start', 3001)
      expect(result).toBe('PORT=3001 npm start')
    })

    it('works with yarn commands', () => {
      const result = buildCommandWithPort('yarn dev', 3002)
      expect(result).toBe('PORT=3002 yarn dev')
    })

    it('works with complex commands', () => {
      const result = buildCommandWithPort('npm run dev -- --watch', 3003)
      expect(result).toBe('PORT=3003 npm run dev -- --watch')
    })

    it('handles commands with existing environment variables', () => {
      const result = buildCommandWithPort('NODE_ENV=development npm start', 3004)
      expect(result).toBe('PORT=3004 NODE_ENV=development npm start')
    })

    it('works with empty command', () => {
      const result = buildCommandWithPort('', 3000)
      expect(result).toBe('PORT=3000 ')
    })

    it('works with single word command', () => {
      const result = buildCommandWithPort('node', 3005)
      expect(result).toBe('PORT=3005 node')
    })

    it('handles port at boundary values', () => {
      expect(buildCommandWithPort('cmd', 3000)).toBe('PORT=3000 cmd')
      expect(buildCommandWithPort('cmd', 3999)).toBe('PORT=3999 cmd')
    })

    it('handles ports outside typical range', () => {
      expect(buildCommandWithPort('cmd', 8080)).toBe('PORT=8080 cmd')
      expect(buildCommandWithPort('cmd', 80)).toBe('PORT=80 cmd')
    })
  })

  // Note: getUsedPorts, allocatePort, and getWorktreePort require mocking
  // of listWorktrees and file system operations. These integration tests
  // would be added separately with proper mock setup.
})
