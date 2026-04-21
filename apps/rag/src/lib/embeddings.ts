import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
 
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'
 
export type ProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
}) => void
 
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null
 
/**
 * Load the embedding pipeline. First call downloads ~22MB of weights.
 * Safe to call repeatedly — subsequent calls reuse the cached promise.
 */
export function loadEmbedder(onProgress?: ProgressCallback) {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {
      progress_callback: onProgress as never,
      dtype: 'fp32',
    }) as Promise<FeatureExtractionPipeline>
  }
  return extractorPromise
}
 
/**
 * Embed a single piece of text into a 384-dim vector.
 * Output is L2-normalized, so cosine similarity = dot product.
 */
export async function embed(text: string): Promise<Float32Array> {
  const extractor = await loadEmbedder()
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  return new Float32Array(output.data as Float32Array)
}
 
/**
 * Embed multiple texts. Runs sequentially; fine for a few hundred chunks.
 * For larger batches you'd want a Web Worker and true batching.
 */
export async function embedMany(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Float32Array[]> {
  const result: Float32Array[] = []
  for (let i = 0; i < texts.length; i++) {
    result.push(await embed(texts[i]!))
    onProgress?.(i + 1, texts.length)
  }
  return result
}
 
/**
 * Cosine similarity of two L2-normalized vectors = dot product.
 */
export function similarity(a: Float32Array, b: Float32Array): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) sum += a[i]! * b[i]!
  return sum
}