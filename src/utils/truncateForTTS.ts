// Groq Orpheus TTS enforces a hard 200-character limit on the input field.
const TTS_MAX_CHARS = 200;

export function truncateForTTS(text: string): string {
  if (text.length <= TTS_MAX_CHARS) return text;

  const slice = text.slice(0, TTS_MAX_CHARS);

  // Find last sentence-ending punctuation within the slice
  const lastEnd = Math.max(
    slice.lastIndexOf('. '),
    slice.lastIndexOf('! '),
    slice.lastIndexOf('? ')
  );

  if (lastEnd > 0) {
    return slice.slice(0, lastEnd + 1);
  }

  // Fallback: trim to last word boundary
  const lastSpace = slice.lastIndexOf(' ');
  return lastSpace > 0 ? slice.slice(0, lastSpace) + '\u2026' : slice;
}
