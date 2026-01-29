import { describe, it, expect } from 'vitest'
import {
  createGitHubComment,
  createLinkedIssue,
  createGitHubPR,
  createGitHubInfo,
  updateGitHubInfo,
  addComment,
  addLinkedIssue,
  updatePR,
  type GitHubComment,
  type LinkedIssue,
  type GitHubPR,
  type GitHubInfo,
} from '../github'

describe('GitHub Types', () => {
  describe('createGitHubComment', () => {
    it('creates comment with default values', () => {
      const comment = createGitHubComment()

      expect(comment.id).toBe(0)
      expect(comment.author).toBe('')
      expect(comment.body).toBe('')
      expect(comment.createdAt).toBeDefined()
      expect(comment.updatedAt).toBeDefined()
    })

    it('creates comment with provided values', () => {
      const comment = createGitHubComment({
        id: 123,
        author: 'testuser',
        body: 'Test comment body',
      })

      expect(comment.id).toBe(123)
      expect(comment.author).toBe('testuser')
      expect(comment.body).toBe('Test comment body')
    })

    it('creates frozen (immutable) comment', () => {
      const comment = createGitHubComment()
      expect(Object.isFrozen(comment)).toBe(true)
    })

    it('preserves provided timestamps', () => {
      const createdAt = '2024-01-01T00:00:00.000Z'
      const updatedAt = '2024-01-02T00:00:00.000Z'
      const comment = createGitHubComment({ createdAt, updatedAt })

      expect(comment.createdAt).toBe(createdAt)
      expect(comment.updatedAt).toBe(updatedAt)
    })
  })

  describe('createLinkedIssue', () => {
    it('creates linked issue with default values', () => {
      const link = createLinkedIssue()

      expect(link.issueNumber).toBe(0)
      expect(link.relationship).toBe('related')
      expect(link.repoFullName).toBe('')
    })

    it('creates linked issue with provided values', () => {
      const link = createLinkedIssue({
        issueNumber: 42,
        relationship: 'blocks',
        repoFullName: 'owner/repo',
      })

      expect(link.issueNumber).toBe(42)
      expect(link.relationship).toBe('blocks')
      expect(link.repoFullName).toBe('owner/repo')
    })

    it('creates frozen linked issue', () => {
      const link = createLinkedIssue()
      expect(Object.isFrozen(link)).toBe(true)
    })
  })

  describe('createGitHubPR', () => {
    it('creates PR with default values', () => {
      const pr = createGitHubPR()

      expect(pr.number).toBe(0)
      expect(pr.url).toBe('')
      expect(pr.state).toBe('draft')
      expect(pr.branchName).toBe('')
      expect(pr.baseBranch).toBe('main')
      expect(pr.reviewers).toEqual([])
      expect(pr.ci).toBeDefined()
      expect(pr.mergeable).toBeNull()
      expect(pr.mergeConflicts).toBe(false)
    })

    it('creates PR with provided values', () => {
      const pr = createGitHubPR({
        number: 123,
        url: 'https://github.com/owner/repo/pull/123',
        state: 'open',
        branchName: 'feature-branch',
        baseBranch: 'develop',
        reviewers: ['reviewer1', 'reviewer2'],
        mergeable: true,
        mergeConflicts: false,
      })

      expect(pr.number).toBe(123)
      expect(pr.url).toBe('https://github.com/owner/repo/pull/123')
      expect(pr.state).toBe('open')
      expect(pr.branchName).toBe('feature-branch')
      expect(pr.baseBranch).toBe('develop')
      expect(pr.reviewers).toEqual(['reviewer1', 'reviewer2'])
      expect(pr.mergeable).toBe(true)
    })

    it('creates frozen PR', () => {
      const pr = createGitHubPR()
      expect(Object.isFrozen(pr)).toBe(true)
    })

    it('creates frozen reviewers array', () => {
      const pr = createGitHubPR({ reviewers: ['reviewer1'] })
      expect(Object.isFrozen(pr.reviewers)).toBe(true)
    })
  })

  describe('createGitHubInfo', () => {
    it('creates GitHub info with default values', () => {
      const info = createGitHubInfo()

      expect(info.repoOwner).toBe('')
      expect(info.repoName).toBe('')
      expect(info.issueNumber).toBeNull()
      expect(info.title).toBe('')
      expect(info.body).toBe('')
      expect(info.state).toBe('open')
      expect(info.labels).toEqual([])
      expect(info.assignees).toEqual([])
      expect(info.milestone).toBeNull()
      expect(info.pr).toBeNull()
      expect(info.comments).toEqual([])
      expect(info.linkedIssues).toEqual([])
      expect(info.issueCreatedAt).toBeNull()
      expect(info.issueUpdatedAt).toBeNull()
    })

    it('creates GitHub info with repository details', () => {
      const info = createGitHubInfo({
        repoOwner: 'owner',
        repoName: 'repo',
      })

      expect(info.repoOwner).toBe('owner')
      expect(info.repoName).toBe('repo')
    })

    it('creates GitHub info with issue details', () => {
      const info = createGitHubInfo({
        issueNumber: 42,
        title: 'Test Issue',
        body: 'Issue body',
        state: 'closed',
        labels: ['bug', 'priority'],
        assignees: ['user1', 'user2'],
        milestone: 'v1.0',
      })

      expect(info.issueNumber).toBe(42)
      expect(info.title).toBe('Test Issue')
      expect(info.body).toBe('Issue body')
      expect(info.state).toBe('closed')
      expect(info.labels).toEqual(['bug', 'priority'])
      expect(info.assignees).toEqual(['user1', 'user2'])
      expect(info.milestone).toBe('v1.0')
    })

    it('creates GitHub info with PR', () => {
      const info = createGitHubInfo({
        pr: {
          number: 123,
          state: 'open',
        },
      })

      expect(info.pr).toBeDefined()
      expect(info.pr?.number).toBe(123)
      expect(info.pr?.state).toBe('open')
    })

    it('creates GitHub info with comments', () => {
      const info = createGitHubInfo({
        comments: [
          { id: 1, author: 'user1', body: 'Comment 1' },
          { id: 2, author: 'user2', body: 'Comment 2' },
        ],
      })

      expect(info.comments).toHaveLength(2)
      expect(info.comments[0]?.author).toBe('user1')
      expect(info.comments[1]?.author).toBe('user2')
    })

    it('creates GitHub info with linked issues', () => {
      const info = createGitHubInfo({
        linkedIssues: [
          { issueNumber: 10, relationship: 'blocks', repoFullName: 'owner/repo' },
        ],
      })

      expect(info.linkedIssues).toHaveLength(1)
      expect(info.linkedIssues[0]?.issueNumber).toBe(10)
      expect(info.linkedIssues[0]?.relationship).toBe('blocks')
    })

    it('creates frozen GitHub info', () => {
      const info = createGitHubInfo()
      expect(Object.isFrozen(info)).toBe(true)
    })

    it('creates frozen arrays', () => {
      const info = createGitHubInfo({
        labels: ['bug'],
        assignees: ['user'],
        comments: [{ id: 1 }],
        linkedIssues: [{ issueNumber: 1 }],
      })

      expect(Object.isFrozen(info.labels)).toBe(true)
      expect(Object.isFrozen(info.assignees)).toBe(true)
      expect(Object.isFrozen(info.comments)).toBe(true)
      expect(Object.isFrozen(info.linkedIssues)).toBe(true)
    })
  })

  describe('updateGitHubInfo', () => {
    it('updates info immutably', () => {
      const original = createGitHubInfo({ title: 'Original' })
      const updated = updateGitHubInfo(original, { title: 'Updated' })

      expect(updated.title).toBe('Updated')
      expect(original.title).toBe('Original')
    })

    it('preserves unchanged fields', () => {
      const original = createGitHubInfo({
        repoOwner: 'owner',
        repoName: 'repo',
        title: 'Original',
      })
      const updated = updateGitHubInfo(original, { title: 'Updated' })

      expect(updated.repoOwner).toBe('owner')
      expect(updated.repoName).toBe('repo')
    })

    it('can update multiple fields at once', () => {
      const original = createGitHubInfo()
      const updated = updateGitHubInfo(original, {
        title: 'New Title',
        body: 'New Body',
        state: 'closed',
      })

      expect(updated.title).toBe('New Title')
      expect(updated.body).toBe('New Body')
      expect(updated.state).toBe('closed')
    })
  })

  describe('addComment', () => {
    it('adds comment to info', () => {
      const info = createGitHubInfo()
      const updated = addComment(info, { id: 1, author: 'user', body: 'New comment' })

      expect(updated.comments).toHaveLength(1)
      expect(updated.comments[0]?.body).toBe('New comment')
    })

    it('preserves existing comments', () => {
      const info = createGitHubInfo({
        comments: [{ id: 1, body: 'Existing' }],
      })
      const updated = addComment(info, { id: 2, body: 'New' })

      expect(updated.comments).toHaveLength(2)
      expect(updated.comments[0]?.body).toBe('Existing')
      expect(updated.comments[1]?.body).toBe('New')
    })

    it('updates issueUpdatedAt timestamp', () => {
      const info = createGitHubInfo({ issueUpdatedAt: '2020-01-01T00:00:00.000Z' })
      const updated = addComment(info, { body: 'Comment' })

      expect(updated.issueUpdatedAt).not.toBe('2020-01-01T00:00:00.000Z')
    })

    it('does not mutate original', () => {
      const original = createGitHubInfo()
      addComment(original, { body: 'Comment' })

      expect(original.comments).toHaveLength(0)
    })
  })

  describe('addLinkedIssue', () => {
    it('adds linked issue to info', () => {
      const info = createGitHubInfo()
      const updated = addLinkedIssue(info, {
        issueNumber: 42,
        relationship: 'blocks',
        repoFullName: 'owner/repo',
      })

      expect(updated.linkedIssues).toHaveLength(1)
      expect(updated.linkedIssues[0]?.issueNumber).toBe(42)
    })

    it('preserves existing linked issues', () => {
      const info = createGitHubInfo({
        linkedIssues: [{ issueNumber: 1 }],
      })
      const updated = addLinkedIssue(info, { issueNumber: 2 })

      expect(updated.linkedIssues).toHaveLength(2)
    })

    it('does not mutate original', () => {
      const original = createGitHubInfo()
      addLinkedIssue(original, { issueNumber: 1 })

      expect(original.linkedIssues).toHaveLength(0)
    })
  })

  describe('updatePR', () => {
    it('creates PR if none exists', () => {
      const info = createGitHubInfo()
      const updated = updatePR(info, { number: 123, state: 'open' })

      expect(updated.pr).toBeDefined()
      expect(updated.pr?.number).toBe(123)
      expect(updated.pr?.state).toBe('open')
    })

    it('updates existing PR', () => {
      const info = createGitHubInfo({
        pr: { number: 123, state: 'draft' },
      })
      const updated = updatePR(info, { state: 'open' })

      expect(updated.pr?.number).toBe(123)
      expect(updated.pr?.state).toBe('open')
    })

    it('preserves unchanged PR fields', () => {
      const info = createGitHubInfo({
        pr: {
          number: 123,
          branchName: 'feature',
          baseBranch: 'main',
        },
      })
      const updated = updatePR(info, { state: 'merged' })

      expect(updated.pr?.number).toBe(123)
      expect(updated.pr?.branchName).toBe('feature')
      expect(updated.pr?.baseBranch).toBe('main')
      expect(updated.pr?.state).toBe('merged')
    })

    it('does not mutate original', () => {
      const original = createGitHubInfo({
        pr: { number: 123, state: 'draft' },
      })
      updatePR(original, { state: 'open' })

      expect(original.pr?.state).toBe('draft')
    })
  })
})
