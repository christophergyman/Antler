# Git Worktrees: High-Level Architecture Overview

This document provides a conceptual overview of Git worktrees for porting the tmux-worktree functionality to a React UI.

---

## What Are Git Worktrees?

Git worktrees allow you to have **multiple working directories** from a single repository, each checked out to a different branch. This eliminates the need to stash changes or commit WIP code when switching contexts.

```
Traditional Git:        Git Worktrees:

repo/                   repo/              (main branch)
├── .git/               ├── .git/
├── src/                ├── .worktrees/
└── (one branch)        │   ├── feature-auth/    (feature/auth branch)
                        │   ├── bugfix-login/    (bugfix/login branch)
                        │   └── hotfix-crash/    (hotfix/crash branch)
                        └── src/
```

Each worktree is a fully functional checkout that shares the same `.git` database.

---

## Core Git Commands

### 1. Create Worktree from Existing Branch
```bash
git worktree add <path> <branch>
# Example: git worktree add .worktrees/feature-auth feature/auth
```

### 2. Create Worktree with New Branch
```bash
git worktree add -b <new-branch> <path> <base-branch>
# Example: git worktree add -b feature/auth .worktrees/feature-auth main
```

### 3. List All Worktrees
```bash
git worktree list              # Human-readable
git worktree list --porcelain  # Machine-readable (for parsing)
```

### 4. Remove Worktree
```bash
git worktree remove <path>
git worktree prune             # Clean up stale metadata
```

---

## Directory Structure

The application stores worktrees in a `.worktrees` subdirectory at the repository root:

```
/path/to/repo/
├── .git/
│   └── worktrees/           # Git's internal worktree metadata
│       ├── feature-auth/
│       └── bugfix-login/
├── .worktrees/              # User-facing worktree checkouts
│   ├── feature-auth/        # Full checkout of feature/auth branch
│   │   ├── src/
│   │   └── package.json
│   └── bugfix-login/        # Full checkout of bugfix/login branch
│       ├── src/
│       └── package.json
└── src/                     # Main worktree (main branch)
```

**Important**: The `.worktrees/` directory is NOT the same as Git's internal `.git/worktrees/`. The former contains actual file checkouts; the latter contains metadata.

---

## Key Operations to Implement

### Operation 1: Get Repository Root

Works from both main repo and any worktree:

```javascript
// Git command
const gitDir = await exec('git rev-parse --absolute-git-dir');

// If in worktree: /repo/.git/worktrees/feature-auth
// If in main:     /repo/.git

// Strip worktree path to get repo root
const repoRoot = gitDir.replace(/\/\.git\/worktrees\/.*$/, '').replace(/\/\.git$/, '');
```

### Operation 2: Create Worktree from Existing Branch

```javascript
async function createWorktreeFromBranch(branchName) {
  // 1. Check if worktree already exists for this branch
  const existing = await getWorktreeForBranch(branchName);
  if (existing) throw new Error(`Worktree already exists: ${existing}`);

  // 2. Sanitize branch name for directory (feature/auth → feature-auth)
  const dirName = branchName.replace(/\//g, '-');
  const worktreePath = `${repoRoot}/.worktrees/${dirName}`;

  // 3. Create worktree
  await exec(`git worktree add "${worktreePath}" "${branchName}"`);

  return worktreePath;
}
```

### Operation 3: Create Worktree with New Branch

```javascript
async function createWorktreeWithNewBranch(branchName) {
  // 1. Validate branch name
  if (!/^[a-zA-Z0-9._/-]+$/.test(branchName)) {
    throw new Error('Invalid branch name');
  }

  // 2. Get default branch (main/master)
  const defaultBranch = await getDefaultBranch();

  // 3. Sanitize for directory name
  const dirName = branchName.replace(/\//g, '-');
  const worktreePath = `${repoRoot}/.worktrees/${dirName}`;

  // 4. Create worktree with new branch from default branch
  await exec(`git worktree add -b "${branchName}" "${worktreePath}" "${defaultBranch}"`);

  return worktreePath;
}
```

### Operation 4: Get Default Branch

```javascript
async function getDefaultBranch() {
  // Try origin/HEAD first
  try {
    const ref = await exec('git symbolic-ref refs/remotes/origin/HEAD');
    return ref.replace('refs/remotes/origin/', '').trim();
  } catch {
    // Fallback: check if main exists, then master
    const branches = await exec('git branch --list main master');
    if (branches.includes('main')) return 'main';
    if (branches.includes('master')) return 'master';
    throw new Error('Could not determine default branch');
  }
}
```

### Operation 5: List Worktrees

```javascript
async function listWorktrees() {
  const output = await exec('git worktree list --porcelain');

  // Parse porcelain format:
  // worktree /path/to/repo
  // branch refs/heads/main
  //
  // worktree /path/to/repo/.worktrees/feature-auth
  // branch refs/heads/feature/auth

  const worktrees = [];
  let current = {};

  for (const line of output.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current.path) worktrees.push(current);
      current = { path: line.slice(9) };
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice(7).replace('refs/heads/', '');
    } else if (line === '') {
      if (current.path) worktrees.push(current);
      current = {};
    }
  }

  return worktrees;
  // Returns: [{ path: '/repo', branch: 'main' }, { path: '/repo/.worktrees/feature-auth', branch: 'feature/auth' }]
}
```

### Operation 6: Delete Worktree (Keep Branch)

```javascript
async function deleteWorktree(worktreePath) {
  await exec(`git worktree remove "${worktreePath}"`);
  await exec('git worktree prune');
}
```

