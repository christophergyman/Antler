import { describe, it, expect, beforeEach } from 'vitest'
import {
  createCard,
  updateCard,
  updateGitHub,
  setStatus,
  setInProgress,
  setWaiting,
  setDone,
  markError,
  clearError,
  setWorktreeCreated,
  markWorktreeCreated,
  markWorktreeRemoved,
  startWorktreeCreation,
  completeWorktreeCreation,
  startWorktreeRemoval,
  completeWorktreeRemoval,
  setWorktreeErrorState,
  setWorktreeOperation,
  setWorktreePath,
  setWorktreeError,
  setPort,
  isInProgress,
  isIdle,
  isWaiting,
  isDone,
  hasError,
  hasWorktree,
  hasPR,
  hasIssue,
  isWorktreeCreating,
  isWorktreeRemoving,
  hasWorktreeError,
  isWorktreeOperationInProgress,
  hasPort,
  toJSON,
  fromJSON,
  toJSONArray,
  fromJSONArray,
  type Card,
} from '../card'

describe('Card Module', () => {
  describe('createCard', () => {
    it('creates a card with default values', () => {
      const card = createCard()

      expect(card.status).toBe('idle')
      expect(card.worktreeCreated).toBe(false)
      expect(card.hasError).toBe(false)
      expect(card.worktreePath).toBeNull()
      expect(card.worktreeOperation).toBe('idle')
      expect(card.worktreeError).toBeNull()
      expect(card.port).toBeNull()
      expect(card.sessionUid).toBeDefined()
      expect(card.name).toBeDefined()
      expect(card.createdAt).toBeDefined()
      expect(card.updatedAt).toBeDefined()
    })

    it('creates a card with custom name', () => {
      const card = createCard({ name: 'My Custom Card' })
      expect(card.name).toBe('My Custom Card')
    })

    it('creates a card with custom status', () => {
      const card = createCard({ status: 'in_progress' })
      expect(card.status).toBe('in_progress')
    })

    it('creates a card with worktree already created', () => {
      const card = createCard({ worktreeCreated: true })
      expect(card.worktreeCreated).toBe(true)
    })

    it('creates a card with error state', () => {
      const card = createCard({ hasError: true })
      expect(card.hasError).toBe(true)
    })

    it('creates a card with GitHub info', () => {
      const card = createCard({
        github: {
          issueNumber: 123,
          title: 'Test Issue',
          repoOwner: 'owner',
          repoName: 'repo',
        },
      })
      expect(card.github.issueNumber).toBe(123)
      expect(card.github.title).toBe('Test Issue')
      expect(card.github.repoOwner).toBe('owner')
      expect(card.github.repoName).toBe('repo')
    })

    it('creates a card with worktree path and port', () => {
      const card = createCard({
        worktreePath: '/path/to/worktree',
        port: 3000,
      })
      expect(card.worktreePath).toBe('/path/to/worktree')
      expect(card.port).toBe(3000)
    })

    it('creates an immutable card (frozen)', () => {
      const card = createCard()
      expect(Object.isFrozen(card)).toBe(true)
    })
  })

  describe('updateCard', () => {
    let card: Card

    beforeEach(() => {
      card = createCard()
    })

    it('updates status immutably', () => {
      const updated = updateCard(card, 'status', 'in_progress')

      expect(updated.status).toBe('in_progress')
      expect(card.status).toBe('idle') // Original unchanged
      expect(updated).not.toBe(card)
    })

    it('updates worktreeCreated immutably', () => {
      const updated = updateCard(card, 'worktreeCreated', true)

      expect(updated.worktreeCreated).toBe(true)
      expect(card.worktreeCreated).toBe(false)
    })

    it('updates hasError immutably', () => {
      const updated = updateCard(card, 'hasError', true)

      expect(updated.hasError).toBe(true)
      expect(card.hasError).toBe(false)
    })

    it('updates the updatedAt timestamp', async () => {
      const originalUpdatedAt = card.updatedAt
      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 5))
      const updated = updateCard(card, 'status', 'in_progress')

      expect(updated.updatedAt).not.toBe(originalUpdatedAt)
    })

    it('preserves createdAt timestamp', () => {
      const updated = updateCard(card, 'status', 'in_progress')
      expect(updated.createdAt).toBe(card.createdAt)
    })
  })

  describe('updateGitHub', () => {
    it('updates GitHub info immutably', () => {
      const card = createCard()
      const updated = updateGitHub(card, { title: 'New Title' })

      expect(updated.github.title).toBe('New Title')
      expect(card.github.title).toBe('')
    })

    it('merges GitHub info correctly', () => {
      const card = createCard({
        github: { issueNumber: 123, title: 'Original' },
      })
      const updated = updateGitHub(card, { title: 'Updated' })

      expect(updated.github.issueNumber).toBe(123)
      expect(updated.github.title).toBe('Updated')
    })
  })

  describe('Status Helpers', () => {
    let card: Card

    beforeEach(() => {
      card = createCard()
    })

    it('setStatus changes status', () => {
      expect(setStatus(card, 'waiting').status).toBe('waiting')
    })

    it('setInProgress sets status to in_progress', () => {
      expect(setInProgress(card).status).toBe('in_progress')
    })

    it('setWaiting sets status to waiting', () => {
      expect(setWaiting(card).status).toBe('waiting')
    })

    it('setDone sets status to done', () => {
      expect(setDone(card).status).toBe('done')
    })
  })

  describe('Error Helpers', () => {
    it('markError sets hasError to true', () => {
      const card = createCard()
      expect(markError(card).hasError).toBe(true)
    })

    it('clearError sets hasError to false', () => {
      const card = createCard({ hasError: true })
      expect(clearError(card).hasError).toBe(false)
    })
  })

  describe('Worktree Helpers', () => {
    let card: Card

    beforeEach(() => {
      card = createCard()
    })

    it('setWorktreeCreated sets worktreeCreated flag', () => {
      expect(setWorktreeCreated(card, true).worktreeCreated).toBe(true)
    })

    it('markWorktreeCreated sets worktreeCreated to true', () => {
      expect(markWorktreeCreated(card).worktreeCreated).toBe(true)
    })

    it('markWorktreeRemoved sets worktreeCreated to false', () => {
      const withWorktree = markWorktreeCreated(card)
      expect(markWorktreeRemoved(withWorktree).worktreeCreated).toBe(false)
    })
  })

  describe('Worktree State Helpers', () => {
    let card: Card

    beforeEach(() => {
      card = createCard()
    })

    it('setWorktreeOperation changes operation state', () => {
      const updated = setWorktreeOperation(card, 'creating')
      expect(updated.worktreeOperation).toBe('creating')
    })

    it('setWorktreePath sets the path', () => {
      const updated = setWorktreePath(card, '/some/path')
      expect(updated.worktreePath).toBe('/some/path')
    })

    it('setWorktreeError sets the error message', () => {
      const updated = setWorktreeError(card, 'Something went wrong')
      expect(updated.worktreeError).toBe('Something went wrong')
    })

    it('setPort sets the port number', () => {
      const updated = setPort(card, 3001)
      expect(updated.port).toBe(3001)
    })

    it('startWorktreeCreation sets creating state and clears error', () => {
      const withError = setWorktreeError(card, 'Previous error')
      const updated = startWorktreeCreation(withError)

      expect(updated.worktreeOperation).toBe('creating')
      expect(updated.worktreeError).toBeNull()
    })

    it('completeWorktreeCreation sets all worktree properties', () => {
      const creating = startWorktreeCreation(card)
      const completed = completeWorktreeCreation(creating, '/path/to/worktree', 3000)

      expect(completed.worktreeCreated).toBe(true)
      expect(completed.worktreePath).toBe('/path/to/worktree')
      expect(completed.worktreeOperation).toBe('idle')
      expect(completed.worktreeError).toBeNull()
      expect(completed.port).toBe(3000)
    })

    it('startWorktreeRemoval sets removing state and clears error', () => {
      const withWorktree = completeWorktreeCreation(card, '/path', 3000)
      const removing = startWorktreeRemoval(withWorktree)

      expect(removing.worktreeOperation).toBe('removing')
      expect(removing.worktreeError).toBeNull()
    })

    it('completeWorktreeRemoval resets all worktree properties', () => {
      const withWorktree = completeWorktreeCreation(card, '/path', 3000)
      const removing = startWorktreeRemoval(withWorktree)
      const completed = completeWorktreeRemoval(removing)

      expect(completed.worktreeCreated).toBe(false)
      expect(completed.worktreePath).toBeNull()
      expect(completed.worktreeOperation).toBe('idle')
      expect(completed.worktreeError).toBeNull()
      expect(completed.port).toBeNull()
    })

    it('setWorktreeErrorState sets error operation and message', () => {
      const updated = setWorktreeErrorState(card, 'Creation failed')

      expect(updated.worktreeOperation).toBe('error')
      expect(updated.worktreeError).toBe('Creation failed')
    })
  })

  describe('Predicates', () => {
    it('isInProgress returns true for in_progress status', () => {
      const card = createCard({ status: 'in_progress' })
      expect(isInProgress(card)).toBe(true)
      expect(isIdle(card)).toBe(false)
    })

    it('isIdle returns true for idle status', () => {
      const card = createCard({ status: 'idle' })
      expect(isIdle(card)).toBe(true)
      expect(isInProgress(card)).toBe(false)
    })

    it('isWaiting returns true for waiting status', () => {
      const card = createCard({ status: 'waiting' })
      expect(isWaiting(card)).toBe(true)
    })

    it('isDone returns true for done status', () => {
      const card = createCard({ status: 'done' })
      expect(isDone(card)).toBe(true)
    })

    it('hasError returns true when hasError flag is set', () => {
      const card = createCard({ hasError: true })
      expect(hasError(card)).toBe(true)
    })

    it('hasWorktree returns true when worktreeCreated is true', () => {
      const card = createCard({ worktreeCreated: true })
      expect(hasWorktree(card)).toBe(true)
    })

    it('hasPR returns true when PR exists', () => {
      const card = createCard({
        github: { pr: { number: 1 } },
      })
      expect(hasPR(card)).toBe(true)
    })

    it('hasPR returns false when PR is null', () => {
      const card = createCard()
      expect(hasPR(card)).toBe(false)
    })

    it('hasIssue returns true when issueNumber exists', () => {
      const card = createCard({
        github: { issueNumber: 123 },
      })
      expect(hasIssue(card)).toBe(true)
    })

    it('hasIssue returns false when issueNumber is null', () => {
      const card = createCard()
      expect(hasIssue(card)).toBe(false)
    })

    it('isWorktreeCreating returns true during creation', () => {
      const card = startWorktreeCreation(createCard())
      expect(isWorktreeCreating(card)).toBe(true)
    })

    it('isWorktreeRemoving returns true during removal', () => {
      const card = startWorktreeRemoval(createCard())
      expect(isWorktreeRemoving(card)).toBe(true)
    })

    it('hasWorktreeError returns true when in error state', () => {
      const card = setWorktreeErrorState(createCard(), 'Error')
      expect(hasWorktreeError(card)).toBe(true)
    })

    it('isWorktreeOperationInProgress returns true for creating or removing', () => {
      const creating = startWorktreeCreation(createCard())
      const removing = startWorktreeRemoval(createCard())
      const idle = createCard()

      expect(isWorktreeOperationInProgress(creating)).toBe(true)
      expect(isWorktreeOperationInProgress(removing)).toBe(true)
      expect(isWorktreeOperationInProgress(idle)).toBe(false)
    })

    it('hasPort returns true when port is set', () => {
      const card = createCard({ port: 3000 })
      expect(hasPort(card)).toBe(true)
    })

    it('hasPort returns false when port is null', () => {
      const card = createCard()
      expect(hasPort(card)).toBe(false)
    })
  })

  describe('Serialization', () => {
    it('toJSON serializes card to JSON string', () => {
      const card = createCard({ name: 'Test Card' })
      const json = toJSON(card)

      expect(typeof json).toBe('string')
      expect(json).toContain('Test Card')
    })

    it('fromJSON deserializes JSON string to card', () => {
      const original = createCard({
        name: 'Test Card',
        status: 'in_progress',
        github: { issueNumber: 123, title: 'Test Issue' },
      })
      const json = toJSON(original)
      const restored = fromJSON(json)

      expect(restored.name).toBe(original.name)
      expect(restored.status).toBe(original.status)
      expect(restored.sessionUid).toBe(original.sessionUid)
      expect(restored.github.issueNumber).toBe(123)
    })

    it('fromJSON throws on invalid JSON', () => {
      expect(() => fromJSON('invalid json')).toThrow()
    })

    it('fromJSON throws on missing required fields', () => {
      expect(() => fromJSON('{}')).toThrow('Invalid card')
    })

    it('fromJSON returns frozen object', () => {
      const card = createCard()
      const restored = fromJSON(toJSON(card))
      expect(Object.isFrozen(restored)).toBe(true)
    })

    it('toJSONArray serializes card array', () => {
      const cards = [createCard({ name: 'Card 1' }), createCard({ name: 'Card 2' })]
      const json = toJSONArray(cards)

      expect(typeof json).toBe('string')
      expect(json).toContain('Card 1')
      expect(json).toContain('Card 2')
    })

    it('fromJSONArray deserializes JSON string to card array', () => {
      const original = [createCard({ name: 'Card 1' }), createCard({ name: 'Card 2' })]
      const json = toJSONArray(original)
      const restored = fromJSONArray(json)

      expect(restored).toHaveLength(2)
      expect(restored[0]?.name).toBe('Card 1')
      expect(restored[1]?.name).toBe('Card 2')
    })

    it('fromJSONArray throws on non-array JSON', () => {
      expect(() => fromJSONArray('{}')).toThrow('expected array')
    })

    it('fromJSONArray throws with index on invalid card', () => {
      const invalidJson = JSON.stringify([{}, { name: 'valid' }])
      expect(() => fromJSONArray(invalidJson)).toThrow('index 0')
    })
  })
})
