//
//  FreeformCanvasView.swift
//  Antler
//

import SwiftUI
import SwiftData

struct FreeformCanvasView: View {
    @Environment(\.modelContext) private var modelContext
    @Query private var cards: [Card]

    var onEditCard: (Card) -> Void
    var onNewCard: (CGPoint?) -> Void

    @State private var draggedCard: Card?
    @State private var dragOffset: CGSize = .zero
    @State private var canvasOffset: CGSize = .zero
    @State private var lastCanvasOffset: CGSize = .zero
    @State private var scale: CGFloat = 1.0

    private let cardWidth: CGFloat = 280

    private var canvasBackgroundColor: Color {
        #if os(macOS)
        Color(nsColor: .windowBackgroundColor)
        #else
        Color(uiColor: .systemBackground)
        #endif
    }

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Background grid
                Canvas { context, size in
                    let gridSize: CGFloat = 50 * scale
                    let offsetX = canvasOffset.width.truncatingRemainder(dividingBy: gridSize)
                    let offsetY = canvasOffset.height.truncatingRemainder(dividingBy: gridSize)

                    context.stroke(
                        Path { path in
                            // Vertical lines
                            var x = offsetX
                            while x < size.width {
                                path.move(to: CGPoint(x: x, y: 0))
                                path.addLine(to: CGPoint(x: x, y: size.height))
                                x += gridSize
                            }
                            // Horizontal lines
                            var y = offsetY
                            while y < size.height {
                                path.move(to: CGPoint(x: 0, y: y))
                                path.addLine(to: CGPoint(x: size.width, y: y))
                                y += gridSize
                            }
                        },
                        with: .color(.gray.opacity(0.15)),
                        lineWidth: 1
                    )
                }

                // Cards
                ForEach(cards) { card in
                    cardView(for: card)
                        .position(cardPosition(for: card, in: geometry.size))
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(canvasBackgroundColor)
            .contentShape(Rectangle())
            .gesture(canvasDragGesture)
            .contextMenu {
                Button("New Card Here") {
                    // This won't have exact position, but we can set a default
                    onNewCard(CGPoint(x: 200, y: 200))
                }
            }
            .onTapGesture(count: 2) { location in
                let canvasX = (location.x - canvasOffset.width - geometry.size.width / 2) / scale
                let canvasY = (location.y - canvasOffset.height - geometry.size.height / 2) / scale
                onNewCard(CGPoint(x: canvasX, y: canvasY))
            }
            .dropDestination(for: CardTransfer.self) { items, location in
                guard let transfer = items.first,
                      let card = cards.first(where: { $0.id == transfer.cardID }) else {
                    return false
                }
                // Convert drop location to canvas coordinates
                let canvasX = (location.x - canvasOffset.width - geometry.size.width / 2) / scale
                let canvasY = (location.y - canvasOffset.height - geometry.size.height / 2) / scale
                card.positionX = canvasX
                card.positionY = canvasY
                return true
            }
        }
    }

    private func cardView(for card: Card) -> some View {
        CardView(
            card: card,
            onTap: {
                onEditCard(card)
            },
            onDelete: {
                withAnimation {
                    modelContext.delete(card)
                }
            }
        )
        .frame(width: cardWidth)
        .gesture(cardDragGesture(for: card))
    }

    private func cardPosition(for card: Card, in size: CGSize) -> CGPoint {
        let baseX = card.positionX * scale + size.width / 2 + canvasOffset.width
        let baseY = card.positionY * scale + size.height / 2 + canvasOffset.height

        if draggedCard?.id == card.id {
            return CGPoint(x: baseX + dragOffset.width, y: baseY + dragOffset.height)
        }
        return CGPoint(x: baseX, y: baseY)
    }

    private func cardDragGesture(for card: Card) -> some Gesture {
        DragGesture()
            .onChanged { value in
                if draggedCard == nil {
                    draggedCard = card
                }
                dragOffset = value.translation
            }
            .onEnded { value in
                // Update card position
                card.positionX += value.translation.width / scale
                card.positionY += value.translation.height / scale
                draggedCard = nil
                dragOffset = .zero
            }
    }

    private var canvasDragGesture: some Gesture {
        DragGesture()
            .onChanged { value in
                canvasOffset = CGSize(
                    width: lastCanvasOffset.width + value.translation.width,
                    height: lastCanvasOffset.height + value.translation.height
                )
            }
            .onEnded { _ in
                lastCanvasOffset = canvasOffset
            }
    }
}
