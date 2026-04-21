import { filterTokens } from './stopwords'
 
/**
 * BM25 — a classic term-weighting ranking function (Robertson & Jones, 1994).
 *
 * For a query Q and document D:
 *   score(D, Q) = sum over each q in Q of:
 *     IDF(q) * ( f(q, D) * (k1 + 1) ) / ( f(q, D) + k1 * (1 - b + b * |D| / avgdl) )
 *
 *   where:
 *     f(q, D)  = term frequency of q in D
 *     |D|      = length of D in tokens
 *     avgdl    = average document length across the corpus
 *     k1, b    = tuning parameters (typical: k1=1.5, b=0.75)
 *     IDF(q)   = log( (N - n(q) + 0.5) / (n(q) + 0.5) + 1 )
 *
 * Query and document tokens are passed through a bilingual (DE/EN) stopword
 * filter so pronouns and function words cannot dominate scoring on small corpora.
 */
 
const K1 = 1.5
const B = 0.75
 
export interface BM25Index {
  docs: string[][]
  avgDocLen: number
  idf: Map<string, number>
}
 
export function buildBM25Index(documents: string[]): BM25Index {
  const docs = documents.map(tokenize)
  const N = docs.length
  const avgDocLen = docs.reduce((sum, d) => sum + d.length, 0) / Math.max(N, 1)
 
  const df = new Map<string, number>()
  for (const doc of docs) {
    const seen = new Set(doc)
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1)
    }
  }
 
  const idf = new Map<string, number>()
  for (const [term, dfVal] of df) {
    idf.set(term, Math.log((N - dfVal + 0.5) / (dfVal + 0.5) + 1))
  }
 
  return { docs, avgDocLen, idf }
}
 
export function scoreBM25(index: BM25Index, query: string): number[] {
  const queryTerms = tokenize(query)
  const scores: number[] = new Array(index.docs.length).fill(0)
 
  for (let i = 0; i < index.docs.length; i++) {
    const doc = index.docs[i]!
    const docLen = doc.length
    if (docLen === 0) continue
 
    const tf = new Map<string, number>()
    for (const term of doc) tf.set(term, (tf.get(term) ?? 0) + 1)
 
    let score = 0
    for (const qTerm of queryTerms) {
      const f = tf.get(qTerm)
      if (!f) continue
      const idfVal = index.idf.get(qTerm) ?? 0
      const numerator = f * (K1 + 1)
      const denominator = f + K1 * (1 - B + (B * docLen) / index.avgDocLen)
      score += idfVal * (numerator / denominator)
    }
    scores[i] = score
  }
 
  return scores
}
 
export function normalizeScores(scores: number[]): number[] {
  let min = Infinity
  let max = -Infinity
  for (const s of scores) {
    if (s < min) min = s
    if (s > max) max = s
  }
  const range = max - min
  if (range === 0) return scores.map(() => 0)
  return scores.map((s) => (s - min) / range)
}
 
function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
  return filterTokens(raw)
}