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

struct ContentView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var cards: [Card]

    @State private var viewMode: ViewMode = .columns
    @State private var selectedCard: Card?
    @State private var showingEditor = false
    @State private var newCardPosition: CGPoint?
    @State private var showingTagManager = false

    var body: some View {
        Group {
            switch viewMode {
            case .columns:
                ColumnView(selectedCard: $selectedCard, showingEditor: $showingEditor)
            case .freeform:
                FreeformCanvasView(
                    selectedCard: $selectedCard,
                    showingEditor: $showingEditor,
                    newCardPosition: $newCardPosition
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
                    newCardPosition = nil
                    selectedCard = nil
                    showingEditor = true
                } label: {
                    Label("New Card", systemImage: "plus")
                }
                .help("Create a new card")
            }
        }
        .sheet(isPresented: $showingEditor) {
            CardEditorView(
                card: selectedCard,
                initialStatus: .prepped,
                initialPosition: newCardPosition
            )
        }
        .sheet(isPresented: $showingTagManager) {
            TagManagerView()
        }
        .onReceive(NotificationCenter.default.publisher(for: .newCard)) { _ in
            newCardPosition = nil
            selectedCard = nil
            showingEditor = true
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
