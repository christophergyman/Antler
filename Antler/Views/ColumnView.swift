//
//  ColumnView.swift
//  Antler
//

import SwiftUI
import SwiftData

struct ColumnView: View {
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \Card.sortOrder) private var allCards: [Card]

    @Binding var selectedCard: Card?
    @Binding var showingEditor: Bool

    var body: some View {
        HStack(spacing: 16) {
            ForEach(CardStatus.allCases, id: \.self) { status in
                ColumnContainerView(
                    status: status,
                    cards: allCards.filter { $0.status == status },
                    onCardTap: { card in
                        selectedCard = card
                        showingEditor = true
                    },
                    onCardDelete: { card in
                        deleteCard(card)
                    },
                    onDropCard: { card in
                        moveCard(card, to: status)
                    }
                )
            }
        }
        .padding(16)
    }

    private func moveCard(_ card: Card, to status: CardStatus) {
        withAnimation {
            card.status = status
            // Update sort order to be at the end of the column
            let cardsInColumn = allCards.filter { $0.status == status }
            card.sortOrder = (cardsInColumn.map(\.sortOrder).max() ?? 0) + 1
        }
    }

    private func deleteCard(_ card: Card) {
        withAnimation {
            modelContext.delete(card)
        }
    }
}
