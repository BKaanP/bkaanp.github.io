import Dexie, { type Table } from 'dexie'
 
export interface StoredImage {
  id?: number
  name: string
  blob: Blob
  embedding: Float32Array
  createdAt: Date
}
 
class ImageSearchDB extends Dexie {
  images!: Table<StoredImage, number>
 
  constructor() {
    super('image-search')
    this.version(1).stores({
      images: '++id, name, createdAt',
    })
  }
}
 
export const db = new ImageSearchDB()
 
export async function addImage(image: Omit<StoredImage, 'id'>): Promise<number> {
  return db.images.add(image)
}
 
export async function getAllImages(): Promise<StoredImage[]> {
  return db.images.orderBy('createdAt').reverse().toArray()
}
 
export async function deleteImage(id: number): Promise<void> {
  await db.images.delete(id)
}
 
export async function clearAllImages(): Promise<void> {
  await db.images.clear()
}