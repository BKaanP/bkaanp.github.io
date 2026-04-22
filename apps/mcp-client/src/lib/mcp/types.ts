/**
 * MCP Protocol — minimal but spec-compatible type definitions.
 *
 * MCP uses JSON-RPC 2.0 as its wire format. Every message is either
 * a Request (expects a Response), a Response (reply to a Request),
 * or a Notification (fire-and-forget).
 *
 * We implement the subset needed for: initialize handshake, list tools,
 * and call tools. Full spec also covers resources, prompts, sampling,
 * logging, and progress — all omitted here for clarity.
 *
 * Reference: https://spec.modelcontextprotocol.io/
 */
 
// ---------- JSON-RPC 2.0 envelopes ----------
 
export interface JsonRpcRequest<T = unknown> {
  jsonrpc: '2.0'
  id: number | string
  method: string
  params?: T
}
 
export interface JsonRpcSuccess<T = unknown> {
  jsonrpc: '2.0'
  id: number | string
  result: T
}
 
export interface JsonRpcError {
  jsonrpc: '2.0'
  id: number | string | null
  error: {
    code: number
    message: string
    data?: unknown
  }
}
 
export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcError
 
export interface JsonRpcNotification<T = unknown> {
  jsonrpc: '2.0'
  method: string
  params?: T
}
 
export type JsonRpcMessage =
  | JsonRpcRequest
  | JsonRpcSuccess
  | JsonRpcError
  | JsonRpcNotification
 
// ---------- MCP-specific payloads ----------
 
export interface InitializeParams {
  protocolVersion: string
  capabilities: {
    tools?: Record<string, never>
  }
  clientInfo: {
    name: string
    version: string
  }
}
 
export interface InitializeResult {
  protocolVersion: string
  capabilities: {
    tools?: { listChanged?: boolean }
  }
  serverInfo: {
    name: string
    version: string
  }
}
 
/**
 * A tool definition the server exposes. The inputSchema follows JSON Schema.
 * When the client lists tools, it also passes this schema to the LLM so the
 * LLM knows what parameters each tool expects.
 */
export interface ToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}
 
export interface ListToolsResult {
  tools: ToolDefinition[]
}
 
export interface CallToolParams {
  name: string
  arguments: Record<string, unknown>
}
 
export interface CallToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}
 
// ---------- Error codes (subset of JSON-RPC 2.0 standard) ----------
 
export const ErrorCode = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
} as const
 