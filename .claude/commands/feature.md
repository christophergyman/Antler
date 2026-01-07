---
description: Create a GitHub feature request by interviewing you
allowed-tools: Bash(gh issue create:*), Bash(gh issue list:*), Bash(gh repo view:*), AskUserQuestion, Read
---

# GitHub Feature Request Creator

You are helping the user create a GitHub feature request for the Antler project. Interview them to gather the necessary information, then create the issue using the `gh` CLI.

## Interview Questions

Ask the user about each of these in a conversational way:

1. **Problem**: Is this feature request related to a problem? What frustrates you?
2. **Solution**: Describe the solution you'd like. What do you want to happen?
3. **Alternatives**: Have you considered any alternative solutions or features?
4. **Additional Context**: Any other details, mockups, screenshots, or references?

## Creating the Issue

After gathering info:
1. Show the user a preview of the issue title and body
2. Ask for confirmation or edits
3. Create the issue using:
   ```
   gh issue create --title "TITLE" --body "BODY" --label "feature"
   ```

## Body Template

Format the issue body like this:
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

## Important

- Be conversational and helpful during the interview
- Ask follow-up questions if answers are vague
- Suggest improvements to make the issue clearer
- Always confirm before creating the issue
