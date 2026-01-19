//
//  ColumnContainerView.swift
//  Antler
//

import SwiftUI
import SwiftData

struct ColumnContainerView: View {
    let status: CardStatus
    let cards: [Card]
    let onCardTap: (Card) -> Void
    let onCardDelete: (Card) -> Void
    let onDropCard: (Card) -> Void

    @State private var isTargeted = false

    private var columnBackgroundColor: Color {
        #if os(macOS)
        Color(nsColor: .windowBackgroundColor).opacity(0.5)
        #else
        Color(uiColor: .systemBackground).opacity(0.5)
        #endif
    }

    private var columnColor: Color {
        switch status {
        case .prepped:
            return .blue
        case .inProgress:
            return .orange
        case .mergeReady:
            return .green
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Circle()
                    .fill(columnColor)
                    .frame(width: 10, height: 10)
                Text(status.displayName)
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
                Text("\(cards.count)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.15))
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(columnColor.opacity(0.1))

            // Cards
            ScrollView {
                LazyVStack(spacing: 12) {
                    ForEach(cards.sorted(by: { $0.sortOrder < $1.sortOrder })) { card in
                        CardView(
                            card: card,
                            onTap: { onCardTap(card) },
                            onDelete: { onCardDelete(card) }
                        )
                    }
                }
                .padding(12)
            }
            .frame(maxHeight: .infinity)
        }
        .background {
            RoundedRectangle(cornerRadius: 16)
                .fill(columnBackgroundColor)
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay {
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(isTargeted ? columnColor : Color.clear, lineWidth: 2)
        }
        .dropDestination(for: CardTransfer.self) { items, _ in
            guard let transfer = items.first else { return false }
            // Find and update the card
            if let card = cards.first(where: { $0.id == transfer.cardID }) {
                onDropCard(card)
                return true
            }
            return false
        } isTargeted: { targeted in
            withAnimation(.easeInOut(duration: 0.2)) {
                isTargeted = targeted
            }
        }
    }
}
