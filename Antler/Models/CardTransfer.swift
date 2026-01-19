//
//  CardTransfer.swift
//  Antler
//

import Foundation
import SwiftUI
import UniformTypeIdentifiers

struct CardTransfer: Codable, Transferable {
    let cardID: UUID

    static var transferRepresentation: some TransferRepresentation {
        CodableRepresentation(contentType: .cardTransfer)
    }
}

extension UTType {
    static var cardTransfer: UTType {
        UTType(exportedAs: "cgym.antler.card")
    }
}
