//
//  TagManagerView.swift
//  Antler
//

import SwiftUI
import SwiftData

struct TagManagerView: View {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.dismiss) private var dismiss
    @Query private var tags: [Tag]

    @State private var newTagName = ""
    @State private var selectedColorHex = Color.tagColorHexes[0]
    @State private var editingTag: Tag?

    var body: some View {
        NavigationStack {
            List {
                Section("Create New Tag") {
                    HStack {
                        TextField("Tag name", text: $newTagName)

                        Menu {
                            ForEach(Color.tagColorHexes, id: \.self) { hex in
                                Button {
                                    selectedColorHex = hex
                                } label: {
                                    HStack {
                                        Circle()
                                            .fill(Color(hex: hex))
                                            .frame(width: 16, height: 16)
                                        if hex == selectedColorHex {
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                            }
                        } label: {
                            Circle()
                                .fill(Color(hex: selectedColorHex))
                                .frame(width: 24, height: 24)
                        }

                        Button {
                            createTag()
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .foregroundColor(.accentColor)
                        }
                        .disabled(newTagName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .buttonStyle(.plain)
                    }
                }

                Section("Existing Tags") {
                    if tags.isEmpty {
                        Text("No tags yet")
                            .foregroundColor(.secondary)
                    } else {
                        ForEach(tags) { tag in
                            HStack {
                                Circle()
                                    .fill(Color(hex: tag.colorHex))
                                    .frame(width: 12, height: 12)
                                Text(tag.name)
                                Spacer()
                                Text("\(tag.cards?.count ?? 0) cards")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            .contextMenu {
                                Button("Delete", role: .destructive) {
                                    deleteTag(tag)
                                }
                            }
                        }
                        .onDelete(perform: deleteTags)
                    }
                }
            }
            .navigationTitle("Manage Tags")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 350, minHeight: 400)
        #endif
    }

    private func createTag() {
        let name = newTagName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { return }

        let tag = Tag(name: name, colorHex: selectedColorHex)
        modelContext.insert(tag)
        newTagName = ""
        // Rotate to next color
        if let currentIndex = Color.tagColorHexes.firstIndex(of: selectedColorHex) {
            selectedColorHex = Color.tagColorHexes[(currentIndex + 1) % Color.tagColorHexes.count]
        }
    }

    private func deleteTag(_ tag: Tag) {
        modelContext.delete(tag)
    }

    private func deleteTags(at offsets: IndexSet) {
        for index in offsets {
            modelContext.delete(tags[index])
        }
    }
}
