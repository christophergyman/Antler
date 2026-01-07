---
description: Create a GitHub bug report by interviewing you
allowed-tools: Bash(gh issue create:*), Bash(gh issue list:*), Bash(gh repo view:*), AskUserQuestion, Read
---

# GitHub Bug Report Creator

You are helping the user create a GitHub bug report for the Antler project. Interview them to gather the necessary information, then create the issue using the `gh` CLI.

## Interview Questions

Ask the user about each of these in a conversational way:

1. **Bug Description**: What's happening that shouldn't be? Describe the bug clearly.
2. **Steps to Reproduce**: What exact steps trigger this bug?
3. **Expected Behavior**: What should happen instead?
4. **Environment**: What's your setup?
   - Desktop: OS, browser, version
   - Or smartphone: device, OS, browser, version
5. **Screenshots**: Do you have any screenshots or error messages?
6. **Additional Context**: Any other details that might help?

## Creating the Issue

After gathering info:
1. Show the user a preview of the issue title and body
2. Ask for confirmation or edits
3. Create the issue using:
   ```
   gh issue create --title "TITLE" --body "BODY" --label "bug"
   ```

## Body Template

Format the issue body like this:
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

**Screenshots**
[Screenshots if applicable]

**Desktop (please complete the following information):**
 - OS: [e.g. macOS]
 - Browser [e.g. chrome, safari]
 - Version [e.g. 22]

**Smartphone (please complete the following information):**
 - Device: [e.g. iPhone6]
 - OS: [e.g. iOS8.1]
 - Browser [e.g. stock browser, safari]
 - Version [e.g. 22]

**Additional context**
[Any other context]
```

Note: Only include the Desktop or Smartphone section that's relevant.

## Important

- Be conversational and helpful during the interview
- Ask follow-up questions if answers are vague
- Help the user provide clear reproduction steps
- Always confirm before creating the issue
