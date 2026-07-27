import Store from 'electron-store'

/** Kept separate from settingsStore's AppSettings — this is a secret credential the user pastes
 *  in from their own Clockwork account, with no reason to ride along on the general settings
 *  broadcast to every window. */
const store = new Store<{ apiToken: string | null }>({ name: 'clockwork-credentials' })

export function getClockworkApiToken(): string | null {
  return store.get('apiToken') ?? null
}

export function setClockworkApiToken(token: string): void {
  const trimmed = token.trim()
  if (trimmed) store.set('apiToken', trimmed)
  else store.delete('apiToken')
}

export function hasClockworkApiToken(): boolean {
  return getClockworkApiToken() != null
}
