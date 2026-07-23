import { randomUUID } from 'node:crypto'
import Store from 'electron-store'
import { WebSocket, WebSocketServer } from 'ws'
import type { DomainHistoryItem, OpenTabInfo } from '@shared/types'

const PORT = 51834
const REQUEST_TIMEOUT_MS = 2000

interface IncomingMessage {
  type?: string
  requestId?: string
  token?: string
  [key: string]: unknown
}

/** Kept separate from settingsStore's AppSettings — this token has no reason to reach every window. */
const pairingStore = new Store<{ pairingToken: string }>({ name: 'browser-pairing' })

function getOrCreatePairingToken(): string {
  let token = pairingStore.get('pairingToken')
  if (!token) {
    token = randomUUID()
    pairingStore.set('pairingToken', token)
  }
  return token
}

let wss: WebSocketServer | null = null
let authenticatedSocket: WebSocket | null = null
const pendingRequests = new Map<string, (message: IncomingMessage) => void>()

function handleAuthenticatedMessage(raw: string): void {
  let message: IncomingMessage
  try {
    message = JSON.parse(raw)
  } catch {
    return
  }
  if (!message.requestId) return
  const resolve = pendingRequests.get(message.requestId)
  if (!resolve) return
  pendingRequests.delete(message.requestId)
  resolve(message)
}

/**
 * The extension is the client (Chrome extensions can't accept inbound connections), so the app
 * hosts the server on a fixed local port and waits for it to connect and authenticate.
 */
export function startBrowserBridge(): void {
  if (wss) return
  wss = new WebSocketServer({ host: '127.0.0.1', port: PORT })

  wss.on('connection', (socket) => {
    socket.once('message', (data) => {
      let first: IncomingMessage
      try {
        first = JSON.parse(data.toString())
      } catch {
        socket.close()
        return
      }
      if (first.type !== 'auth' || first.token !== getOrCreatePairingToken()) {
        socket.close()
        return
      }
      authenticatedSocket = socket
      socket.on('message', (msg) => handleAuthenticatedMessage(msg.toString()))
    })

    socket.on('close', () => {
      if (authenticatedSocket === socket) authenticatedSocket = null
    })
  })
}

export function isExtensionConnected(): boolean {
  return authenticatedSocket !== null && authenticatedSocket.readyState === WebSocket.OPEN
}

export function getPairingToken(): string {
  return getOrCreatePairingToken()
}

/** Resolves to null (never rejects) if the extension is unpaired, disconnected, or slow to answer. */
function sendRequest(type: string, params: Record<string, unknown> = {}): Promise<IncomingMessage | null> {
  return new Promise((resolve) => {
    if (!authenticatedSocket || authenticatedSocket.readyState !== WebSocket.OPEN) {
      resolve(null)
      return
    }
    const requestId = randomUUID()
    const timeout = setTimeout(() => {
      pendingRequests.delete(requestId)
      resolve(null)
    }, REQUEST_TIMEOUT_MS)
    pendingRequests.set(requestId, (message) => {
      clearTimeout(timeout)
      resolve(message)
    })
    authenticatedSocket.send(JSON.stringify({ type, requestId, ...params }))
  })
}

export async function listOpenTabs(domain: string): Promise<OpenTabInfo[]> {
  const result = await sendRequest('listTabs', { domain })
  return (result?.tabs as OpenTabInfo[] | undefined) ?? []
}

export async function searchHistoryByDomain(domain: string): Promise<DomainHistoryItem[]> {
  const result = await sendRequest('searchHistoryByDomain', { domain })
  return (result?.items as DomainHistoryItem[] | undefined) ?? []
}
