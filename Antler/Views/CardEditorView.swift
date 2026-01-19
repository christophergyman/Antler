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
    @State private var branchName: String = ""
    @State private var status: CardStatus = .prepped
    @State private var selectedTags: Set<UUID> = []
    @State private var showingTagManager = false
    @State private var selectedIssue: GitHubIssue?
    @State private var branchManuallyEdited = false

    private var isNewCard: Bool { card == nil }

    private static let issueTemplate = """
    ## Is your feature request related to a problem?


    ## Describe the solution you'd like


    ## Describe alternatives you've considered


    ## Additional context

    """

    init(card: Card? = nil, initialStatus: CardStatus = .prepped, initialPosition: CGPoint? = nil) {
        self.card = card
        self.initialStatus = initialStatus
        self.initialPosition = initialPosition
    }

    var body: some View {
        NavigationStack {
            Form {
                if isNewCard {
                    Section("Import from GitHub Issue") {
                        Picker("Issue", selection: $selectedIssue) {
                            Text("None").tag(nil as GitHubIssue?)
                            ForEach(MockGitHubData.issues) { issue in
                                Text(issue.displayTitle).tag(issue as GitHubIssue?)
                            }
                        }
                        .onChange(of: selectedIssue) { _, newIssue in
                            if let issue = newIssue {
                                title = issue.title
                                cardDescription = issue.body
                                branchName = BranchNameGenerator.generate(from: issue.title)
                                branchManuallyEdited = false
                            }
                        }
                    }
                }

                Section("Details") {
                    TextField("Title", text: $title)
                        .onChange(of: title) { _, newTitle in
                            if !branchManuallyEdited {
                                branchName = BranchNameGenerator.generate(from: newTitle)
                            }
                        }

                    HStack {
                        Image(systemName: "arrow.triangle.branch")
                            .foregroundColor(.secondary)
                        TextField("Branch name", text: $branchName)
                            .font(.system(.body, design: .monospaced))
                            .onChange(of: branchName) { oldValue, newValue in
                                let expectedBranch = BranchNameGenerator.generate(from: title)
                                if newValue != expectedBranch && !oldValue.isEmpty {
                                    branchManuallyEdited = true
                                }
                            }
                    }

                    #if os(macOS)
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Description")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Spacer()
                            if cardDescription.isEmpty && selectedIssue == nil {
                                Button("Insert template") {
                                    cardDescription = Self.issueTemplate
                                }
                                .buttonStyle(.borderless)
                                .font(.subheadline)
                            }
                        }
                        TextEditor(text: $cardDescription)
                            .font(.system(.body, design: .monospaced))
                            .frame(minHeight: 150)
                    }
                    #else
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Description")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                            Spacer()
                            if cardDescription.isEmpty && selectedIssue == nil {
                                Button("Insert template") {
                                    cardDescription = Self.issueTemplate
                                }
                                .buttonStyle(.borderless)
                                .font(.subheadline)
                            }
                        }
                        TextField("Description", text: $cardDescription, axis: .vertical)
                            .font(.system(.body, design: .monospaced))
                            .lineLimit(6...15)
                    }
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
                    branchName = card.branchName
                    status = card.status
                    selectedTags = Set(card.tags?.map(\.id) ?? [])
                    branchManuallyEdited = !card.branchName.isEmpty
                } else {
                    status = initialStatus
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 450, minHeight: 550)
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
        targetCard.branchName = branchName.trimmingCharacters(in: .whitespacesAndNewlines)
        targetCard.status = status

        let selectedTagObjects = allTags.filter { selectedTags.contains($0.id) }
        targetCard.tags = selectedTagObjects

        dismiss()
    }
}
