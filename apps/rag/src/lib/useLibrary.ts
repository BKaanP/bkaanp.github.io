import { useCallback, useEffect, useMemo, useState } from 'react'
import { embed, embedMany, similarity } from './embeddings'
import { extractPdfText } from './pdf'
import { chunkPages } from './chunking'
import { buildBM25Index, normalizeScores, scoreBM25, type BM25Index } from './bm25'
import {
  addDocument,
  clearAll as clearAllDocs,
  db,
  deleteDocument,
  getAllChunks,
  getAllDocuments,
  setDocumentActive,
  type Document,
  type StoredChunk,
} from './db'
 
export interface ProcessingState {
  fileName: string
  stage: 'extracting' | 'chunking' | 'embedding'
  current: number
  total: number
}
 
export interface SearchResult {
  chunk: StoredChunk
  documentName: string
  score: number
  semanticScore: number
  keywordScore: number
  matchedQuery: string // which query variant found this chunk
}
 
export class EmptyPdfError extends Error {
  constructor(fileName: string) {
    super(
      `No extractable text found in "${fileName}". This may be a scanned PDF — those require OCR (not supported yet).`,
    )
    this.name = 'EmptyPdfError'
  }
}
 
async function cleanupOrphans(): Promise<number> {
  return db.transaction('rw', db.documents, db.chunks, async () => {
    const docs = await db.documents.toArray()
    const docIds = new Set(docs.map((d) => d.id!))
    const allChunks = await db.chunks.toArray()
    const orphanIds = allChunks.filter((c) => !docIds.has(c.documentId)).map((c) => c.id!)
    if (orphanIds.length > 0) await db.chunks.bulkDelete(orphanIds)
    return orphanIds.length
  })
}
 
export function useLibrary() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [chunks, setChunks] = useState<StoredChunk[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processing, setProcessing] = useState<ProcessingState | null>(null)
 
  useEffect(() => {
    ;(async () => {
      const cleaned = await cleanupOrphans()
      if (cleaned > 0) console.info(`Cleaned up ${cleaned} orphaned chunks on startup`)
      const [docs, chks] = await Promise.all([getAllDocuments(), getAllChunks()])
      setDocuments(docs)
      setChunks(chks)
      setIsLoading(false)
    })()
  }, [])
 
  const addPdf = useCallback(async (file: File) => {
    setProcessing({ fileName: file.name, stage: 'extracting', current: 0, total: 0 })
 
    const pages = await extractPdfText(file)
    const totalExtractedChars = pages.reduce((sum, p) => sum + p.text.length, 0)
 
    if (totalExtractedChars === 0) {
      setProcessing(null)
      throw new EmptyPdfError(file.name)
    }
 
    setProcessing({ fileName: file.name, stage: 'chunking', current: 0, total: pages.length })
    const rawChunks = chunkPages(pages)
 
    if (rawChunks.length === 0) {
      setProcessing(null)
      throw new EmptyPdfError(file.name)
    }
 
    setProcessing({ fileName: file.name, stage: 'embedding', current: 0, total: rawChunks.length })
    const embeddings = await embedMany(
      rawChunks.map((c) => c.text),
      (done, total) =>
        setProcessing({ fileName: file.name, stage: 'embedding', current: done, total }),
    )
 
    const chunksToStore = rawChunks.map((c, i) => ({
      page: c.page,
      text: c.text,
      embedding: embeddings[i]!,
      position: i,
    }))
 
    const docId = await addDocument(
      { name: file.name, pageCount: pages.length },
      chunksToStore,
    )
 
    const newDoc: Document = {
      id: docId,
      name: file.name,
      pageCount: pages.length,
      chunkCount: chunksToStore.length,
      createdAt: new Date(),
      isActive: true,
    }
    const newChunks: StoredChunk[] = chunksToStore.map((c) => ({ ...c, documentId: docId }))
 
    setDocuments((prev) => [newDoc, ...prev])
    setChunks((prev) => [...prev, ...newChunks])
    setProcessing(null)
  }, [])
 
  const removeDocument = useCallback(async (id: number) => {
    await deleteDocument(id)
    setDocuments((prev) => prev.filter((d) => d.id !== id))
    setChunks((prev) => prev.filter((c) => c.documentId !== id))
  }, [])
 
  const toggleDocumentActive = useCallback(async (id: number) => {
    const current = documents.find((d) => d.id === id)
    if (!current) return
    const next = !current.isActive
    await setDocumentActive(id, next)
    setDocuments((prev) => prev.map((d) => (d.id === id ? { ...d, isActive: next } : d)))
  }, [documents])
 
  const clearLibrary = useCallback(async () => {
    await clearAllDocs()
    setDocuments([])
    setChunks([])
  }, [])
 
  const activeChunks = useMemo(() => {
    const activeDocIds = new Set(documents.filter((d) => d.isActive).map((d) => d.id!))
    return chunks.filter((c) => activeDocIds.has(c.documentId))
  }, [chunks, documents])
 
  const bm25Index = useMemo<BM25Index>(
    () => buildBM25Index(activeChunks.map((c) => c.text)),
    [activeChunks],
  )
 
  /**
   * Score a single query against all active chunks, returning normalized
   * hybrid scores tagged with which query produced them.
   */
  const scoreQuery = useCallback(
    async (query: string, alpha: number): Promise<SearchResult[]> => {
      if (!query.trim() || activeChunks.length === 0) return []
 
      const docById = new Map(documents.map((d) => [d.id!, d.name]))
      const qClamped = Math.max(0, Math.min(1, alpha))
 
      const keywordRaw = scoreBM25(bm25Index, query)
      const keywordNorm = normalizeScores(keywordRaw)
 
      let semanticNorm: number[]
      if (qClamped > 0) {
        const qEmb = await embed(query)
        const semanticRaw = activeChunks.map((c) => similarity(qEmb, c.embedding))
        semanticNorm = normalizeScores(semanticRaw)
      } else {
        semanticNorm = new Array(activeChunks.length).fill(0)
      }
 
      return activeChunks.map((c, i) => {
        const semanticScore = semanticNorm[i]!
        const keywordScore = keywordNorm[i]!
        const combined = qClamped * semanticScore + (1 - qClamped) * keywordScore
        return {
          chunk: c,
          documentName: docById.get(c.documentId) ?? 'unknown',
          score: combined,
          semanticScore,
          keywordScore,
          matchedQuery: query,
        }
      })
    },
    [activeChunks, bm25Index, documents],
  )
 
  /**
   * Retrieve top-K chunks across a set of queries.
   * Each chunk appears at most once; if multiple queries hit it, the best
   * score wins and `matchedQuery` records which one found it.
   */
  const searchMulti = useCallback(
    async (queries: string[], alpha: number, topK = 8): Promise<SearchResult[]> => {
      if (queries.length === 0 || activeChunks.length === 0) return []
 
      const allResults = await Promise.all(queries.map((q) => scoreQuery(q, alpha)))
 
      const bestByChunkId = new Map<number, SearchResult>()
      for (const results of allResults) {
        for (const r of results) {
          const id = r.chunk.id!
          const existing = bestByChunkId.get(id)
          if (!existing || r.score > existing.score) {
            bestByChunkId.set(id, r)
          }
        }
      }
 
      return [...bestByChunkId.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
    },
    [activeChunks, scoreQuery],
  )
 
  const activeCount = documents.filter((d) => d.isActive).length
 
  return {
    documents,
    chunks,
    isLoading,
    processing,
    activeCount,
    addPdf,
    removeDocument,
    toggleDocumentActive,
    clearLibrary,
    searchMulti,
  }
}