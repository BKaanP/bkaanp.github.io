import { describe, expect, it } from 'vitest'
import { filterTokens, isStopword } from './stopwords'

describe('isStopword', () => {
  it('identifies common German stopwords', () => {
    expect(isStopword('der')).toBe(true)
    expect(isStopword('die')).toBe(true)
    expect(isStopword('ist')).toBe(true)
    expect(isStopword('welche')).toBe(true)
  })

  it('identifies common English stopwords', () => {
    expect(isStopword('the')).toBe(true)
    expect(isStopword('and')).toBe(true)
    expect(isStopword('what')).toBe(true)
  })

  it('does not flag substantive content words', () => {
    expect(isStopword('programmiersprachen')).toBe(false)
    expect(isStopword('react')).toBe(false)
    expect(isStopword('python')).toBe(false)
    expect(isStopword('kennt')).toBe(false)
  })

  it('is case-sensitive (caller must lowercase first)', () => {
    expect(isStopword('Der')).toBe(false)
    expect(isStopword('DER')).toBe(false)
  })
})

describe('filterTokens', () => {
  it('removes stopwords', () => {
    expect(filterTokens(['der', 'python', 'ist', 'gut'])).toEqual(['python', 'gut'])
  })

  it('removes tokens shorter than 2 characters', () => {
    expect(filterTokens(['a', 'ab', 'abc', 'x'])).toEqual(['ab', 'abc'])
  })

  it('preserves order of remaining tokens', () => {
    expect(filterTokens(['python', 'der', 'java', 'ist', 'kotlin'])).toEqual([
      'python',
      'java',
      'kotlin',
    ])
  })

  it('handles empty input', () => {
    expect(filterTokens([])).toEqual([])
  })
})