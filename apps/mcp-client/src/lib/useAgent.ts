import { useCallback, useRef, useState } from 'react'
import { runAgent, SYSTEM_PROMPT, type AgentEvent } from './agent'
import type { McpClient } from './mcp/client'
import type { ToolDefinition } from './mcp/types'

/**
 * A single step shown in the UI. Steps interleave within a turn:
 *   turn 1: [thinking, text, tool_call, tool_result, tool_call, tool_result]
 *   turn 2: [thinking, text]  ← final answer
 */
export type AgentStep =
  | { kind: 'thinking'; turn: number }
  | { kind: 'text'; turn: number; text: string }
  | {
      kind: 'tool_call'
      turn: number
      id: string
      name: string
      input: unknown
      output: string | null
      isError: boolean | null
    }

export interface Exchange {
  id: string
  question: string
  steps: AgentStep[]
  isRunning: boolean
  error: string | null
}

export function useAgent() {
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [isActive, setIsActive] = useState(false)
  const abortRef = useRef<boolean>(false)

  const ask = useCallback(
    async (params: {
      apiKey: string
      client: McpClient
      tools: ToolDefinition[]
      question: string
    }) => {
      const exchangeId = crypto.randomUUID()
      abortRef.current = false
      setIsActive(true)

      setExchanges((prev) => [
        ...prev,
        { id: exchangeId, question: params.question, steps: [], isRunning: true, error: null },
      ])

      function updateSteps(mutator: (steps: AgentStep[]) => AgentStep[]) {
        setExchanges((prev) =>
          prev.map((ex) => (ex.id === exchangeId ? { ...ex, steps: mutator(ex.steps) } : ex)),
        )
      }

      try {
        for await (const event of runAgent({
          apiKey: params.apiKey,
          client: params.client,
          tools: params.tools,
          userMessage: params.question,
          systemPrompt: SYSTEM_PROMPT,
        })) {
          if (abortRef.current) break
          applyEvent(event, updateSteps, exchangeId, setExchanges)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setExchanges((prev) =>
          prev.map((ex) =>
            ex.id === exchangeId ? { ...ex, error: message, isRunning: false } : ex,
          ),
        )
      } finally {
        setExchanges((prev) =>
          prev.map((ex) => (ex.id === exchangeId ? { ...ex, isRunning: false } : ex)),
        )
        setIsActive(false)
      }
    },
    [],
  )

  const clear = useCallback(() => {
    abortRef.current = true
    setExchanges([])
  }, [])

  return { exchanges, isActive, ask, clear }
}

function applyEvent(
  event: AgentEvent,
  updateSteps: (mutator: (steps: AgentStep[]) => AgentStep[]) => void,
  exchangeId: string,
  setExchanges: React.Dispatch<React.SetStateAction<Exchange[]>>,
) {
  switch (event.type) {
    case 'thinking':
      updateSteps((steps) => [...steps, { kind: 'thinking', turn: event.turn }])
      break

    case 'text_delta':
      updateSteps((steps) => {
        // Merge consecutive text deltas within the same turn into one step
        const last = steps[steps.length - 1]
        if (last?.kind === 'text' && last.turn === event.turn) {
          return [...steps.slice(0, -1), { ...last, text: last.text + event.delta }]
        }
        return [...steps, { kind: 'text', turn: event.turn, text: event.delta }]
      })
      break

    case 'tool_call_start':
      updateSteps((steps) => [
        ...steps,
        {
          kind: 'tool_call',
          turn: event.turn,
          id: event.id,
          name: event.name,
          input: event.input,
          output: null,
          isError: null,
        },
      ])
      break

    case 'tool_call_result':
      updateSteps((steps) =>
        steps.map((s) =>
          s.kind === 'tool_call' && s.id === event.id
            ? { ...s, output: event.output, isError: event.isError }
            : s,
        ),
      )
      break

    case 'turn_complete':
      // Remove the trailing "thinking" placeholder for this turn, if it's still there
      updateSteps((steps) => {
        const filtered = steps.filter(
          (s, i) => !(s.kind === 'thinking' && s.turn === event.turn && i === steps.length - 1),
        )
        return filtered
      })
      break

    case 'done':
      // no-op, isRunning=false is set in finally block
      break

    case 'error':
      setExchanges((prev) =>
        prev.map((ex) => (ex.id === exchangeId ? { ...ex, error: event.message } : ex)),
      )
      break
  }
}