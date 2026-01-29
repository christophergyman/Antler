import { describe, it, expect, beforeEach } from 'vitest'
import { createCard, type Card } from '../../card'
import {
  filterByStatus,
  filterInProgress,
  filterIdle,
  filterDone,
  filterWaiting,
  filterWithError,
  filterWithoutError,
  filterWithWorktree,
  filterWithoutWorktree,
  filterByRepo,
  filterByLabel,
  filterByAssignee,
  findByUid,
  findByName,
  findByIssueNumber,
  findByPRNumber,
  findByBranch,
  updateAll,
  updateWhere,
  removeByUid,
  removeWhere,
  mapParallel,
  mapParallelSettled,
  filterParallel,
  forEachParallel,
  sortByCreated,
  sortByUpdated,
  sortByName,
  sortByIssueNumber,
  countByStatus,
  groupByStatus,
  groupByRepo,
} from '../collection'

describe('Collection Utilities', () => {
  let cards: Card[]

  beforeEach(() => {
    cards = [
      createCard({
        name: 'Card A',
        status: 'idle',
        github: {
          issueNumber: 1,
          repoOwner: 'owner1',
          repoName: 'repo1',
          labels: ['bug', 'priority'],
          assignees: ['alice'],
        },
      }),
      createCard({
        name: 'Card B',
        status: 'in_progress',
        worktreeCreated: true,
        github: {
          issueNumber: 2,
          repoOwner: 'owner1',
          repoName: 'repo1',
          labels: ['feature'],
          assignees: ['bob'],
          pr: { number: 10, branchName: 'feature-branch' },
        },
      }),
      createCard({
        name: 'Card C',
        status: 'waiting',
        hasError: true,
        github: {
          issueNumber: 3,
          repoOwner: 'owner2',
          repoName: 'repo2',
          labels: ['bug'],
          assignees: ['alice', 'bob'],
        },
      }),
      createCard({
        name: 'Card D',
        status: 'done',
        github: {
          issueNumber: 4,
          repoOwner: 'owner2',
          repoName: 'repo2',
          labels: [],
          assignees: [],
        },
      }),
    ]
  })

  describe('Filtering by Status', () => {
    it('filterByStatus returns cards with matching status', () => {
      const result = filterByStatus(cards, 'idle')
      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('Card A')
    })

    it('filterInProgress returns in_progress cards', () => {
      const result = filterInProgress(cards)
      expect(result).toHaveLength(1)
      expect(result[0]?.status).toBe('in_progress')
    })

    it('filterIdle returns idle cards', () => {
      const result = filterIdle(cards)
      expect(result).toHaveLength(1)
      expect(result[0]?.status).toBe('idle')
    })

    it('filterDone returns done cards', () => {
      const result = filterDone(cards)
      expect(result).toHaveLength(1)
      expect(result[0]?.status).toBe('done')
    })

    it('filterWaiting returns waiting cards', () => {
      const result = filterWaiting(cards)
      expect(result).toHaveLength(1)
      expect(result[0]?.status).toBe('waiting')
    })

    it('returns empty array when no cards match', () => {
      const emptyCards: Card[] = []
      expect(filterByStatus(emptyCards, 'idle')).toHaveLength(0)
    })
  })

  describe('Filtering by Error State', () => {
    it('filterWithError returns cards with errors', () => {
      const result = filterWithError(cards)
      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('Card C')
    })

    it('filterWithoutError returns cards without errors', () => {
      const result = filterWithoutError(cards)
      expect(result).toHaveLength(3)
      expect(result.every((c) => !c.hasError)).toBe(true)
    })
  })

  describe('Filtering by Worktree', () => {
    it('filterWithWorktree returns cards with worktrees', () => {
      const result = filterWithWorktree(cards)
      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('Card B')
    })

    it('filterWithoutWorktree returns cards without worktrees', () => {
      const result = filterWithoutWorktree(cards)
      expect(result).toHaveLength(3)
    })
  })

  describe('Filtering by Repository', () => {
    it('filterByRepo returns cards from matching repo', () => {
      const result = filterByRepo(cards, 'owner1/repo1')
      expect(result).toHaveLength(2)
      expect(result.map((c) => c.name)).toContain('Card A')
      expect(result.map((c) => c.name)).toContain('Card B')
    })

    it('returns empty array for non-existent repo', () => {
      const result = filterByRepo(cards, 'nonexistent/repo')
      expect(result).toHaveLength(0)
    })
  })

  describe('Filtering by Label', () => {
    it('filterByLabel returns cards with matching label', () => {
      const result = filterByLabel(cards, 'bug')
      expect(result).toHaveLength(2)
    })

    it('returns empty for non-existent label', () => {
      const result = filterByLabel(cards, 'nonexistent')
      expect(result).toHaveLength(0)
    })
  })

  describe('Filtering by Assignee', () => {
    it('filterByAssignee returns cards with matching assignee', () => {
      const result = filterByAssignee(cards, 'alice')
      expect(result).toHaveLength(2)
    })

    it('filterByAssignee returns cards where assignee is in list', () => {
      const result = filterByAssignee(cards, 'bob')
      expect(result).toHaveLength(2) // Card B and Card C
    })
  })

  describe('Finding Cards', () => {
    it('findByUid returns card with matching UID', () => {
      const card = cards[0]!
      const result = findByUid(cards, card.sessionUid)
      expect(result).toBe(card)
    })

    it('findByUid returns undefined for non-existent UID', () => {
      const result = findByUid(cards, 'non-existent-uid')
      expect(result).toBeUndefined()
    })

    it('findByName returns card with matching name', () => {
      const result = findByName(cards, 'Card B')
      expect(result?.name).toBe('Card B')
    })

    it('findByName returns undefined for non-existent name', () => {
      const result = findByName(cards, 'Non-existent')
      expect(result).toBeUndefined()
    })

    it('findByIssueNumber returns card with matching issue', () => {
      const result = findByIssueNumber(cards, 2)
      expect(result?.name).toBe('Card B')
    })

    it('findByIssueNumber returns undefined for non-existent issue', () => {
      const result = findByIssueNumber(cards, 999)
      expect(result).toBeUndefined()
    })

    it('findByPRNumber returns card with matching PR', () => {
      const result = findByPRNumber(cards, 10)
      expect(result?.name).toBe('Card B')
    })

    it('findByPRNumber returns undefined for non-existent PR', () => {
      const result = findByPRNumber(cards, 999)
      expect(result).toBeUndefined()
    })

    it('findByBranch returns card with matching branch', () => {
      const result = findByBranch(cards, 'feature-branch')
      expect(result?.name).toBe('Card B')
    })

    it('findByBranch returns undefined for non-existent branch', () => {
      const result = findByBranch(cards, 'non-existent-branch')
      expect(result).toBeUndefined()
    })
  })

  describe('Batch Operations', () => {
    it('updateAll applies updater to all cards', () => {
      const result = updateAll(cards, (card) => ({ ...card, hasError: true }))

      expect(result).toHaveLength(4)
      expect(result.every((c) => c.hasError)).toBe(true)
      // Original unchanged
      expect(cards[0]?.hasError).toBe(false)
    })

    it('updateWhere applies updater only to matching cards', () => {
      const result = updateWhere(
        cards,
        (card) => card.status === 'idle',
        (card) => ({ ...card, hasError: true })
      )

      expect(result).toHaveLength(4)
      expect(result.find((c) => c.name === 'Card A')?.hasError).toBe(true)
      expect(result.find((c) => c.name === 'Card B')?.hasError).toBe(false)
    })

    it('removeByUid removes card with matching UID', () => {
      const uidToRemove = cards[0]!.sessionUid
      const result = removeByUid(cards, uidToRemove)

      expect(result).toHaveLength(3)
      expect(result.find((c) => c.sessionUid === uidToRemove)).toBeUndefined()
    })

    it('removeWhere removes cards matching predicate', () => {
      const result = removeWhere(cards, (card) => card.hasError)

      expect(result).toHaveLength(3)
      expect(result.find((c) => c.name === 'Card C')).toBeUndefined()
    })
  })

  describe('Parallel Operations', () => {
    it('mapParallel maps async function over all cards', async () => {
      const result = await mapParallel(cards, async (card) => {
        return card.name.toUpperCase()
      })

      expect(result).toHaveLength(4)
      expect(result).toContain('CARD A')
      expect(result).toContain('CARD B')
    })

    it('mapParallelSettled handles mixed success/failure', async () => {
      const result = await mapParallelSettled(cards, async (card) => {
        if (card.name === 'Card C') {
          throw new Error('Failed')
        }
        return card.name
      })

      expect(result).toHaveLength(4)
      expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(3)
      expect(result.filter((r) => r.status === 'rejected')).toHaveLength(1)
    })

    it('filterParallel filters with async predicate', async () => {
      const result = await filterParallel(cards, async (card) => {
        return card.status === 'in_progress'
      })

      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('Card B')
    })

    it('forEachParallel executes async function on all cards', async () => {
      const processed: string[] = []

      await forEachParallel(cards, async (card) => {
        processed.push(card.name)
      })

      expect(processed).toHaveLength(4)
      expect(processed).toContain('Card A')
    })
  })

  describe('Sorting', () => {
    it('sortByCreated sorts by creation time (desc by default)', () => {
      // Cards with explicit different createdAt timestamps
      const card1 = { ...createCard({ name: 'First' }), createdAt: '2024-01-01T00:00:00.000Z' }
      const card2 = { ...createCard({ name: 'Second' }), createdAt: '2024-01-02T00:00:00.000Z' }
      const card3 = { ...createCard({ name: 'Third' }), createdAt: '2024-01-03T00:00:00.000Z' }
      const testCards = [card2, card1, card3]

      const resultAsc = sortByCreated(testCards, 'asc')
      expect(resultAsc[0]?.name).toBe('First')
      expect(resultAsc[1]?.name).toBe('Second')
      expect(resultAsc[2]?.name).toBe('Third')

      const resultDesc = sortByCreated(testCards, 'desc')
      expect(resultDesc[0]?.name).toBe('Third')
      expect(resultDesc[1]?.name).toBe('Second')
      expect(resultDesc[2]?.name).toBe('First')
    })

    it('sortByCreated can sort ascending', () => {
      const result = sortByCreated(cards, 'asc')
      expect(result).toHaveLength(4)
    })

    it('sortByUpdated sorts by update time', () => {
      const result = sortByUpdated(cards, 'desc')
      expect(result).toHaveLength(4)
    })

    it('sortByName sorts alphabetically (asc by default)', () => {
      const result = sortByName(cards)

      expect(result[0]?.name).toBe('Card A')
      expect(result[1]?.name).toBe('Card B')
      expect(result[2]?.name).toBe('Card C')
      expect(result[3]?.name).toBe('Card D')
    })

    it('sortByName can sort descending', () => {
      const result = sortByName(cards, 'desc')

      expect(result[0]?.name).toBe('Card D')
      expect(result[3]?.name).toBe('Card A')
    })

    it('sortByIssueNumber sorts by issue number', () => {
      const result = sortByIssueNumber(cards, 'asc')

      expect(result[0]?.github.issueNumber).toBe(1)
      expect(result[1]?.github.issueNumber).toBe(2)
      expect(result[2]?.github.issueNumber).toBe(3)
      expect(result[3]?.github.issueNumber).toBe(4)
    })

    it('sortByIssueNumber handles null issue numbers (puts at end)', () => {
      const cardsWithNull = [
        ...cards,
        createCard({ name: 'No Issue', github: { issueNumber: null } }),
      ]
      const result = sortByIssueNumber(cardsWithNull, 'asc')

      expect(result[result.length - 1]?.name).toBe('No Issue')
    })
  })

  describe('Aggregation', () => {
    it('countByStatus returns counts for each status', () => {
      const counts = countByStatus(cards)

      expect(counts.idle).toBe(1)
      expect(counts.in_progress).toBe(1)
      expect(counts.waiting).toBe(1)
      expect(counts.done).toBe(1)
    })

    it('countByStatus returns zeros for empty array', () => {
      const counts = countByStatus([])

      expect(counts.idle).toBe(0)
      expect(counts.in_progress).toBe(0)
      expect(counts.waiting).toBe(0)
      expect(counts.done).toBe(0)
    })

    it('groupByStatus groups cards by their status', () => {
      const groups = groupByStatus(cards)

      expect(groups.idle).toHaveLength(1)
      expect(groups.in_progress).toHaveLength(1)
      expect(groups.waiting).toHaveLength(1)
      expect(groups.done).toHaveLength(1)
      expect(groups.idle[0]?.name).toBe('Card A')
    })

    it('groupByStatus returns empty arrays for statuses with no cards', () => {
      const idleOnly = filterIdle(cards)
      const groups = groupByStatus(idleOnly)

      expect(groups.idle).toHaveLength(1)
      expect(groups.in_progress).toHaveLength(0)
      expect(groups.waiting).toHaveLength(0)
      expect(groups.done).toHaveLength(0)
    })

    it('groupByRepo groups cards by repository', () => {
      const groups = groupByRepo(cards)

      expect(groups.get('owner1/repo1')).toHaveLength(2)
      expect(groups.get('owner2/repo2')).toHaveLength(2)
    })

    it('groupByRepo returns Map with repo keys', () => {
      const groups = groupByRepo(cards)

      expect(groups.size).toBe(2)
      expect(Array.from(groups.keys())).toContain('owner1/repo1')
      expect(Array.from(groups.keys())).toContain('owner2/repo2')
    })
  })

  describe('Immutability', () => {
    it('filter functions do not mutate original array', () => {
      const originalLength = cards.length
      filterByStatus(cards, 'idle')

      expect(cards).toHaveLength(originalLength)
    })

    it('sort functions do not mutate original array', () => {
      const originalOrder = cards.map((c) => c.name)
      sortByName(cards, 'desc')

      expect(cards.map((c) => c.name)).toEqual(originalOrder)
    })

    it('remove functions do not mutate original array', () => {
      const originalLength = cards.length
      removeByUid(cards, cards[0]!.sessionUid)

      expect(cards).toHaveLength(originalLength)
    })
  })
})
