import { openStore, type Store, type StoreOptions } from '@ledger/core'
import { Hono } from 'hono'
import { createApi } from './api.ts'

export { createApi } from './api.ts'

export type ServerOptions = {
  readonly store: StoreOptions
  readonly port?: number
  /**
   * Interface to bind.
   *
   * Loopback by default and on purpose: this is the whole privacy claim. A
   * store that never leaves the machine is a store nothing off the machine can
   * reach. Changing this is a deliberate act, not a default.
   */
  readonly host?: string
  /** Directory of built UI assets. Omit to run headless. */
  readonly ui?: string
}

export const DEFAULT_PORT = 7444

/**
 * The supervision server: the API the UI talks to, and the UI itself.
 *
 * There is no agent-facing surface here. Agents reach the store through the
 * bundled CLI, which opens the SQLite file directly — so this process is
 * something you start when you want to *look* at your memory, and can leave
 * stopped the rest of the time without agents losing the ability to remember.
 *
 * Nothing here counts as retrieval. A human reading the store is not evidence
 * that a memory is useful.
 */
export const createServer = (options: ServerOptions) => {
  const store: Store = openStore(options.store)
  const app = new Hono()

  app.route('/api', createApi(store))

  app.get('/health', (c) =>
    c.json({ ok: true, memories: store.stats().memories, version: '0.1.0' }),
  )

  if (options.ui) {
    const root = options.ui
    app.get('*', async (c) => {
      const path = new URL(c.req.url).pathname
      const candidate = Bun.file(`${root}${path === '/' ? '/index.html' : path}`)
      if (await candidate.exists()) return new Response(candidate)
      // Single-page app: unknown paths are routes, not missing files.
      return new Response(Bun.file(`${root}/index.html`))
    })
  }

  const port = options.port ?? DEFAULT_PORT
  const hostname = options.host ?? '127.0.0.1'

  return {
    store,
    app,
    listen: () => {
      const server = Bun.serve({
        port,
        hostname,
        fetch: app.fetch,
        idleTimeout: 60,
      })
      return {
        url: `http://${hostname}:${port}`,
        stop: async (): Promise<void> => {
          await server.stop(true)
          store.close()
        },
      }
    },
  }
}
