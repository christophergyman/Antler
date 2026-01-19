//
//  BranchNameGenerator.swift
//  Antler
//

import Foundation

enum BranchNameGenerator {
    static func generate(from title: String, prefix: String = "feature/") -> String {
        let cleaned = title
            .lowercased()
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: "-")

        guard !cleaned.isEmpty else { return "" }
        return prefix + cleaned
    }
}
