import Anthropic from '@anthropic-ai/sdk'
import type { McpClient } from './mcp/client'
import type { ToolDefinition } from './mcp/types'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
const MAX_TURNS = 10 // hard safety limit on agent loop iterations

// ---------- Event types emitted during an agent run ----------

export type AgentEvent =
  | { type: 'thinking'; turn: number }
  | { type: 'text_delta'; turn: number; delta: string }
  | { type: 'tool_call_start'; turn: number; id: string; name: string; input: unknown }
  | { type: 'tool_call_result'; id: string; output: string; isError: boolean }
  | { type: 'turn_complete'; turn: number }
  | { type: 'done' }
  | { type: 'error'; message: string }

/**
 * Convert MCP tool definitions into the shape Anthropic's API expects.
 * The two formats are near-identical; MCP's `inputSchema` maps to Claude's `input_schema`.
 */
function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Messages.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Messages.Tool['input_schema'],
  }))
}

/**
 * Run an agent loop: Claude picks tools, we execute them via MCP, feed results
 * back, until Claude stops calling tools. Yields events so the UI can render
 * each step as it happens.
 *
 * Hard capped at MAX_TURNS to prevent runaway loops (e.g. a bug where Claude
 * keeps calling the same failing tool). In production you'd also add:
 *   - per-tool call timeout
 *   - max total tool calls (not just turns)
 *   - user confirmation for destructive tools
 */
export async function* runAgent(params: {
  apiKey: string
  client: McpClient
  tools: ToolDefinition[]
  userMessage: string
  systemPrompt: string
}): AsyncGenerator<AgentEvent> {
  const { apiKey, client, tools, userMessage, systemPrompt } = params
  const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const anthropicTools = toAnthropicTools(tools)

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: userMessage },
  ]

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    yield { type: 'thinking', turn }

    let response: Anthropic.Messages.Message
    try {
      response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: anthropicTools,
        messages,
      })
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : String(err) }
      return
    }

    // Emit any text deltas Claude produced in this turn
    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        yield { type: 'text_delta', turn, delta: block.text }
      }
    }

    // Append assistant's message to history
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') {
      yield { type: 'turn_complete', turn }
      yield { type: 'done' }
      return
    }

    // Execute every tool_use block, collect results for the next turn
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      yield {
        type: 'tool_call_start',
        turn,
        id: block.id,
        name: block.name,
        input: block.input,
      }

      let output = ''
      let isError = false
      try {
        const result = await client.callTool(block.name, block.input as Record<string, unknown>)
        output = result.content.map((c) => c.text).join('\n')
        isError = result.isError === true
      } catch (err) {
        output = err instanceof Error ? err.message : String(err)
        isError = true
      }

      yield { type: 'tool_call_result', id: block.id, output, isError }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: output,
        is_error: isError,
      })
    }

    messages.push({ role: 'user', content: toolResults })
    yield { type: 'turn_complete', turn }
  }

  yield { type: 'error', message: `Hit max turns (${MAX_TURNS}). Agent loop stopped.` }
}

export const SYSTEM_PROMPT = [
  'You are a helpful CRM assistant. The user manages contacts and interactions with business partners, leads, and customers.',
  '',
  'You have access to CRM tools. Use them proactively to answer questions accurately rather than guessing or asking for information you could look up.',
  '',
  'Rules:',
  '- Always use tools to check facts rather than making assumptions about the user\'s contacts.',
  '- When searching, try broader queries if narrow ones return nothing.',
  '- Keep final answers concise. Cite contact IDs like #3 when relevant.',
  '- Match the language of the user\'s question.',
].join('\n')