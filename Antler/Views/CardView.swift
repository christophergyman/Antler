//
//  CardView.swift
//  Antler
//

import SwiftUI

struct CardView: View {
    let card: Card
    let onTap: () -> Void
    let onDelete: () -> Void

    @State private var isHovering = false

    private var cardBackgroundColor: Color {
        #if os(macOS)
        Color(nsColor: .textBackgroundColor)
        #else
        Color(uiColor: .secondarySystemGroupedBackground)
        #endif
    }

    private var statusColor: Color {
        switch card.status {
        case .prepped:
            return .blue
        case .inProgress:
            return .orange
        case .mergeReady:
            return .green
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Status row with drag handle
            HStack(spacing: 8) {
                // Drag handle (6-dot grid)
                Image(systemName: "rectangle.grid.2x2")
                    .font(.caption)
                    .foregroundColor(.secondary.opacity(0.5))

                // Status dot
                Circle()
                    .fill(statusColor)
                    .frame(width: 8, height: 8)

                Spacer()

                // Status label (uppercase)
                Text(card.status.displayName.uppercased())
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(statusColor)
            }

            // Title
            Text(card.title.isEmpty ? "Untitled" : card.title)
                .font(.headline)
                .lineLimit(2)

            // Description (only if not empty)
            if !card.cardDescription.isEmpty {
                Text(card.cardDescription)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: 12)
                .fill(cardBackgroundColor)
                .shadow(color: .black.opacity(isHovering ? 0.15 : 0.08), radius: isHovering ? 8 : 4, y: isHovering ? 4 : 2)
        }
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.accentColor.opacity(isHovering ? 0.5 : 0), lineWidth: 2)
        }
        .contentShape(RoundedRectangle(cornerRadius: 12))
        .onTapGesture(perform: onTap)
        .onHover { hovering in
            withAnimation(.easeInOut(duration: 0.15)) {
                isHovering = hovering
            }
        }
        .contextMenu {
            Button("Edit") {
                onTap()
            }
            Divider()
            Button("Delete", role: .destructive) {
                onDelete()
            }
        }
        .draggable(CardTransfer(cardID: card.id))
    }
}

// Flow layout for tags
struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        for (index, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + result.positions[index].x,
                                      y: bounds.minY + result.positions[index].y),
                          proposal: .unspecified)
        }
    }

    struct FlowResult {
        var size: CGSize = .zero
        var positions: [CGPoint] = []

        init(in maxWidth: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var rowHeight: CGFloat = 0

            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                if x + size.width > maxWidth, x > 0 {
                    x = 0
                    y += rowHeight + spacing
                    rowHeight = 0
                }
                positions.append(CGPoint(x: x, y: y))
                rowHeight = max(rowHeight, size.height)
                x += size.width + spacing
                self.size.width = max(self.size.width, x)
            }
            self.size.height = y + rowHeight
        }
    }
}

