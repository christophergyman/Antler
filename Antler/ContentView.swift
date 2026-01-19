//
//  ContentView.swift
//  Antler
//

import SwiftUI
import SwiftData

enum ViewMode: String, CaseIterable {
    case columns = "Columns"
    case freeform = "Freeform"

    var icon: String {
        switch self {
        case .columns: return "rectangle.split.3x1"
        case .freeform: return "rectangle.on.rectangle"
        }
    }
}

enum EditorState: Identifiable {
    case newCard(position: CGPoint?)
    case editCard(Card)

    var id: String {
        switch self {
        case .newCard(let pos):
            return "new-\(pos?.x ?? 0)-\(pos?.y ?? 0)"
        case .editCard(let card):
            return card.id.uuidString
        }
    }
}

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var cards: [Card]

    @State private var viewMode: ViewMode = .columns
    @State private var editorState: EditorState?
    @State private var showingTagManager = false

    var body: some View {
        Group {
            switch viewMode {
            case .columns:
                ColumnView(onEditCard: { card in
                    editorState = .editCard(card)
                })
            case .freeform:
                FreeformCanvasView(
                    onEditCard: { card in
                        editorState = .editCard(card)
                    },
                    onNewCard: { position in
                        editorState = .newCard(position: position)
                    }
                )
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                Picker("View Mode", selection: $viewMode) {
                    ForEach(ViewMode.allCases, id: \.self) { mode in
                        Label(mode.rawValue, systemImage: mode.icon)
                            .tag(mode)
                    }
                }
                .pickerStyle(.segmented)
                .help("Switch between column and freeform views")

                Button {
                    showingTagManager = true
                } label: {
                    Label("Manage Tags", systemImage: "tag")
                }
                .help("Manage tags")

                Button {
                    editorState = .newCard(position: nil)
                } label: {
                    Label("New Card", systemImage: "plus")
                }
                .help("Create a new card")
            }
        }
        .sheet(item: $editorState) { state in
            switch state {
            case .newCard(let position):
                CardEditorView(card: nil, initialStatus: .prepped, initialPosition: position)
            case .editCard(let card):
                CardEditorView(card: card)
            }
        }
        .sheet(isPresented: $showingTagManager) {
            TagManagerView()
        }
        .onReceive(NotificationCenter.default.publisher(for: .newCard)) { _ in
            editorState = .newCard(position: nil)
        }
        #if os(macOS)
        .frame(minWidth: 900, minHeight: 600)
        #endif
    }
}

#Preview {
    ContentView()
        .modelContainer(for: [Card.self, Tag.self], inMemory: true)
}
