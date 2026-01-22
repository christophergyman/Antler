/**
 * Secure UID Generation
 * Uses crypto.randomUUID() for cryptographically secure identifiers
 * Browser-compatible (no Node.js imports needed)
 */

/**
 * Generates a cryptographically secure UUID v4
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * 122 bits of entropy, collision probability ~1 in 5.3x10^36
 */
export function generateUid(): string {
  return crypto.randomUUID();
}

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
 * Format: adjective-noun-prefix (e.g., "swift-branch-a1b2")
 * Uses UUID prefix for uniqueness across sessions/windows
 */
export function generateName(uid?: string): string {
  const prefix = uid ? uid.slice(0, 4) : crypto.randomUUID().slice(0, 4);
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}-${prefix}`;
}

/**
 * Validates a UUID v4 string format
 */
export function isValidUid(uid: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(uid);
}
