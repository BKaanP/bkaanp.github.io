import { useCallback, useRef, useState } from 'react'
import { runAgent, SYSTEM_PROMPT, type AgentEvent } from './agent'
import type { McpClient } from './mcp/client'
import type { ToolDefinition } from './mcp/types'

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

/**
 * Remove the thinking placeholder for a given turn. Called whenever a
 * "real" event (text, tool call, or turn completion) arrives for that turn.
 * The thinking step only exists as a visual placeholder while Claude is
 * processing — as soon as any actual output appears, it should disappear.
 */
function stripThinking(steps: AgentStep[], turn: number): AgentStep[] {
  return steps.filter((s) => !(s.kind === 'thinking' && s.turn === turn))
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
        const cleaned = stripThinking(steps, event.turn)
        const last = cleaned[cleaned.length - 1]
        if (last?.kind === 'text' && last.turn === event.turn) {
          return [...cleaned.slice(0, -1), { ...last, text: last.text + event.delta }]
        }
        return [...cleaned, { kind: 'text', turn: event.turn, text: event.delta }]
      })
      break

    case 'tool_call_start':
      updateSteps((steps) => [
        ...stripThinking(steps, event.turn),
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
      updateSteps((steps) => stripThinking(steps, event.turn))
      break

    case 'done':
      break

    case 'error':
      setExchanges((prev) =>
        prev.map((ex) => (ex.id === exchangeId ? { ...ex, error: event.message } : ex)),
      )
      break
  }
}