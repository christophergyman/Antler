/**
 * Secure UID Generation
 * Uses crypto.randomUUID() for cryptographically secure identifiers
 */

import { randomUUID } from "crypto";

/**
 * Generates a cryptographically secure UUID v4
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * 122 bits of entropy, collision probability ~1 in 5.3×10^36
 */
export function generateUid(): string {
  return randomUUID();
}

/**
 * Name generation state
 */
let nameCounter = 0;

const ADJECTIVES = [
  "swift", "bold", "keen", "calm", "bright",
  "quick", "sharp", "warm", "cool", "fresh",
  "prime", "crisp", "clear", "pure", "agile",
] as const;

const NOUNS = [
  "branch", "sprint", "wave", "spark", "flow",
  "pulse", "drift", "surge", "bloom", "forge",
  "quest", "scout", "pilot", "craft", "route",
] as const;

/**
 * Generates a human-readable name for cards
 * Format: adjective-noun-counter (e.g., "swift-branch-42")
 */
export function generateName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}-${++nameCounter}`;
}

/**
 * Resets the name counter (useful for testing)
 */
export function resetNameCounter(): void {
  nameCounter = 0;
}

/**
 * Validates a UUID v4 string format
 */
export function isValidUid(uid: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uid);
}
