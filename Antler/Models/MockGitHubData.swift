//
//  MockGitHubData.swift
//  Antler
//

import Foundation

struct GitHubIssue: Identifiable, Hashable {
    let id: Int
    let number: Int
    let title: String
    let body: String
    let labels: [String]
    let createdAt: Date

    var displayTitle: String { "#\(number) - \(title)" }
}

enum MockGitHubData {
    static let issues: [GitHubIssue] = [
        GitHubIssue(
            id: 1,
            number: 42,
            title: "Add dark mode support",
            body: """
            ## Is your feature request related to a problem?
            Users have requested the ability to switch between light and dark themes. Currently, the app only supports the system default, which doesn't give users control over their preferred appearance.

            ## Describe the solution you'd like
            Add a toggle in the settings to switch between light mode, dark mode, and system default. The theme should persist across app launches.

            ## Describe alternatives you've considered
            We could also add custom accent colors alongside the dark mode toggle for more personalization.

            ## Additional context
            This is one of the most requested features based on user feedback. Many users work late and prefer dark interfaces.
            """,
            labels: ["enhancement", "ui"],
            createdAt: Calendar.current.date(byAdding: .day, value: -5, to: Date())!
        ),
        GitHubIssue(
            id: 2,
            number: 57,
            title: "Implement card sorting by priority",
            body: """
            ## Is your feature request related to a problem?
            When there are many cards on the board, it's difficult to identify which tasks are most urgent. Cards are currently only ordered by creation date.

            ## Describe the solution you'd like
            Add a priority field (High, Medium, Low) to cards and allow sorting/filtering by priority level. High priority cards could have a visual indicator.

            ## Describe alternatives you've considered
            Using colored borders or badges to indicate priority without adding a dedicated field.

            ## Additional context
            This would help teams quickly identify blockers and critical tasks during standup meetings.
            """,
            labels: ["enhancement", "priority"],
            createdAt: Calendar.current.date(byAdding: .day, value: -3, to: Date())!
        ),
        GitHubIssue(
            id: 3,
            number: 63,
            title: "Fix card position reset on window resize",
            body: """
            ## Is your feature request related to a problem?
            When the window is resized, cards in the freeform canvas view sometimes jump to unexpected positions or overlap with each other.

            ## Describe the solution you'd like
            Card positions should remain stable during window resize. If cards would go off-screen, they should be clamped to the visible area.

            ## Describe alternatives you've considered
            Implementing a snap-to-grid feature that would normalize positions on resize.

            ## Additional context
            Reproducible on macOS when resizing the window quickly. See attached screen recording.
            """,
            labels: ["bug", "canvas"],
            createdAt: Calendar.current.date(byAdding: .day, value: -2, to: Date())!
        ),
        GitHubIssue(
            id: 4,
            number: 71,
            title: "Add keyboard shortcuts for card management",
            body: """
            ## Is your feature request related to a problem?
            Power users have to reach for the mouse for common operations like creating cards, changing status, or deleting cards.

            ## Describe the solution you'd like
            Implement keyboard shortcuts:
            - ⌘N: New card
            - ⌘⌫: Delete selected card
            - ⌘1/2/3: Change status to Prepped/In-Progress/Merge Ready
            - ⌘E: Edit selected card

            ## Describe alternatives you've considered
            A command palette (⌘K) that lists all available actions.

            ## Additional context
            This would significantly improve workflow speed for keyboard-centric users.
            """,
            labels: ["enhancement", "accessibility"],
            createdAt: Calendar.current.date(byAdding: .day, value: -1, to: Date())!
        ),
        GitHubIssue(
            id: 5,
            number: 78,
            title: "Export cards to Markdown file",
            body: """
            ## Is your feature request related to a problem?
            There's no way to share or backup board contents outside the app. Users want to export their cards for documentation or migration purposes.

            ## Describe the solution you'd like
            Add an export option that generates a Markdown file with all cards organized by status. Each card should include title, description, tags, and branch name.

            ## Describe alternatives you've considered
            JSON export for data backup and re-import functionality.

            ## Additional context
            The Markdown format would make it easy to paste into GitHub wikis, Notion, or other documentation tools.
            """,
            labels: ["enhancement", "export"],
            createdAt: Date()
        )
    ]
}
