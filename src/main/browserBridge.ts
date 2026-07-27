import { randomUUID } from 'node:crypto'
import Store from 'electron-store'
import { WebSocket, WebSocketServer } from 'ws'
import type { DomainHistoryItem, OpenTabInfo } from '@shared/types'

const PORT = 51834
const REQUEST_TIMEOUT_MS = 2000

// A fixed, publicly-known value on purpose — always accepted, dev or packaged, alongside the real
// per-install token, so the extension can just connect with zero pairing step at all (this is a
// single-user local app; the WS server only ever listens on 127.0.0.1). The extension tries this
// constant whenever it has no token saved (see background.js).
const DEV_PAIRING_TOKEN = 'dev-pairing-token-insecure-local-only'

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

  wss.on('error', (error) => {
    console.error(`Browser extension bridge could not listen on 127.0.0.1:${PORT}`, error)
    wss?.close()
    wss = null
  })

  wss.on('connection', (socket) => {
    socket.once('message', (data) => {
      let first: IncomingMessage
      try {
        first = JSON.parse(data.toString())
      } catch {
        socket.close()
        return
      }
      const isAuthorized = first.type === 'auth' && (first.token === DEV_PAIRING_TOKEN || first.token === getOrCreatePairingToken())
      if (!isAuthorized) {
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
  // Deliberately no fallback cache here, unlike history below — a stale "open tabs" list would
  // actively lie about what's currently open once Chrome's gone, rather than just being outdated.
  return (result?.tabs as OpenTabInfo[] | undefined) ?? []
}

/** Last successful history fetch, kept per-domain so a stale result is never shown for a domain
 *  filter it doesn't actually match. Lives only in memory — resets on app restart. */
let lastKnownHistory: { domain: string; items: DomainHistoryItem[] } | null = null

export async function searchHistoryByDomain(domain: string): Promise<DomainHistoryItem[]> {
  const result = await sendRequest('searchHistoryByDomain', { domain })
  const items = result?.items as DomainHistoryItem[] | undefined
  if (items) {
    lastKnownHistory = { domain, items }
    return items
  }
  // Extension unreachable (e.g. Chrome is closed) — history doesn't stop being true just because
  // Chrome isn't running right now, so keep showing the last known results instead of going blank.
  if (lastKnownHistory && lastKnownHistory.domain === domain) return lastKnownHistory.items
  return []
}
