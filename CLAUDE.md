# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands

```bash
# Build via Xcode command line
xcodebuild -scheme Antler -destination 'platform=macOS' build

# Open in Xcode
open Antler.xcodeproj
```

## Architecture Overview

Antler is a macOS/iOS Kanban board app built with SwiftUI and SwiftData. Users organize task cards across status columns (Prepped → In-Progress → Merge Ready) or on a freeform canvas.

### Data Layer

- **SwiftData** for persistence, configured in `AntlerApp.swift`
- **Card** model stores title, description, branchName, status (as raw string), position coordinates, sortOrder, and tags relationship
- **Tag** model with name and colorHex; relationship to Card uses `.nullify` delete rule
- **CardStatus** enum backed by string raw values for SwiftData compatibility

### View Hierarchy

```
AntlerApp (entry point, ModelContainer setup)
└── ContentView (root state: view mode, editor state)
    ├── ColumnView → ColumnContainerView → CardView (status-based columns)
    └── FreeformCanvasView → CardView (spatial positioning)
    └── CardEditorView (sheet for new/edit)
    └── TagManagerView (sheet for tag CRUD)
```

### Key Patterns

- **@Query** for reactive data fetching from SwiftData
- **EditorState enum** in ContentView controls sheet presentation (`.newCard(position)` or `.editCard(Card)`)
- **ViewMode enum** toggles between `.columns` and `.freeform` views
- **CardTransfer** (Transferable) enables drag-drop with custom UTType `cgym.antler.card`
- **NotificationCenter** triggers new card creation from macOS menu bar (⌘N)

### Platform Conditionals

Use `#if os(macOS)` for platform-specific UI. macOS uses TextEditor for description; iOS uses TextField with axis.

### Utilities

- **Color+Hex.swift**: Hex color parsing and 10 preset tag colors
- **BranchNameGenerator.swift**: Converts titles to git branch names (e.g., "Add feature" → "feature/add-feature")
- **MockGitHubData.swift**: Sample GitHub issues for import testing

## Non-Obvious Behaviors

- Card positions in freeform view are absolute coordinates, not relative to window size
- Branch name auto-generation stops after manual edit (tracked by `branchManuallyEdited` flag)
- Adding `branchName` or other new properties to Card requires a default value at declaration level for SwiftData migration