### Operation 7: Delete Worktree and Branch

```javascript
async function deleteWorktreeAndBranch(worktreePath) {
  // 1. Get branch name before deleting
  const branch = await getBranchForWorktree(worktreePath);

  // 2. Protect main/master
  if (branch === 'main' || branch === 'master') {
    throw new Error('Cannot delete protected branch');
  }

  // 3. Remove worktree
  await exec(`git worktree remove "${worktreePath}"`);
  await exec('git worktree prune');

  // 4. Try safe delete, then force if needed
  try {
    await exec(`git branch -d "${branch}"`);
  } catch (e) {
    // Has unmerged changes - require user confirmation for force delete
    const confirmed = await confirmForceDelete(branch);
    if (confirmed) {
      await exec(`git branch -D "${branch}"`);
    }
  }
}
```

### Operation 8: Get Remote Branches

```javascript
async function getRemoteBranches() {
  const output = await exec("git branch -r --format='%(refname:short)'");
  return output
    .split('\n')
    .filter(b => !b.endsWith('/HEAD'))
    .map(b => {
      // Strip remote prefix: origin/feature → feature
      const parts = b.split('/');
      return parts.length > 1 ? parts.slice(1).join('/') : b;
    });
}
```

### Operation 9: Check for Duplicate Worktree

```javascript
async function getWorktreeForBranch(branchName) {
  const worktrees = await listWorktrees();
  const existing = worktrees.find(wt => wt.branch === branchName);
  return existing?.path || null;
}
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      React UI Layer                          │
├─────────────────────────────────────────────────────────────┤
│  WorktreePicker     │  BranchSelector    │  StatusDisplay   │
│  - List worktrees   │  - Remote branches │  - Current branch│
│  - Switch/delete    │  - Create new      │  - Repo name     │
└─────────┬───────────┴─────────┬──────────┴─────────┬────────┘
          │                     │                    │
          ▼                     ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Git Service Layer                         │
├─────────────────────────────────────────────────────────────┤
│  listWorktrees()        │  createWorktree()     │ getRepoInfo()│
│  deleteWorktree()       │  getRemoteBranches()  │ getBranch()  │
│  getWorktreeForBranch() │  getDefaultBranch()   │              │
└─────────┬───────────────┴─────────┬─────────────┴──────────────┘
          │                         │
          ▼                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Git Commands (exec)                       │
├─────────────────────────────────────────────────────────────┤
│  git worktree add/remove/list/prune                         │
│  git branch -r/-d/-D/--list                                  │
│  git rev-parse --git-dir/--abbrev-ref                        │
│  git symbolic-ref                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## State Model for React

```typescript
interface Worktree {
  path: string;           // /repo/.worktrees/feature-auth
  branch: string;         // feature/auth
  isMain: boolean;        // true for main worktree
  displayName: string;    // feature-auth (sanitized)
}

interface Repository {
  root: string;           // /path/to/repo
  name: string;           // repo (basename)
  defaultBranch: string;  // main or master
  currentBranch: string;  // Currently checked out branch
}

interface AppState {
  repository: Repository | null;
  worktrees: Worktree[];
  remoteBranches: string[];
  selectedWorktree: string | null;
  isLoading: boolean;
  error: string | null;
}
```

---

## UI Actions to Implement

| Action | Description | Git Operation |
|--------|-------------|---------------|
| **Create from branch** | Select remote branch → create worktree | `git worktree add <path> <branch>` |
| **Create new branch** | Input name → create branch + worktree from main | `git worktree add -b <branch> <path> main` |
| **List worktrees** | Show all worktrees with branch info | `git worktree list --porcelain` |
| **Switch worktree** | Navigate to different worktree | Change directory context |
| **Delete worktree** | Remove checkout, keep branch | `git worktree remove` + `prune` |
| **Delete all** | Remove checkout AND branch | Above + `git branch -d/-D` |
| **Refresh** | Update worktree/branch lists | Re-run list commands |

---

## Naming Conventions

### Branch Name → Directory Name
```javascript
function branchToDir(branch) {
  return branch.replace(/\//g, '-');
}
// feature/auth → feature-auth
// bugfix/login → bugfix-login
```

### Branch Name → Session/Display Name
```javascript
function branchToDisplayName(branch) {
  return branch.replace(/[./:]/g, '-');
}
// feature/auth → feature-auth
// v1.0.0 → v1-0-0
// fix:urgent → fix-urgent
```

---

## Error States to Handle

1. **Not in a git repository** - Prompt user to open a repo
2. **Worktree already exists** - Show existing worktree location
3. **Invalid branch name** - Validate before submission
4. **Branch has unmerged changes** - Confirm force delete
5. **Protected branch deletion** - Block main/master deletion
6. **Worktree has uncommitted changes** - Warn before deletion
7. **Network errors** - Handle fetch failures gracefully

---

## Summary

The core concept is simple:
1. **Worktrees share a single `.git` database** but have separate working directories
2. **Each worktree = one branch checkout** in its own folder
3. **`.worktrees/` is the convention** for organizing worktree directories
4. **Branch names are sanitized** (`/` → `-`) for filesystem compatibility
5. **New branches always branch from main** to avoid nested feature branches
6. **Cleanup requires both `worktree remove` AND `worktree prune`**

For a React UI, you'd replace the tmux session management with:
- Tab/panel switching
- Recent worktrees list
- File explorer integration
- Terminal integration (if applicable)
