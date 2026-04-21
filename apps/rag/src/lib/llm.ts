import Anthropic from '@anthropic-ai/sdk'
import type { SearchResult } from './useLibrary'
 
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
 
export interface LlmChunk {
  type: 'text' | 'done' | 'error'
  text?: string
  error?: string
}
 
/**
 * Build the system prompt. Short, direct, and opinionated about how Claude
 * should use citations. Keep it terse — system prompts are token cost too.
 */
function buildSystemPrompt(): string {
  return [
    'You are a precise assistant that answers questions strictly from the provided document excerpts.',
    '',
    'Rules:',
    '- Base your answer only on the excerpts below. If the excerpts do not contain the answer, say so plainly.',
    '- Reference specific excerpts by their number in square brackets, e.g. [1] or [2].',
    '- Keep answers concise. Match the language of the question.',
    '- Do not speculate beyond what the excerpts say.',
  ].join('\n')
}
 
/**
 * Format the retrieved chunks as a numbered context block.
 * Numbering matches what the UI displays so citations align.
 */
function buildContextBlock(results: SearchResult[]): string {
  return results
    .map((r, i) => {
      const header = `[${i + 1}] ${r.documentName}, page ${r.chunk.page}`
      return `${header}\n${r.chunk.text}`
    })
    .join('\n\n---\n\n')
}
 
/**
 * Stream Claude's answer token-by-token. Yields `LlmChunk` objects as
 * chunks arrive from the SSE stream. Caller should iterate with `for await`.
 *
 * Uses `dangerouslyAllowBrowser: true` because this is a BYOK tool where
 * users explicitly provide their own key. The key lives in localStorage
 * and is sent directly to api.anthropic.com.
 */
export async function* streamAnswer(params: {
  apiKey: string
  question: string
  context: SearchResult[]
}): AsyncGenerator<LlmChunk> {
  const { apiKey, question, context } = params
 
  if (context.length === 0) {
    yield {
      type: 'error',
      error: 'No context retrieved. Upload a document and enable it first.',
    }
    return
  }
 
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
 
  const userMessage = [
    'Document excerpts:',
    '',
    buildContextBlock(context),
    '',
    '---',
    '',
    `Question: ${question}`,
  ].join('\n')
 
  try {
    const stream = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    })
 
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield { type: 'text', text: event.delta.text }
      }
    }
 
    yield { type: 'done' }
  } catch (err) {
    console.error('LLM stream failed:', err)
    yield {
      type: 'error',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}