import type { PageText } from './pdf'
 
export interface Chunk {
  text: string
  page: number
}
 
/**
 * Split pages of text into roughly `targetSize`-character chunks.
 * Strategy:
 *   1. Merge consecutive paragraphs until the chunk approaches targetSize.
 *   2. If a single paragraph exceeds targetSize, split it by sentence boundaries.
 *   3. Each chunk is tagged with the page it starts on.
 */
export function chunkPages(pages: PageText[], targetSize = 500): Chunk[] {
  const chunks: Chunk[] = []
 
  for (const { page, text } of pages) {
    if (!text) continue
 
    const paragraphs = splitIntoParagraphs(text)
    let current = ''
 
    for (const para of paragraphs) {
      const units = para.length > targetSize ? splitLongParagraph(para, targetSize) : [para]
 
      for (const unit of units) {
        if (current && current.length + unit.length + 1 > targetSize) {
          chunks.push({ text: current.trim(), page })
          current = unit
        } else {
          current = current ? `${current} ${unit}` : unit
        }
      }
    }
 
    if (current.trim()) {
      chunks.push({ text: current.trim(), page })
      current = ''
    }
  }
 
  return chunks
}
 
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|(?<=[.!?])\s{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}
 
function splitLongParagraph(text: string, maxSize: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  const parts: string[] = []
  let current = ''
 
  for (const sent of sentences) {
    if (current && current.length + sent.length + 1 > maxSize) {
      parts.push(current.trim())
      current = sent
    } else {
      current = current ? `${current} ${sent}` : sent
    }
  }
 
  if (current.trim()) parts.push(current.trim())
 
  // Fallback: if a single sentence is still too long, hard-split by char.
  return parts.flatMap((p) => {
    if (p.length <= maxSize) return [p]
    const pieces: string[] = []
    for (let i = 0; i < p.length; i += maxSize) {
      pieces.push(p.slice(i, i + maxSize))
    }
    return pieces
  })
}