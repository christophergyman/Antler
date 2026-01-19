//
//  TagBadgeView.swift
//  Antler
//

import SwiftUI

struct TagBadgeView: View {
    let tag: Tag

    var body: some View {
        Text(tag.name)
            .font(.caption2)
            .fontWeight(.medium)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color(hex: tag.colorHex).opacity(0.2))
            .foregroundColor(Color(hex: tag.colorHex))
            .clipShape(Capsule())
    }
}
