import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KanbanCard } from '../KanbanCard'

describe('KanbanCard', () => {
  const defaultProps = {
    title: 'Test Card',
    description: 'Test Description',
  }

  describe('Basic Rendering', () => {
    it('renders title and description', () => {
      render(<KanbanCard {...defaultProps} />)

      expect(screen.getByText('Test Card')).toBeInTheDocument()
      expect(screen.getByText('Test Description')).toBeInTheDocument()
    })

    it('renders labels when provided', () => {
      render(<KanbanCard {...defaultProps} labels={['bug', 'priority']} />)

      expect(screen.getByText('bug')).toBeInTheDocument()
      expect(screen.getByText('priority')).toBeInTheDocument()
    })

    it('does not render badge container when no badges needed', () => {
      const { container } = render(<KanbanCard {...defaultProps} />)

      // No badges should be rendered
      expect(container.querySelectorAll('[class*="Badge"]').length).toBe(0)
    })
  })

  describe('Error States', () => {
    it('shows Error badge when hasError is true', () => {
      render(<KanbanCard {...defaultProps} hasError={true} />)

      expect(screen.getByText('Error')).toBeInTheDocument()
    })

    it('shows Worktree Error badge when worktreeOperation is error', () => {
      render(
        <KanbanCard
          {...defaultProps}
          worktreeOperation="error"
          worktreeError="Failed to create worktree"
        />
      )

      expect(screen.getByText('Worktree Error')).toBeInTheDocument()
    })

    it('does not show Worktree Error badge without error message', () => {
      render(
        <KanbanCard {...defaultProps} worktreeOperation="error" worktreeError={null} />
      )

      expect(screen.queryByText('Worktree Error')).not.toBeInTheDocument()
    })
  })

  describe('Worktree Operation States', () => {
    it('shows Creating badge with spinner when worktreeOperation is creating', () => {
      render(<KanbanCard {...defaultProps} worktreeOperation="creating" />)

      expect(screen.getByText(/Creating\.\.\./)).toBeInTheDocument()
    })

    it('shows Removing badge with spinner when worktreeOperation is removing', () => {
      render(<KanbanCard {...defaultProps} worktreeOperation="removing" />)

      expect(screen.getByText(/Removing\.\.\./)).toBeInTheDocument()
    })
  })

  describe('Active Worktree State', () => {
    it('shows Worktree badge when worktreeCreated is true', () => {
      render(<KanbanCard {...defaultProps} worktreeCreated={true} />)

      expect(screen.getByText('Worktree')).toBeInTheDocument()
    })

    it('does not show Worktree badge during creating operation', () => {
      render(
        <KanbanCard
          {...defaultProps}
          worktreeCreated={true}
          worktreeOperation="creating"
        />
      )

      expect(screen.queryByText('Worktree')).not.toBeInTheDocument()
      expect(screen.getByText(/Creating\.\.\./)).toBeInTheDocument()
    })

    it('does not show Worktree badge during removing operation', () => {
      render(
        <KanbanCard
          {...defaultProps}
          worktreeCreated={true}
          worktreeOperation="removing"
        />
      )

      expect(screen.queryByText('Worktree')).not.toBeInTheDocument()
      expect(screen.getByText(/Removing\.\.\./)).toBeInTheDocument()
    })

    it('shows port badge when port is set and worktree is created', () => {
      render(
        <KanbanCard {...defaultProps} worktreeCreated={true} port={3000} />
      )

      expect(screen.getByText(':3000')).toBeInTheDocument()
    })

    it('does not show port badge without worktree', () => {
      render(<KanbanCard {...defaultProps} worktreeCreated={false} port={3000} />)

      expect(screen.queryByText(':3000')).not.toBeInTheDocument()
    })

    it('does not show port badge during worktree operations', () => {
      render(
        <KanbanCard
          {...defaultProps}
          worktreeCreated={true}
          port={3000}
          worktreeOperation="creating"
        />
      )

      expect(screen.queryByText(':3000')).not.toBeInTheDocument()
    })
  })

  describe('Dragging State', () => {
    it('applies dragging styles when isDragging is true', () => {
      const { container } = render(<KanbanCard {...defaultProps} isDragging={true} />)

      const card = container.firstChild as HTMLElement
      expect(card.className).toContain('shadow-xl')
      expect(card.className).toContain('rotate-2')
    })

    it('does not apply dragging styles when isDragging is false', () => {
      const { container } = render(<KanbanCard {...defaultProps} isDragging={false} />)

      const card = container.firstChild as HTMLElement
      expect(card.className).not.toContain('shadow-xl')
      expect(card.className).not.toContain('rotate-2')
    })
  })

  describe('Badge Order', () => {
    it('renders error badges before operation badges before state badges', () => {
      render(
        <KanbanCard
          {...defaultProps}
          hasError={true}
          worktreeCreated={true}
          labels={['feature']}
        />
      )

      const badges = screen.getAllByText(/Error|Worktree|feature/)
      expect(badges[0]).toHaveTextContent('Error')
      expect(badges[1]).toHaveTextContent('Worktree')
      expect(badges[2]).toHaveTextContent('feature')
    })
  })
})
