---
description: Review all code changes on your current branch vs main
allowed-tools: Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git status:*), Read, Grep, Glob
---

# Code Review: Branch Changes

Review all changes on the current branch compared to main/master. Provide detailed, actionable feedback.

## Step 1: Gather Context

Get the current branch and diff:
```
!`git branch --show-current`
```

## Step 2: Review All Changes

Analyze the diff between the current branch and main:
```
!`git diff main...HEAD`
```

If `main` doesn't exist, try `master`:
```
!`git diff master...HEAD 2>/dev/null || echo ""`
```

## Step 3: Provide Detailed Review

For each file changed, review and report on:

### 1. Bugs & Edge Cases
- Logic errors or flawed assumptions
- Missing null/undefined checks
- Unhandled error conditions
- Off-by-one errors
- Race conditions
- Missing input validation

### 2. Performance
- Inefficient algorithms (O(n²) when O(n) is possible)
- Unnecessary re-renders (React)
- Memory leaks or retained references
- N+1 query problems
- Missing memoization opportunities
- Large bundle impact

### 3. Security
- Injection vulnerabilities (SQL, XSS, command)
- Hardcoded secrets or credentials
- Insecure data handling
- Missing authentication/authorization checks
- Sensitive data exposure
- CORS or CSP issues

### 4. Code Quality
- Unclear or misleading names
- Functions doing too much
- Code duplication (DRY violations)
- Inconsistent patterns vs rest of codebase
- Missing or incorrect types (TypeScript)
- Dead code or unused imports

## Output Format

For each issue found, provide:

```
### [SEVERITY] Issue Title
**File:** `path/to/file.ts:line`
**Category:** Bug | Performance | Security | Quality

**Problem:**
Explain what's wrong and why it matters.

**Suggestion:**
Show how to fix it with a code example if helpful.
```

Severity levels:
- **CRITICAL**: Must fix before merge (security holes, data loss, crashes)
- **HIGH**: Should fix (bugs, significant performance issues)
- **MEDIUM**: Recommend fixing (code quality, minor perf)
- **LOW**: Consider fixing (style, minor improvements)

## Summary

End with a summary:
- Total issues by severity
- Overall assessment (ready to merge, needs work, major concerns)
- Top 3 priorities to address
