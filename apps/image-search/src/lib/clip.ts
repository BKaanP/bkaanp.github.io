import {
  AutoProcessor,
  AutoTokenizer,
  CLIPTextModelWithProjection,
  CLIPVisionModelWithProjection,
  RawImage,
  type PreTrainedTokenizer,
  type Processor,
  type PreTrainedModel,
} from '@huggingface/transformers'
 
const MODEL_ID = 'Xenova/clip-vit-base-patch32'
 
// Singletons — models are loaded once and reused.
let processorPromise: Promise<Processor> | null = null
let tokenizerPromise: Promise<PreTrainedTokenizer> | null = null
let visionModelPromise: Promise<PreTrainedModel> | null = null
let textModelPromise: Promise<PreTrainedModel> | null = null
 
export type ProgressCallback = (progress: {
  status: string
  file?: string
  progress?: number
}) => void
 
/**
 * Load all CLIP components. Safe to call multiple times — subsequent calls
 * reuse the cached promises. First call downloads ~150MB of model weights
 * (cached by the browser after that).
 */
export async function loadClip(onProgress?: ProgressCallback) {
  const progress_callback = onProgress as never
 
  if (!processorPromise) {
    processorPromise = AutoProcessor.from_pretrained(MODEL_ID, { progress_callback })
  }
  if (!tokenizerPromise) {
    tokenizerPromise = AutoTokenizer.from_pretrained(MODEL_ID, { progress_callback })
  }
  if (!visionModelPromise) {
    visionModelPromise = CLIPVisionModelWithProjection.from_pretrained(MODEL_ID, {
      progress_callback,
      dtype: 'fp32',
    })
  }
  if (!textModelPromise) {
    textModelPromise = CLIPTextModelWithProjection.from_pretrained(MODEL_ID, {
      progress_callback,
      dtype: 'fp32',
    })
  }
 
  const [processor, tokenizer, visionModel, textModel] = await Promise.all([
    processorPromise,
    tokenizerPromise,
    visionModelPromise,
    textModelPromise,
  ])
 
  return { processor, tokenizer, visionModel, textModel }
}
 
/**
 * Embed an image (as a Blob/File) into a 512-dimensional vector.
 * The vector is L2-normalized, so cosine similarity reduces to a dot product.
 */
export async function embedImage(blob: Blob): Promise<Float32Array> {
  const { processor, visionModel } = await loadClip()
  const url = URL.createObjectURL(blob)
  try {
    const image = await RawImage.fromURL(url)
    const imageInputs = await processor(image)
    const { image_embeds } = await visionModel(imageInputs)
    return normalize(image_embeds.data as Float32Array)
  } finally {
    URL.revokeObjectURL(url)
  }
}
 
/**
 * Embed a text query into the same 512-dimensional space.
 */
export async function embedText(text: string): Promise<Float32Array> {
  const { tokenizer, textModel } = await loadClip()
  const textInputs = tokenizer([text], { padding: true, truncation: true })
  const { text_embeds } = await textModel(textInputs)
  return normalize(text_embeds.data as Float32Array)
}
 
/**
 * Cosine similarity between two normalized vectors = dot product.
 * Returns a value in [-1, 1]; higher is more similar.
 */
export function similarity(a: Float32Array, b: Float32Array): number {
  let sum = 0
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    sum += a[i]! * b[i]!
  }
  return sum
}
 
function normalize(vec: Float32Array): Float32Array {
  let norm = 0
  for (let i = 0; i < vec.length; i++) norm += vec[i]! * vec[i]!
  norm = Math.sqrt(norm) || 1
  const out = new Float32Array(vec.length)
  for (let i = 0; i < vec.length; i++) out[i] = vec[i]! / norm
  return out
}