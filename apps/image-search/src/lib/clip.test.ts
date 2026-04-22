import { describe, expect, it } from 'vitest'
import { similarity } from './clip'

describe('similarity', () => {
  it('returns 1 for identical normalized vectors', () => {
    // Pre-normalized: [1, 0, 0] has magnitude 1
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([1, 0, 0])
    expect(similarity(a, b)).toBeCloseTo(1)
  })

  it('returns 0 for orthogonal unit vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([0, 1, 0])
    expect(similarity(a, b)).toBe(0)
  })

  it('returns -1 for anti-parallel unit vectors', () => {
    const a = new Float32Array([1, 0, 0])
    const b = new Float32Array([-1, 0, 0])
    expect(similarity(a, b)).toBeCloseTo(-1)
  })

  it('handles vectors of different lengths by clipping to shorter', () => {
    const a = new Float32Array([1, 0, 0, 0])
    const b = new Float32Array([1, 0])
    // Dot product over first 2 elements: 1*1 + 0*0 = 1
    expect(similarity(a, b)).toBeCloseTo(1)
  })
})