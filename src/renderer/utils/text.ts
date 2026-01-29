/**
 * Strips leading markdown headings from text.
 *
 * Removes consecutive markdown headings (lines starting with #) and empty lines
 * from the beginning of text, returning the first line of actual content.
 * Falls back to the first heading text (without # symbols) if no content remains.
 */
export function stripMarkdownHeadings(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  let startIndex = 0;
  let firstHeadingText: string | null = null;

  // Skip leading headings and empty lines
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      // Extract heading text (remove # symbols and leading space)
      if (firstHeadingText === null) {
        firstHeadingText = trimmed.replace(/^#+\s*/, '');
      }
      startIndex = i + 1;
    } else if (trimmed === '') {
      startIndex = i + 1;
    } else {
      break;
    }
  }

  const content = lines.slice(startIndex).join('\n').trim();

  // Fallback to first heading text if no content remains
  return content || firstHeadingText || '';
}
