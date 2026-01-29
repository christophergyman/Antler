import { describe, it, expect } from 'vitest'
import {
  generateBranchName,
  parseIssueNumberFromBranch,
  getWorktreePath,
} from '../worktree'

describe('Worktree Service', () => {
  describe('generateBranchName', () => {
    it('generates branch name from issue number and title', () => {
      const result = generateBranchName(42, 'Fix login bug')
      expect(result).toBe('42-fix-login-bug')
    })

    it('converts title to lowercase', () => {
      const result = generateBranchName(1, 'Add NEW Feature')
      expect(result).toBe('1-add-new-feature')
    })

    it('replaces non-alphanumeric characters with hyphens', () => {
      const result = generateBranchName(10, "Fix: user's profile (v2)")
      expect(result).toBe('10-fix-user-s-profile-v2')
    })

    it('trims leading hyphens', () => {
      const result = generateBranchName(5, '---leading dashes')
      expect(result).toBe('5-leading-dashes')
    })

    it('trims trailing hyphens', () => {
      const result = generateBranchName(5, 'trailing dashes---')
      expect(result).toBe('5-trailing-dashes')
    })

    it('handles multiple consecutive special characters', () => {
      const result = generateBranchName(7, 'Fix!!! Multiple... issues???')
      expect(result).toBe('7-fix-multiple-issues')
    })

    it('limits slug length to 50 characters', () => {
      const longTitle = 'This is a very long title that exceeds the maximum allowed length for a branch name slug'
      const result = generateBranchName(100, longTitle)
      // 100- prefix plus slug (limited to 50 chars)
      const slug = result.slice(4) // Remove "100-" prefix
      expect(slug.length).toBeLessThanOrEqual(50)
    })

    it('uses "issue" fallback for empty slug (all special chars)', () => {
      const result = generateBranchName(99, '!@#$%^&*()')
      expect(result).toBe('99-issue')
    })

    it('uses "issue" fallback for whitespace-only title', () => {
      const result = generateBranchName(1, '   ')
      expect(result).toBe('1-issue')
    })

    it('handles empty title', () => {
      const result = generateBranchName(1, '')
      expect(result).toBe('1-issue')
    })

    it('handles single character title', () => {
      const result = generateBranchName(1, 'A')
      expect(result).toBe('1-a')
    })

    it('handles numeric title', () => {
      const result = generateBranchName(1, '123')
      expect(result).toBe('1-123')
    })

    it('handles mixed alphanumeric', () => {
      const result = generateBranchName(50, 'v2 API endpoint')
      expect(result).toBe('50-v2-api-endpoint')
    })

    it('handles unicode characters', () => {
      const result = generateBranchName(1, 'Fix émoji 🚀 handling')
      // Unicode non-alphanumeric becomes hyphens
      expect(result).toBe('1-fix-moji-handling')
    })
  })

  describe('parseIssueNumberFromBranch', () => {
    it('parses issue number from standard branch name', () => {
      const result = parseIssueNumberFromBranch('42-fix-login-bug')
      expect(result).toBe(42)
    })

    it('parses single digit issue number', () => {
      const result = parseIssueNumberFromBranch('1-feature')
      expect(result).toBe(1)
    })

    it('parses large issue number', () => {
      const result = parseIssueNumberFromBranch('12345-big-project')
      expect(result).toBe(12345)
    })

    it('returns null for branch without issue number prefix', () => {
      const result = parseIssueNumberFromBranch('feature-branch')
      expect(result).toBeNull()
    })

    it('returns null for branch with number not followed by hyphen', () => {
      const result = parseIssueNumberFromBranch('feature42')
      expect(result).toBeNull()
    })

    it('returns null for empty string', () => {
      const result = parseIssueNumberFromBranch('')
      expect(result).toBeNull()
    })

    it('returns null for branch starting with hyphen', () => {
      const result = parseIssueNumberFromBranch('-42-feature')
      expect(result).toBeNull()
    })

    it('parses only the first number before hyphen', () => {
      const result = parseIssueNumberFromBranch('10-20-30')
      expect(result).toBe(10)
    })

    it('handles branch name that is just number-hyphen', () => {
      const result = parseIssueNumberFromBranch('5-')
      expect(result).toBe(5)
    })

    it('returns null for number without hyphen', () => {
      const result = parseIssueNumberFromBranch('42')
      expect(result).toBeNull()
    })

    it('returns null for main/master branches', () => {
      expect(parseIssueNumberFromBranch('main')).toBeNull()
      expect(parseIssueNumberFromBranch('master')).toBeNull()
    })

    it('returns null for develop/feature branches', () => {
      expect(parseIssueNumberFromBranch('develop')).toBeNull()
      expect(parseIssueNumberFromBranch('feature/add-login')).toBeNull()
    })
  })

  describe('getWorktreePath', () => {
    it('generates correct worktree path', () => {
      const result = getWorktreePath('/repo/root', '42-feature-branch')
      expect(result).toBe('/repo/root/.worktrees/42-feature-branch')
    })

    it('handles repo root with trailing slash', () => {
      // Note: The function doesn't normalize paths, so this would create double slash
      // Testing actual behavior
      const result = getWorktreePath('/repo/root/', '42-feature')
      expect(result).toBe('/repo/root//.worktrees/42-feature')
    })

    it('handles simple branch names', () => {
      const result = getWorktreePath('/home/user/project', 'main')
      expect(result).toBe('/home/user/project/.worktrees/main')
    })

    it('handles complex branch names', () => {
      const result = getWorktreePath('/project', '123-fix-critical-bug-in-authentication')
      expect(result).toBe('/project/.worktrees/123-fix-critical-bug-in-authentication')
    })
  })
})
