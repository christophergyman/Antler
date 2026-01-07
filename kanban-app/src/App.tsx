import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './index.css';

// API_URL is empty to use relative URLs - Vite proxy handles /api requests
const API_URL = '';

// Types
interface Task {
  id: string;
  title: string;
  problem: string;
  solution: string;
  alternatives: string;
  additionalContext: string;
  assignee: string;
  label: string;
  project: string;
  milestone: string;
  branch: string;
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
}

interface DropTarget {
  columnId: string;
  index: number;
}

interface ApiResponse {
  columns: Column[];
}

type Theme = 'light' | 'dark' | 'system';

// Icons
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const BoardIcon = () => (
  <svg className="logo-icon" viewBox="0 0 24 24" fill="currentColor">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const ProjectIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

const MilestoneIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);

const BranchIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="6" x2="6" y1="3" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </svg>
);

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

// Drop indicator component
function DropIndicator({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null;
  return (
    <motion.div
      className="drop-indicator"
      initial={{ opacity: 0, scaleX: 0.8 }}
      animate={{ opacity: 1, scaleX: 1 }}
      exit={{ opacity: 0, scaleX: 0.8 }}
      transition={{ duration: 0.15 }}
    />
  );
}

// Card component
function TaskCard({
  task,
  index,
  columnId,
  onDragStart,
  onDragOver,
  onEditClick,
  onDeleteClick,
  draggedTaskId,
  dropTarget,
}: {
  task: Task;
  index: number;
  columnId: string;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent, columnId: string, index: number) => void;
  onEditClick: (task: Task) => void;
  onDeleteClick: (task: Task) => void;
  draggedTaskId: string | null;
  dropTarget: DropTarget | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = draggedTaskId === task.id;
  const showIndicatorBefore = dropTarget?.columnId === columnId && dropTarget?.index === index && draggedTaskId !== task.id;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!cardRef.current || isDragging) return;

    const rect = cardRef.current.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const insertIndex = e.clientY < midpoint ? index : index + 1;

    onDragOver(e, columnId, insertIndex);
  };

  return (
    <>
      <DropIndicator isVisible={showIndicatorBefore} />
      <motion.div
        ref={cardRef}
        className={`card label-${task.label} ${isDragging ? 'dragging' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e as unknown as React.DragEvent, task.id)}
        onDragOver={handleDragOver}
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={isDragging ? {} : { y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="card-header">
          <h3 className="card-title">{task.title}</h3>
          <div className="card-actions">
            <button
              className="card-action-btn edit"
              onClick={(e) => {
                e.stopPropagation();
                onEditClick(task);
              }}
            >
              <EditIcon />
            </button>
            <button
              className="card-action-btn delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(task);
              }}
            >
              <TrashIcon />
            </button>
          </div>
        </div>
        <div className="card-metadata">
          <div className="metadata-item">
            <ProjectIcon />
            <span>{task.project}</span>
          </div>
          <div className="metadata-item">
            <MilestoneIcon />
            <span>{task.milestone}</span>
          </div>
          <div className="metadata-item">
            <BranchIcon />
            <span>{task.branch}</span>
          </div>
        </div>
        <div className="card-footer">
          <span className={`label ${task.label}`}>{task.label}</span>
          <div className="card-avatar">{task.assignee}</div>
        </div>
      </motion.div>
    </>
  );
}

// Column component
function KanbanColumn({
  column,
  onDragStart,
  onDragOver,
  onDrop,
  onEditClick,
  onDeleteClick,
  draggedTaskId,
  dropTarget,
}: {
  column: Column;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragOver: (e: React.DragEvent, columnId: string, index: number) => void;
  onDrop: (e: React.DragEvent) => void;
  onEditClick: (task: Task) => void;
  onDeleteClick: (task: Task) => void;
  draggedTaskId: string | null;
  dropTarget: DropTarget | null;
}) {
  const isOver = dropTarget?.columnId === column.id;
  const showIndicatorAtEnd = isOver && dropTarget?.index === column.tasks.length;

  const handleDragOverEmpty = (e: React.DragEvent) => {
    e.preventDefault();
    if (column.tasks.length === 0) {
      onDragOver(e, column.id, 0);
    }
  };

  const handleDragOverBottom = (e: React.DragEvent) => {
    e.preventDefault();
    onDragOver(e, column.id, column.tasks.length);
  };

  return (
    <motion.div
      className={`column ${isOver ? 'drag-over' : ''}`}
      onDrop={onDrop}
      onDragOver={handleDragOverEmpty}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="column-header">
        <h2 className="column-title">{column.title}</h2>
        <span className="column-count">{column.tasks.length}</span>
      </div>
      <div className="column-content">
        <AnimatePresence mode="popLayout">
          {column.tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              index={index}
              columnId={column.id}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onEditClick={onEditClick}
              onDeleteClick={onDeleteClick}
              draggedTaskId={draggedTaskId}
              dropTarget={dropTarget}
            />
          ))}
        </AnimatePresence>
        {column.tasks.length > 0 && (
          <div
            className="drop-zone-bottom"
            onDragOver={handleDragOverBottom}
          >
            <DropIndicator isVisible={showIndicatorAtEnd} />
          </div>
        )}
        {column.tasks.length === 0 && (
          <div className="empty-column" onDragOver={handleDragOverEmpty}>
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12h6M12 9v6" />
            </svg>
            <span className="empty-text">Drop tasks here</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Delete confirmation modal
function DeleteConfirmModal({
  isOpen,
  task,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen || !task) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal delete-modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="delete-modal-icon">
            <TrashIcon />
          </div>
          <h2 className="delete-modal-title">Delete Task</h2>
          <p className="delete-modal-text">
            Are you sure you want to delete "<strong>{task.title}</strong>"? This action cannot be undone.
          </p>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Task form modal (used for both add and edit)
function TaskFormModal({
  isOpen,
  task,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  task: Task | null;
  onClose: () => void;
  onSubmit: (task: Omit<Task, 'id'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState('');
  const [solution, setSolution] = useState('');
  const [alternatives, setAlternatives] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [assignee, setAssignee] = useState('');
  const [label, setLabel] = useState<Task['label']>('feature');
  const [project, setProject] = useState('');
  const [milestone, setMilestone] = useState('');
  const [branch, setBranch] = useState('');

  const isEditing = task !== null;

  // Sync form state when task changes
  if (isOpen && task) {
    if (title !== task.title) {
      setTitle(task.title);
      setProblem(task.problem);
      setSolution(task.solution);
      setAlternatives(task.alternatives);
      setAdditionalContext(task.additionalContext);
      setAssignee(task.assignee);
      setLabel(task.label);
      setProject(task.project);
      setMilestone(task.milestone);
      setBranch(task.branch);
    }
  }

  const resetForm = () => {
    setTitle('');
    setProblem('');
    setSolution('');
    setAlternatives('');
    setAdditionalContext('');
    setAssignee('');
    setLabel('feature');
    setProject('');
    setMilestone('');
    setBranch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title,
      problem,
      solution,
      alternatives,
      additionalContext,
      assignee: assignee || 'ME',
      label,
      project,
      milestone,
      branch,
    });
    if (!isEditing) {
      resetForm();
    }
    onClose();
  };

  const handleClose = () => {
    if (!isEditing) {
      resetForm();
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className="modal modal-wide"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2 className="modal-title">{isEditing ? 'Edit Feature Request' : 'New Feature Request'}</h2>
            <button className="modal-close" onClick={handleClose}>
              <CloseIcon />
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-section">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Brief, descriptive title for the feature request"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Is your feature request related to a problem? Please describe.</label>
                <textarea
                  className="form-input"
                  placeholder="A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]"
                  value={problem}
                  onChange={(e) => setProblem(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Describe the solution you'd like</label>
                <textarea
                  className="form-input"
                  placeholder="A clear and concise description of what you want to happen."
                  value={solution}
                  onChange={(e) => setSolution(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Describe alternatives you've considered</label>
                <textarea
                  className="form-input"
                  placeholder="A clear and concise description of any alternative solutions or features you've considered."
                  value={alternatives}
                  onChange={(e) => setAlternatives(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Additional context</label>
                <textarea
                  className="form-input"
                  placeholder="Add any other context or screenshots about the feature request here."
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="form-section">
              <h3 className="form-section-title">Metadata</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <select
                    className="form-select"
                    value={label}
                    onChange={(e) => setLabel(e.target.value as Task['label'])}
                  >
                    <option value="feature">Feature</option>
                    <option value="bug">Bug</option>
                    <option value="enhancement">Enhancement</option>
                    <option value="documentation">Documentation</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Assignee</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Initials (e.g., AK)"
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Project</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., Auth System"
                    value={project}
                    onChange={(e) => setProject(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Milestone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g., v2.0"
                    value={milestone}
                    onChange={(e) => setMilestone(e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Branch</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g., feature/oauth-login"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                {isEditing ? 'Save Changes' : 'Create Request'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Settings modal
function SettingsModal({
  isOpen,
  currentRepo,
  currentClosedIssueLimit,
  currentTheme,
  onClose,
  onSave,
  onThemeChange,
}: {
  isOpen: boolean;
  currentRepo: string;
  currentClosedIssueLimit: number;
  currentTheme: Theme;
  onClose: () => void;
  onSave: (repo: string, closedIssueLimit: number) => void;
  onThemeChange: (theme: Theme) => void;
}) {
  const [repository, setRepository] = useState(currentRepo);
  const [closedIssueLimit, setClosedIssueLimit] = useState(currentClosedIssueLimit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync when modal opens
  useEffect(() => {
    if (isOpen) {
      setRepository(currentRepo);
      setClosedIssueLimit(currentClosedIssueLimit);
      setError(null);
    }
  }, [isOpen, currentRepo, currentClosedIssueLimit]);

  const handleSave = async () => {
    if (!repository.trim()) {
      setError('Repository is required');
      return;
    }

    // Basic validation: should be in "owner/repo" format
    if (!repository.includes('/')) {
      setError('Repository should be in "owner/repo" format');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository: repository.trim(),
          closed_issue_limit: closedIssueLimit,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to save config');
      }

      onSave(repository.trim(), closedIssueLimit);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="modal"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h2 className="modal-title">Settings</h2>
            <button className="modal-close" onClick={onClose}>
              <CloseIcon />
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">GitHub Repository</label>
            <input
              type="text"
              className="form-input"
              placeholder="owner/repo"
              value={repository}
              onChange={(e) => setRepository(e.target.value)}
              disabled={saving}
            />
            <p className="form-hint">Enter the repository in "owner/repo" format (e.g., "facebook/react")</p>
          </div>

          <div className="form-group">
            <label className="form-label">Closed Issues Limit</label>
            <input
              type="number"
              className="form-input"
              min="0"
              max="100"
              value={closedIssueLimit}
              onChange={(e) => setClosedIssueLimit(parseInt(e.target.value) || 0)}
              disabled={saving}
            />
            <p className="form-hint">Number of closed issues to show in Done column (0 to hide)</p>
          </div>

          <div className="form-group">
            <label className="form-label">Theme</label>
            <div className="theme-selector">
              <button
                type="button"
                className={`theme-option ${currentTheme === 'light' ? 'active' : ''}`}
                onClick={() => onThemeChange('light')}
                disabled={saving}
              >
                <SunIcon /> Light
              </button>
              <button
                type="button"
                className={`theme-option ${currentTheme === 'dark' ? 'active' : ''}`}
                onClick={() => onThemeChange('dark')}
                disabled={saving}
              >
                <MoonIcon /> Dark
              </button>
              <button
                type="button"
                className={`theme-option ${currentTheme === 'system' ? 'active' : ''}`}
                onClick={() => onThemeChange('system')}
                disabled={saving}
              >
                System
              </button>
            </div>
          </div>

          {error && <p className="form-error">{error}</p>}

          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Loading spinner component
function LoadingSpinner() {
  return (
    <div className="loading-container">
      <div className="loading-spinner" />
      <p className="loading-text">Loading issues from GitHub...</p>
    </div>
  );
}

// Error display component
function ErrorDisplay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-container">
      <div className="error-icon">!</div>
      <h2 className="error-title">Failed to load issues</h2>
      <p className="error-message">{message}</p>
      <button className="btn btn-primary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

// Main App
function App() {
  const [columns, setColumns] = useState<Column[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentRepo, setCurrentRepo] = useState('');
  const [closedIssueLimit, setClosedIssueLimit] = useState(15);
  const [configError, setConfigError] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved && ['light', 'dark', 'system'].includes(saved)) return saved;
    return 'system';
  });

  // Apply theme to document
  useEffect(() => {
    const applyTheme = (resolvedTheme: 'light' | 'dark') => {
      document.documentElement.setAttribute('data-theme', resolvedTheme);
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  // Save theme to localStorage
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleThemeChange = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/issues`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      const data: ApiResponse = await response.json();
      setColumns(data.columns);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  // Fetch current config on mount
  useEffect(() => {
    fetch(`${API_URL}/api/config`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch config');
        return res.json();
      })
      .then((data) => {
        setCurrentRepo(data.repository || '');
        setClosedIssueLimit(data.closed_issue_limit ?? 15);
        setConfigError(false);
      })
      .catch(() => {
        setConfigError(true);
      });
  }, []);

  const handleSettingsSave = useCallback((newRepo: string, newClosedIssueLimit: number) => {
    setCurrentRepo(newRepo);
    setClosedIssueLimit(newClosedIssueLimit);
    setConfigError(false);
    fetchIssues(); // Auto-reload issues from new repo
  }, [fetchIssues]);

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget({ columnId, index });
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');

      if (!taskId || !dropTarget) return;

      setColumns((prevColumns) => {
        // Find the task and its source column
        let task: Task | undefined;
        let sourceColumnId: string | undefined;
        let sourceIndex: number = -1;

        for (const column of prevColumns) {
          const foundIndex = column.tasks.findIndex((t) => t.id === taskId);
          if (foundIndex !== -1) {
            task = column.tasks[foundIndex];
            sourceColumnId = column.id;
            sourceIndex = foundIndex;
            break;
          }
        }

        if (!task || !sourceColumnId) {
          return prevColumns;
        }

        // If dropping in the same column at the same position or adjacent, no change needed
        if (sourceColumnId === dropTarget.columnId) {
          if (sourceIndex === dropTarget.index || sourceIndex === dropTarget.index - 1) {
            return prevColumns;
          }
        }

        // Calculate the actual insert index
        let insertIndex = dropTarget.index;
        if (sourceColumnId === dropTarget.columnId && sourceIndex < dropTarget.index) {
          insertIndex -= 1;
        }

        // Move the task
        return prevColumns.map((column) => {
          if (column.id === sourceColumnId && column.id === dropTarget.columnId) {
            // Moving within the same column
            const newTasks = column.tasks.filter((t) => t.id !== taskId);
            newTasks.splice(insertIndex, 0, task!);
            return { ...column, tasks: newTasks };
          }
          if (column.id === sourceColumnId) {
            return {
              ...column,
              tasks: column.tasks.filter((t) => t.id !== taskId),
            };
          }
          if (column.id === dropTarget.columnId) {
            const newTasks = [...column.tasks];
            newTasks.splice(insertIndex, 0, task!);
            return { ...column, tasks: newTasks };
          }
          return column;
        });
      });

      setDraggedTaskId(null);
      setDropTarget(null);
    },
    [dropTarget]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDropTarget(null);
  }, []);

  const handleAddTask = useCallback((taskData: Omit<Task, 'id'>) => {
    const newTask: Task = {
      ...taskData,
      id: Date.now().toString(),
    };
    setColumns((prevColumns) =>
      prevColumns.map((column) =>
        column.id === 'feature'
          ? { ...column, tasks: [newTask, ...column.tasks] }
          : column
      )
    );
  }, []);

  const handleEditClick = useCallback((task: Task) => {
    setTaskToEdit(task);
  }, []);

  const handleEditTask = useCallback((taskData: Omit<Task, 'id'>) => {
    if (!taskToEdit) return;
    setColumns((prevColumns) =>
      prevColumns.map((column) => ({
        ...column,
        tasks: column.tasks.map((t) =>
          t.id === taskToEdit.id ? { ...taskData, id: taskToEdit.id } : t
        ),
      }))
    );
    setTaskToEdit(null);
  }, [taskToEdit]);

  const handleDeleteClick = useCallback((task: Task) => {
    setTaskToDelete(task);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!taskToDelete) return;
    setColumns((prevColumns) =>
      prevColumns.map((column) => ({
        ...column,
        tasks: column.tasks.filter((t) => t.id !== taskToDelete.id),
      }))
    );
    setTaskToDelete(null);
  }, [taskToDelete]);

  if (loading) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <BoardIcon />
            </div>
            <h1>Kanban Board</h1>
          </div>
        </header>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <BoardIcon />
            </div>
            <h1>Kanban Board</h1>
          </div>
        </header>
        <ErrorDisplay message={error} onRetry={fetchIssues} />
      </div>
    );
  }

  return (
    <div className="app" onDragEnd={handleDragEnd}>
      <header className="header">
        <div className="header-left">
          <div className="logo">
            <BoardIcon />
          </div>
          <h1>Kanban Board</h1>
        </div>
        <div className="header-right">
          <button className="add-task-btn" onClick={() => setIsAddModalOpen(true)}>
            <PlusIcon />
            Add Task
          </button>
          <button className="refresh-btn" onClick={fetchIssues} title="Refresh issues">
            <RefreshIcon />
          </button>
          <button
            className={`settings-btn ${configError ? 'settings-btn-error' : ''}`}
            onClick={() => setIsSettingsOpen(true)}
            title={configError ? "Settings (config error)" : "Settings"}
          >
            <SettingsIcon />
            {configError && <span className="settings-error-dot" />}
          </button>
        </div>
      </header>

      <main className="kanban-board">
        {columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onEditClick={handleEditClick}
            onDeleteClick={handleDeleteClick}
            draggedTaskId={draggedTaskId}
            dropTarget={dropTarget}
          />
        ))}
      </main>

      <TaskFormModal
        isOpen={isAddModalOpen}
        task={null}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddTask}
      />

      <TaskFormModal
        isOpen={taskToEdit !== null}
        task={taskToEdit}
        onClose={() => setTaskToEdit(null)}
        onSubmit={handleEditTask}
      />

      <DeleteConfirmModal
        isOpen={taskToDelete !== null}
        task={taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={handleDeleteConfirm}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        currentRepo={currentRepo}
        currentClosedIssueLimit={closedIssueLimit}
        currentTheme={theme}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSettingsSave}
        onThemeChange={handleThemeChange}
      />
    </div>
  );
}

export default App;
