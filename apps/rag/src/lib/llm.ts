import Anthropic from '@anthropic-ai/sdk'
import type { SearchResult } from './useLibrary'
import { PROXY_BASE_URL } from './proxy'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024

export interface LlmChunk {
  type: 'text' | 'done' | 'error'
  text?: string
  error?: string
}

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

function buildContextBlock(results: SearchResult[]): string {
  return results
    .map((r, i) => {
      const header = `[${i + 1}] ${r.documentName}, page ${r.chunk.page}`
      return `${header}\n${r.chunk.text}`
    })
    .join('\n\n---\n\n')
}

export async function* streamAnswer(params: {
  question: string
  context: SearchResult[]
}): AsyncGenerator<LlmChunk> {
  const { question, context } = params

  if (context.length === 0) {
    yield { type: 'error', error: 'No context retrieved. Upload a document and enable it first.' }
    return
  }

  const client = new Anthropic({ baseURL: PROXY_BASE_URL, apiKey: 'proxy', dangerouslyAllowBrowser: true })

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
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: userMessage }],
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', text: event.delta.text }
      }
    }

    yield { type: 'done' }
  } catch (err) {
    console.error('LLM stream failed:', err)
    yield { type: 'error', error: err instanceof Error ? err.message : String(err) }
  }
}
