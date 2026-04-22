import type { JsonRpcMessage } from './types'

/**
 * A Transport is a bidirectional message channel. Real MCP uses stdio
 * (for local processes) or SSE (for remote servers). Here we use an
 * in-process transport — client and server are both JS objects in the
 * same tab, connected by a pair of message queues.
 *
 * The point of keeping this abstraction clean: the Client and Server
 * code below never touch the transport directly. They speak JSON-RPC
 * objects. To switch to SSE, you only replace this file.
 */

export type MessageHandler = (msg: JsonRpcMessage) => void

export interface Transport {
  send(msg: JsonRpcMessage): void
  onMessage(handler: MessageHandler): void
  close(): void
}

/**
 * Create a linked pair of in-process transports. Whatever one side sends
 * is delivered asynchronously to the other side's handlers (via queueMicrotask
 * to preserve realistic async semantics — no same-tick reply).
 */
export function createInProcessPair(): { client: Transport; server: Transport } {
  let clientHandlers: MessageHandler[] = []
  let serverHandlers: MessageHandler[] = []
  let closed = false

  const client: Transport = {
    send(msg) {
      if (closed) return
      queueMicrotask(() => {
        for (const h of serverHandlers) h(msg)
      })
    },
    onMessage(h) {
      clientHandlers.push(h)
    },
    close() {
      closed = true
      clientHandlers = []
      serverHandlers = []
    },
  }

  const server: Transport = {
    send(msg) {
      if (closed) return
      queueMicrotask(() => {
        for (const h of clientHandlers) h(msg)
      })
    },
    onMessage(h) {
      serverHandlers.push(h)
    },
    close() {
      closed = true
      clientHandlers = []
      serverHandlers = []
    },
  }

  return { client, server }
}