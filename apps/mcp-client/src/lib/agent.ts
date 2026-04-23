import Anthropic from '@anthropic-ai/sdk'
import type { McpClient } from './mcp/client'
import type { ToolDefinition } from './mcp/types'
import { PROXY_BASE_URL } from './proxy'

const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOKENS = 1024
const MAX_TURNS = 10

export type AgentEvent =
  | { type: 'thinking'; turn: number }
  | { type: 'text_delta'; turn: number; delta: string }
  | { type: 'tool_call_start'; turn: number; id: string; name: string; input: unknown }
  | { type: 'tool_call_result'; id: string; output: string; isError: boolean }
  | { type: 'turn_complete'; turn: number }
  | { type: 'done' }
  | { type: 'error'; message: string }

function toAnthropicTools(tools: ToolDefinition[]): Anthropic.Messages.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Messages.Tool['input_schema'],
  }))
}

export async function* runAgent(params: {
  client: McpClient
  tools: ToolDefinition[]
  userMessage: string
  systemPrompt: string
}): AsyncGenerator<AgentEvent> {
  const { client, tools, userMessage, systemPrompt } = params
  const anthropic = new Anthropic({ baseURL: PROXY_BASE_URL, apiKey: 'proxy', dangerouslyAllowBrowser: true })
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

    for (const block of response.content) {
      if (block.type === 'text' && block.text) {
        yield { type: 'text_delta', turn, delta: block.text }
      }
    }

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') {
      yield { type: 'turn_complete', turn }
      yield { type: 'done' }
      return
    }

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue

      yield { type: 'tool_call_start', turn, id: block.id, name: block.name, input: block.input }

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
