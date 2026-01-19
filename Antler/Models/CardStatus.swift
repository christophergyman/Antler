//
//  CardStatus.swift
//  Antler
//

import Foundation

enum CardStatus: String, CaseIterable, Codable {
    case prepped = "Prepped"
    case inProgress = "In-progress"
    case mergeReady = "Merge ready"

    var displayName: String {
        rawValue
    }
}
