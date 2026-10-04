// The system prompt forbids Markdown, but a model can still slip (known, ~1 in 3 on some eval
// cases). A screen reader reads "**" aloud, so this is the deterministic backstop: whatever the
// model emits, the chat shows (and speaks) plain text. Safe to run on partial streamed text —
// it never needs a closing delimiter, it just drops the syntax characters.

/** Removes Markdown syntax but keeps the words. Idempotent. */
export function stripMarkdown(text: string): string {
  return (
    text
      // [label](url) -> label (the model must not emit URLs anyway)
      .replace(/\[([^\]\n]+)\]\([^)\n]*\)/g, '$1')
      // headings: "## Title" -> "Title"
      .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
      // bullets: "- item" / "* item" / "• item" -> "item" (line break stays, so it still reads as a list)
      .replace(/^[ \t]*[-*•][ \t]+/gm, '')
      // emphasis and code markers; unmatched ones (mid-stream) go too
      .replace(/[*`]/g, '')
      // _italic_ / __bold__ around a word, without touching snake_case or ids
      .replace(/(^|[^\w])_{1,2}([^_\n]+?)_{1,2}(?=[^\w]|$)/g, '$1$2')
  );
}
