import type { Transport } from './transport'
import type {
  CallToolParams,
  CallToolResult,
  InitializeResult,
  JsonRpcError,
  JsonRpcMessage,
  JsonRpcResponse,
  ListToolsResult,
  ToolDefinition,
} from './types'

export interface ClientInfo {
  name: string
  version: string
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: unknown) => void
}

/**
 * MCP Client. Wraps a Transport and provides a typed API for the three
 * methods we care about: initialize, listTools, callTool.
 *
 * Each outgoing request gets a unique id; the incoming response is matched
 * by id and resolves the corresponding promise. This id-based correlation
 * is a standard JSON-RPC 2.0 pattern.
 */
export class McpClient {
  private nextId = 1
  private pending = new Map<number | string, PendingRequest>()
  private serverInfo: InitializeResult['serverInfo'] | null = null
  private tools: ToolDefinition[] = []

  constructor(
    private readonly transport: Transport,
    private readonly info: ClientInfo,
  ) {
    transport.onMessage((msg) => this.handleMessage(msg))
  }

  async initialize(): Promise<InitializeResult> {
    const result = await this.request<InitializeResult>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      clientInfo: this.info,
    })
    this.serverInfo = result.serverInfo
    return result
  }

  async listTools(): Promise<ToolDefinition[]> {
    const result = await this.request<ListToolsResult>('tools/list', {})
    this.tools = result.tools
    return result.tools
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    return this.request<CallToolResult>('tools/call', {
      name,
      arguments: args,
    } satisfies CallToolParams)
  }

  getServerInfo() {
    return this.serverInfo
  }

  getTools() {
    return this.tools
  }

  // ---------- internals ----------

  private request<T>(method: string, params: unknown): Promise<T> {
    const id = this.nextId++
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    })
    this.transport.send({ jsonrpc: '2.0', id, method, params })
    return promise
  }

  private handleMessage(msg: JsonRpcMessage) {
    if (!('id' in msg) || msg.id == null) return
    const pending = this.pending.get(msg.id)
    if (!pending) return

    this.pending.delete(msg.id)

    const response = msg as JsonRpcResponse
    if ('error' in response) {
      const errObj = (response as JsonRpcError).error
      pending.reject(new Error(`${errObj.message} (code ${errObj.code})`))
    } else {
      pending.resolve(response.result)
    }
  }
}