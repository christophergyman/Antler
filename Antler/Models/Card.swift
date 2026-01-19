//
//  Card.swift
//  Antler
//

import Foundation
import SwiftData

@Model
final class Card {
    var id: UUID
    var title: String
    var cardDescription: String
    var statusRaw: String
    var positionX: Double
    var positionY: Double
    var sortOrder: Int
    var createdAt: Date
    @Relationship(deleteRule: .nullify, inverse: \Tag.cards)
    var tags: [Tag]?

    var status: CardStatus {
        get {
            CardStatus(rawValue: statusRaw) ?? .prepped
        }
        set {
            statusRaw = newValue.rawValue
        }
    }

    init(
        title: String = "",
        cardDescription: String = "",
        status: CardStatus = .prepped,
        positionX: Double = 100,
        positionY: Double = 100,
        sortOrder: Int = 0
    ) {
        self.id = UUID()
        self.title = title
        self.cardDescription = cardDescription
        self.statusRaw = status.rawValue
        self.positionX = positionX
        self.positionY = positionY
        self.sortOrder = sortOrder
        self.createdAt = Date()
        self.tags = []
    }
}
