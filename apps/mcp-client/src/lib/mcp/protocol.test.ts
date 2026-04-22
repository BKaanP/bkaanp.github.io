import { describe, expect, it } from 'vitest'
import { McpClient } from './client'
import { McpServer } from './server'
import { createInProcessPair } from './transport'
import { ErrorCode } from './types'

/**
 * Protocol-level tests for the MCP client/server pair. These exercise the
 * real JSON-RPC machinery — request/response correlation, initialize
 * handshake, tool listing, tool calls, and error paths — without any
 * network, LLM, or database. Fast and deterministic.
 */

function makeTestServer() {
  const server = new McpServer({ name: 'test', version: '1.0.0' })
  server.addTool(
    {
      name: 'echo',
      description: 'Returns the input text verbatim.',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' } },
        required: ['text'],
      },
    },
    async ({ text }) => ({
      content: [{ type: 'text', text: `echo: ${text}` }],
    }),
  )
  server.addTool(
    {
      name: 'throws',
      description: 'Always throws.',
      inputSchema: { type: 'object', properties: {} },
    },
    async () => {
      throw new Error('intentional failure')
    },
  )
  return server
}

function wire() {
  const { client: ct, server: st } = createInProcessPair()
  const server = makeTestServer()
  server.connect(st)
  const client = new McpClient(ct, { name: 'test-client', version: '1.0.0' })
  return { client, server }
}

describe('MCP protocol', () => {
  it('initializes successfully', async () => {
    const { client } = wire()
    const result = await client.initialize()
    expect(result.serverInfo.name).toBe('test')
    expect(result.serverInfo.version).toBe('1.0.0')
    expect(result.protocolVersion).toBe('2024-11-05')
  })

  it('lists tools after initialization', async () => {
    const { client } = wire()
    await client.initialize()
    const tools = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual(['echo', 'throws'])
  })

  it('rejects listTools before initialize', async () => {
    const { client } = wire()
    await expect(client.listTools()).rejects.toThrow(/not initialized/i)
  })

  it('calls a tool and returns its result', async () => {
    const { client } = wire()
    await client.initialize()
    const result = await client.callTool('echo', { text: 'hello' })
    expect(result.content[0]).toEqual({ type: 'text', text: 'echo: hello' })
    expect(result.isError).toBeFalsy()
  })

  it('returns tool errors with isError flag instead of throwing', async () => {
    const { client } = wire()
    await client.initialize()
    const result = await client.callTool('throws', {})
    expect(result.isError).toBe(true)
    expect(result.content[0]?.text).toContain('intentional failure')
  })

  it('rejects calls to unknown tools at the protocol level', async () => {
    const { client } = wire()
    await client.initialize()
    await expect(client.callTool('nonexistent', {})).rejects.toThrow(/not found/i)
  })

  it('correlates concurrent requests by id', async () => {
    const { client } = wire()
    await client.initialize()
    // Fire multiple calls in parallel; each should resolve to its own result
    const results = await Promise.all([
      client.callTool('echo', { text: 'a' }),
      client.callTool('echo', { text: 'b' }),
      client.callTool('echo', { text: 'c' }),
    ])
    expect(results[0]?.content[0]?.text).toBe('echo: a')
    expect(results[1]?.content[0]?.text).toBe('echo: b')
    expect(results[2]?.content[0]?.text).toBe('echo: c')
  })
})

describe('MCP error codes', () => {
  it('exports the standard JSON-RPC error code constants', () => {
    expect(ErrorCode.MethodNotFound).toBe(-32601)
    expect(ErrorCode.InvalidParams).toBe(-32602)
    expect(ErrorCode.InternalError).toBe(-32603)
  })
})