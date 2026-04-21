import { useCallback, useRef, useState } from 'react'
import { streamAnswer } from './llm'
import { expandQuery } from './queryExpansion'
import type { SearchResult } from './useLibrary'
 
export interface ChatMessage {
  id: string
  question: string
  expansions: string[] // empty if expansion was disabled
  answer: string
  citations: SearchResult[]
  retrievalMode: number
  isExpanding: boolean
  isStreaming: boolean
  error: string | null
}
 
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isActive, setIsActive] = useState(false)
  const abortRef = useRef<boolean>(false)
 
  const ask = useCallback(
    async (params: {
      apiKey: string
      question: string
      alpha: number
      topK: number
      useExpansion: boolean
      searchMulti: (queries: string[], alpha: number, topK: number) => Promise<SearchResult[]>
    }) => {
      const id = crypto.randomUUID()
      abortRef.current = false
      setIsActive(true)
 
      const message: ChatMessage = {
        id,
        question: params.question,
        expansions: [],
        answer: '',
        citations: [],
        retrievalMode: params.alpha,
        isExpanding: params.useExpansion,
        isStreaming: false,
        error: null,
      }
      setMessages((prev) => [...prev, message])
 
      try {
        // Step 1: query expansion (optional)
        let queries = [params.question]
        let expansions: string[] = []
        if (params.useExpansion) {
          const result = await expandQuery({
            apiKey: params.apiKey,
            query: params.question,
          })
          expansions = result.expansions
          queries = [params.question, ...result.expansions]
        }
 
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, expansions, isExpanding: false } : m,
          ),
        )
 
        // Step 2: retrieval (over original + expanded queries if any)
        const context = await params.searchMulti(queries, params.alpha, params.topK)
 
        setMessages((prev) =>
          prev.map((m) => (m.id === id ? { ...m, citations: context, isStreaming: true } : m)),
        )
 
        if (context.length === 0) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id
                ? {
                    ...m,
                    error: 'No relevant chunks found. Is a document active?',
                    isStreaming: false,
                  }
                : m,
            ),
          )
          return
        }
 
        // Step 3: stream the final answer
        for await (const chunk of streamAnswer({
          apiKey: params.apiKey,
          question: params.question,
          context,
        })) {
          if (abortRef.current) break
 
          if (chunk.type === 'text' && chunk.text) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id ? { ...m, answer: m.answer + chunk.text } : m,
              ),
            )
          } else if (chunk.type === 'error') {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === id
                  ? { ...m, error: chunk.error ?? 'Unknown error', isStreaming: false }
                  : m,
              ),
            )
            break
          } else if (chunk.type === 'done') {
            break
          }
        }
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  error: err instanceof Error ? err.message : String(err),
                  isExpanding: false,
                  isStreaming: false,
                }
              : m,
          ),
        )
      } finally {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === id ? { ...m, isExpanding: false, isStreaming: false } : m,
          ),
        )
        setIsActive(false)
      }
    },
    [],
  )
 
  const clear = useCallback(() => {
    abortRef.current = true
    setMessages([])
  }, [])
 
  return { messages, isActive, ask, clear }
}