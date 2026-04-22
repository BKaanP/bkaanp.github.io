import type { Transport } from './transport'
import {
  ErrorCode,
  type CallToolParams,
  type CallToolResult,
  type InitializeParams,
  type InitializeResult,
  type JsonRpcMessage,
  type JsonRpcRequest,
  type ListToolsResult,
  type ToolDefinition,
} from './types'

export type ToolHandler = (args: Record<string, unknown>) => Promise<CallToolResult>

export interface ServerInfo {
  name: string
  version: string
}

/**
 * Base class for an MCP server. Subclasses register tools via `addTool`.
 * The class handles the protocol layer: initialize handshake, tools/list,
 * tools/call, and error responses in spec-compliant JSON-RPC form.
 */
export class McpServer {
  private tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler }>()
  private transport: Transport | null = null
  private initialized = false

  constructor(private readonly info: ServerInfo) {}

  addTool(definition: ToolDefinition, handler: ToolHandler) {
    this.tools.set(definition.name, { definition, handler })
  }

  connect(transport: Transport) {
    this.transport = transport
    transport.onMessage((msg) => this.handleMessage(msg))
  }

  private async handleMessage(msg: JsonRpcMessage) {
    if (!('id' in msg) || !('method' in msg)) return // notifications ignored for now

    const req = msg as JsonRpcRequest

    try {
      const result = await this.dispatch(req.method, req.params)
      this.transport?.send({ jsonrpc: '2.0', id: req.id, result })
    } catch (err) {
      const e = err as { code?: number; message?: string }
      this.transport?.send({
        jsonrpc: '2.0',
        id: req.id,
        error: {
          code: e.code ?? ErrorCode.InternalError,
          message: e.message ?? String(err),
        },
      })
    }
  }

  private async dispatch(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case 'initialize':
        return this.handleInitialize(params as InitializeParams)
      case 'tools/list':
        this.requireInitialized()
        return this.handleListTools()
      case 'tools/call':
        this.requireInitialized()
        return this.handleCallTool(params as CallToolParams)
      default:
        throw { code: ErrorCode.MethodNotFound, message: `Unknown method: ${method}` }
    }
  }

  private handleInitialize(_params: InitializeParams): InitializeResult {
    this.initialized = true
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: this.info,
    }
  }

  private handleListTools(): ListToolsResult {
    return {
      tools: [...this.tools.values()].map((t) => t.definition),
    }
  }

  private async handleCallTool(params: CallToolParams): Promise<CallToolResult> {
    const entry = this.tools.get(params.name)
    if (!entry) {
      throw { code: ErrorCode.MethodNotFound, message: `Tool not found: ${params.name}` }
    }
    try {
      return await entry.handler(params.arguments ?? {})
    } catch (err) {
      // Tool errors go into the result as isError=true, not as JSON-RPC errors.
      // This matches MCP spec — protocol errors vs. tool-domain errors.
      return {
        content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
        isError: true,
      }
    }
  }

  private requireInitialized() {
    if (!this.initialized) {
      throw { code: ErrorCode.InvalidRequest, message: 'Server not initialized' }
    }
  }
}