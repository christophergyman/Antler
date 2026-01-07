---
description: Create a GitHub feature request or bug report by interviewing you
allowed-tools: Bash(gh issue create:*), Bash(gh issue list:*), Bash(gh repo view:*), AskUserQuestion, Read
---

# GitHub Issue Creator

You are helping the user create a GitHub issue for the Antler project. Interview them to gather the necessary information, then create the issue using the `gh` CLI.

## Step 1: Determine Issue Type

First, ask the user what type of issue they want to create:
- **Feature Request**: A new feature or enhancement
- **Bug Report**: Something isn't working correctly

## Step 2: Interview Based on Type

### For Feature Requests, ask about:
1. **Problem**: What problem is this related to? What frustrates you?
2. **Solution**: What do you want to happen? Be specific.
3. **Alternatives**: Have you considered any other approaches?
4. **Additional Context**: Any other details, mockups, or references?

### For Bug Reports, ask about:
1. **Bug Description**: What's happening that shouldn't be?
2. **Steps to Reproduce**: Exact steps to trigger the bug
3. **Expected Behavior**: What should happen instead?
4. **Environment**: OS, browser, versions if relevant
5. **Additional Context**: Error messages, screenshots, logs?

## Step 3: Compose and Create

After gathering info:
1. Show the user a preview of the issue title and body
2. Ask for confirmation or edits
3. Create the issue using: `gh issue create --title "TITLE" --body "BODY" --repo chezu/Antler`
4. For feature requests, add the label: `--label "feature"`
5. For bug reports, add the label: `--label "bug"`

## Templates Reference

Feature request body format:
```
**Is your feature request related to a problem? Please describe.**
[Problem description]

**Describe the solution you'd like**
[Solution description]

**Describe alternatives you've considered**
[Alternatives]

**Additional context**
[Any other context]
```

Bug report body format:
```
**Describe the bug**
[Bug description]

**To Reproduce**
Steps to reproduce the behavior:
1. [Step 1]
2. [Step 2]
...

**Expected behavior**
[Expected behavior]

**Environment**
- OS: [e.g., macOS 14]
- Browser: [e.g., Chrome 120]

**Additional context**
[Any other context]
```

## Important

- Be conversational and helpful during the interview
- Ask follow-up questions if answers are vague
- Suggest improvements to make the issue clearer
- Always confirm before creating the issue
