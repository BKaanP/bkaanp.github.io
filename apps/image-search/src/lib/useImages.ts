import { useCallback, useEffect, useState } from 'react'
import { embedImage } from './clip'
import {
  addImage,
  clearAllImages,
  deleteImage,
  getAllImages,
  type StoredImage,
} from './db'
 
export interface ProcessingState {
  current: number
  total: number
}
 
export function useImages() {
  const [images, setImages] = useState<StoredImage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [processing, setProcessing] = useState<ProcessingState | null>(null)
 
  useEffect(() => {
    getAllImages()
      .then((imgs) => setImages(imgs))
      .finally(() => setIsLoading(false))
  }, [])
 
  const uploadImages = useCallback(async (files: File[]) => {
    const added: StoredImage[] = []
    setProcessing({ current: 0, total: files.length })
 
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!
      setProcessing({ current: i, total: files.length })
      try {
        const embedding = await embedImage(file)
        const record: Omit<StoredImage, 'id'> = {
          name: file.name,
          blob: file,
          embedding,
          createdAt: new Date(),
        }
        const id = await addImage(record)
        added.push({ ...record, id })
      } catch (err) {
        console.error(`Failed to embed ${file.name}:`, err)
      }
    }
 
    setImages((prev) => [...added.reverse(), ...prev])
    setProcessing(null)
  }, [])
 
  const removeImage = useCallback(async (id: number) => {
    await deleteImage(id)
    setImages((prev) => prev.filter((img) => img.id !== id))
  }, [])
 
  const clearAll = useCallback(async () => {
    await clearAllImages()
    setImages([])
  }, [])
 
  return { images, isLoading, processing, uploadImages, removeImage, clearAll }
}