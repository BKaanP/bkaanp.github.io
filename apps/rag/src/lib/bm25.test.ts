import { describe, expect, it } from 'vitest'
import { buildBM25Index, normalizeScores, scoreBM25 } from './bm25'

describe('buildBM25Index', () => {
  it('indexes a single document', () => {
    const idx = buildBM25Index(['the quick brown fox'])
    expect(idx.docs).toHaveLength(1)
    expect(idx.docs[0]).toEqual(['quick', 'brown', 'fox']) // "the" is a stopword
    expect(idx.avgDocLen).toBe(3)
  })

  it('filters stopwords and single-character tokens', () => {
  // "der", "die", "das", "wer" are stopwords; "a" is a single char; "ab" is kept (2 chars, not a stopword)
  const idx = buildBM25Index(['der die das a ab wer'])
  expect(idx.docs[0]).toEqual(['ab'])
})

  it('lowercases tokens', () => {
    const idx = buildBM25Index(['Programming Python Java'])
    expect(idx.docs[0]).toEqual(['programming', 'python', 'java'])
  })

  it('handles empty corpus', () => {
    const idx = buildBM25Index([])
    expect(idx.docs).toHaveLength(0)
    expect(idx.avgDocLen).toBe(0)
  })
})

describe('scoreBM25', () => {
  it('returns zero for a query with no matching terms', () => {
    const idx = buildBM25Index(['apple banana cherry'])
    const scores = scoreBM25(idx, 'elephant')
    expect(scores).toEqual([0])
  })

  it('scores higher for documents containing the query term', () => {
    const idx = buildBM25Index([
      'python java javascript typescript', // has "python"
      'ruby swift kotlin',                  // does not
    ])
    const scores = scoreBM25(idx, 'python')
    expect(scores[0]).toBeGreaterThan(0)
    expect(scores[1]).toBe(0)
    expect(scores[0]).toBeGreaterThan(scores[1]!)
  })

  it('rewards rarer query terms with higher IDF', () => {
    // Both docs contain "common"; only one contains "rare"
    const idx = buildBM25Index([
      'common rare',
      'common ordinary',
    ])
    const commonScores = scoreBM25(idx, 'common')
    const rareScores = scoreBM25(idx, 'rare')
    // The doc that contains "rare" should score higher for "rare"
    // than it scores for "common" (which is everywhere)
    expect(rareScores[0]).toBeGreaterThan(commonScores[0]!)
  })

  it('handles multi-term queries by summing term contributions', () => {
    const idx = buildBM25Index([
      'python developer berlin',
      'python developer munich',
    ])
    const scores = scoreBM25(idx, 'python berlin')
    // First doc has both terms, second only one
    expect(scores[0]).toBeGreaterThan(scores[1]!)
  })
})

describe('normalizeScores', () => {
  it('scales to [0, 1]', () => {
    const normalized = normalizeScores([0, 5, 10])
    expect(normalized).toEqual([0, 0.5, 1])
  })

  it('returns zeros when all scores are equal', () => {
    const normalized = normalizeScores([3, 3, 3])
    expect(normalized).toEqual([0, 0, 0])
  })

  it('handles empty input', () => {
    expect(normalizeScores([])).toEqual([])
  })

  it('handles single-element input', () => {
    // Min equals max, so degenerate case — returns zero
    expect(normalizeScores([42])).toEqual([0])
  })
})