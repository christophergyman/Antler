//
//  CardEditorView.swift
//  Antler
//

import SwiftUI
import SwiftData

struct CardEditorView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var allTags: [Tag]

    let card: Card?
    let initialStatus: CardStatus
    let initialPosition: CGPoint?

    @State private var title: String = ""
    @State private var cardDescription: String = ""
    @State private var status: CardStatus = .prepped
    @State private var selectedTags: Set<UUID> = []
    @State private var showingTagManager = false

    private var isNewCard: Bool { card == nil }

    init(card: Card? = nil, initialStatus: CardStatus = .prepped, initialPosition: CGPoint? = nil) {
        self.card = card
        self.initialStatus = initialStatus
        self.initialPosition = initialPosition
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Details") {
                    TextField("Title", text: $title)
                        .multilineTextAlignment(.center)
                        .labelsHidden()

                    #if os(macOS)
                    ZStack(alignment: .topLeading) {
                        if cardDescription.isEmpty {
                            Text("Description")
                                .foregroundColor(.secondary)
                                .padding(.top, 8)
                                .padding(.leading, 4)
                        }
                        TextEditor(text: $cardDescription)
                            .frame(minHeight: 100)
                    }
                    #else
                    TextField("Description", text: $cardDescription, axis: .vertical)
                        .lineLimit(4...10)
                    #endif
                }

                Section("Status") {
                    Picker("Status", selection: $status) {
                        ForEach(CardStatus.allCases, id: \.self) { status in
                            Text(status.displayName).tag(status)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }

                Section {
                    ForEach(allTags) { tag in
                        Button {
                            toggleTag(tag)
                        } label: {
                            HStack {
                                Circle()
                                    .fill(Color(hex: tag.colorHex))
                                    .frame(width: 12, height: 12)
                                Text(tag.name)
                                    .foregroundColor(.primary)
                                Spacer()
                                if selectedTags.contains(tag.id) {
                                    Image(systemName: "checkmark")
                                        .foregroundColor(.accentColor)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }

                    Button {
                        showingTagManager = true
                    } label: {
                        Label("Manage Tags", systemImage: "tag")
                    }
                } header: {
                    Text("Tags")
                }
            }
            .formStyle(.grouped)
            .navigationTitle(isNewCard ? "New Card" : "Edit Card")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isNewCard ? "Create" : "Save") {
                        save()
                    }
                    .disabled(title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .sheet(isPresented: $showingTagManager) {
                TagManagerView()
            }
            .onAppear {
                if let card = card {
                    title = card.title
                    cardDescription = card.cardDescription
                    status = card.status
                    selectedTags = Set(card.tags?.map(\.id) ?? [])
                } else {
                    status = initialStatus
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 400, minHeight: 500)
        #endif
    }

    private func toggleTag(_ tag: Tag) {
        if selectedTags.contains(tag.id) {
            selectedTags.remove(tag.id)
        } else {
            selectedTags.insert(tag.id)
        }
    }

    private func save() {
        let targetCard: Card
        if let existing = card {
            targetCard = existing
        } else {
            targetCard = Card()
            if let pos = initialPosition {
                targetCard.positionX = pos.x
                targetCard.positionY = pos.y
            }
            modelContext.insert(targetCard)
        }

        targetCard.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        targetCard.cardDescription = cardDescription.trimmingCharacters(in: .whitespacesAndNewlines)
        targetCard.status = status

        // Update tags
        let selectedTagObjects = allTags.filter { selectedTags.contains($0.id) }
        targetCard.tags = selectedTagObjects

        dismiss()
    }
}
