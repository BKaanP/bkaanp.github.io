import { describe, expect, it } from 'vitest'
import { chunkPages } from './chunking'
import type { PageText } from './pdf'

function page(pageNum: number, text: string): PageText {
  return { page: pageNum, text }
}

describe('chunkPages', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkPages([])).toEqual([])
  })

  it('skips pages with empty text', () => {
    const result = chunkPages([page(1, ''), page(2, 'real content here.')])
    expect(result).toHaveLength(1)
    expect(result[0]?.page).toBe(2)
  })

  it('merges short paragraphs within target size', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird.'
    const chunks = chunkPages([page(1, text)], 500)
    // All paragraphs small enough to fit in one chunk
    expect(chunks).toHaveLength(1)
    expect(chunks[0]?.text).toContain('First')
    expect(chunks[0]?.text).toContain('Third')
  })

  it('splits when a chunk would exceed target size', () => {
    // Each paragraph ~60 chars; target 100 → 2 chunks expected
    const para = 'This paragraph is roughly sixty characters long as needed.'
    const text = `${para}\n\n${para}\n\n${para}`
    const chunks = chunkPages([page(1, text)], 100)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })

  it('splits a single paragraph longer than target by sentences', () => {
    const longPara = Array.from({ length: 10 }, (_, i) => `Sentence number ${i + 1}.`).join(' ')
    const chunks = chunkPages([page(1, longPara)], 50)
    expect(chunks.length).toBeGreaterThan(1)
    // Every chunk should be at or below target + some slack for sentence boundaries
    for (const c of chunks) {
      expect(c.text.length).toBeLessThanOrEqual(100)
    }
  })

  it('tags each chunk with its originating page', () => {
    const chunks = chunkPages([page(1, 'Content from page one.'), page(5, 'Content from page five.')])
    expect(chunks[0]?.page).toBe(1)
    expect(chunks[1]?.page).toBe(5)
  })

  it('starts a new chunk across page boundaries', () => {
    // Content on page 1 and page 2 should never be merged into a single chunk
    const chunks = chunkPages(
      [page(1, 'Page one text here.'), page(2, 'Page two text here.')],
      5000,
    )
    const pages = chunks.map((c) => c.page)
    expect(new Set(pages).size).toBe(2)
  })
})