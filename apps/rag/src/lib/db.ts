import Dexie, { type Table } from 'dexie'

export interface Document {
  id?: number
  name: string
  pageCount: number
  chunkCount: number
  createdAt: Date
  isActive: boolean
}

export interface StoredChunk {
  id?: number
  documentId: number
  page: number
  text: string
  embedding: Float32Array
  position: number
}

class RagDB extends Dexie {
  documents!: Table<Document, number>
  chunks!: Table<StoredChunk, number>

  constructor() {
    super('rag')

    // v1: initial schema
    this.version(1).stores({
      documents: '++id, name, createdAt',
      chunks: '++id, documentId, [documentId+position]',
    })

    // v2: adds isActive flag; existing documents are upgraded to active.
    this.version(2)
      .stores({
        documents: '++id, name, createdAt, isActive',
        chunks: '++id, documentId, [documentId+position]',
      })
      .upgrade(async (tx) => {
        await tx
          .table('documents')
          .toCollection()
          .modify((doc) => {
            if (doc.isActive === undefined) doc.isActive = true
          })
      })
  }
}

export const db = new RagDB()

export async function addDocument(
  meta: Omit<Document, 'id' | 'chunkCount' | 'createdAt' | 'isActive'>,
  chunks: Array<Omit<StoredChunk, 'id' | 'documentId'>>,
): Promise<number> {
  return db.transaction('rw', db.documents, db.chunks, async () => {
    const docId = await db.documents.add({
      ...meta,
      chunkCount: chunks.length,
      createdAt: new Date(),
      isActive: true,
    })
    await db.chunks.bulkAdd(chunks.map((c) => ({ ...c, documentId: docId })))
    return docId
  })
}

export async function getAllDocuments(): Promise<Document[]> {
  return db.documents.orderBy('createdAt').reverse().toArray()
}

export async function getAllChunks(): Promise<StoredChunk[]> {
  return db.chunks.toArray()
}

export async function deleteDocument(id: number): Promise<void> {
  await db.transaction('rw', db.documents, db.chunks, async () => {
    await db.chunks.where('documentId').equals(id).delete()
    await db.documents.delete(id)
  })
}

export async function setDocumentActive(id: number, isActive: boolean): Promise<void> {
  await db.documents.update(id, { isActive })
}

export async function clearAll(): Promise<void> {
  await db.transaction('rw', db.documents, db.chunks, async () => {
    await db.chunks.clear()
    await db.documents.clear()
  })
}