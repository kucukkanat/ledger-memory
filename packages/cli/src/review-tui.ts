import type { Conflict, Memory, Store } from '@ledger/core'
import { accent, ago, bar, bold, danger, dim, muted, truncate, warn, write } from './term.ts'

/**
 * The Review queue in the terminal.
 *
 * Same two lanes and the same keys as the web UI — `a` keep, `e` edit, `d`
 * drop, `p` pin for claims; `1`/`2`/`b`/`n` for conflicts — because muscle
 * memory should transfer between the two surfaces.
 */

const KEYS = {
  claim: `${accent('a')} keep   ${accent('e')} edit   ${danger('d')} drop   ${accent('p')} pin`,
  conflict: `${accent('1')} keep A   ${accent('2')} keep B   ${accent('b')} keep both   ${muted('n')} not a conflict   ${accent('m')} merge`,
  nav: `${dim('↑/↓ or j/k move · q quit')}`,
}

const renderClaim = (m: Memory, now: number): void => {
  write()
  write(
    `  ${dim(m.writer)}  ${dim(ago(m.createdAt, now))}  ${dim('·')}  ${muted(m.clusterLabel)}  ${bar(m.strength, 8)} ${dim(String(Math.round(m.strength * 100)))}`,
  )
  write(`  ${bold(m.text)}`)
  if (m.provenance) write(`  ${dim(m.provenance)}`)
}

const renderConflict = (c: Conflict, now: number): void => {
  write()
  write(
    `  ${warn('▲')} ${warn(c.kind)}  ${muted(c.a.clusterLabel)}  ${dim(`detector ${Math.round(c.detector * 100)}`)}`,
  )
  for (const [slot, m] of [
    ['A', c.a],
    ['B', c.b],
  ] as const) {
    write()
    write(
      `  ${bold(slot)}  ${dim(m.writer)} ${dim(ago(m.createdAt, now))}  ${bar(m.strength, 6)} ${dim(String(Math.round(m.strength * 100)))}`,
    )
    write(`     ${m.text}`)
  }
  if (c.note) write(`\n  ${dim(c.note)}`)
}

const prompt = async (question: string): Promise<string> => {
  process.stdout.write(`  ${question} `)
  for await (const line of console) return line
  return ''
}

/** Read one keypress in raw mode. Returns null on Ctrl-C or q. */
const readKey = async (): Promise<string | null> => {
  const stdin = process.stdin
  if (!stdin.isTTY) return null
  stdin.setRawMode(true)
  stdin.resume()
  return new Promise((resolve) => {
    stdin.once('data', (data: Buffer) => {
      stdin.setRawMode(false)
      stdin.pause()
      const key = data.toString()
      if (key === '' || key === 'q') resolve(null)
      else resolve(key)
    })
  })
}

const clear = (): void => {
  process.stdout.write('[2J[H')
}

export const runReview = async (store: Store): Promise<void> => {
  let lane: 'claims' | 'conflicts' = 'claims'
  let index = 0

  for (;;) {
    const claims = store.review.pending(200)
    const conflicts = store.conflicts.open(200)
    const now = store.now()

    if (claims.length === 0 && conflicts.length === 0) {
      clear()
      write()
      write(`  ${accent('QUEUE CLEAR')}`)
      write(
        `  ${muted(`Your agents are writing straight through. ${store.stats().memories} memories on this machine.`)}`,
      )
      write()
      return
    }

    if (lane === 'claims' && claims.length === 0) lane = 'conflicts'
    if (lane === 'conflicts' && conflicts.length === 0) lane = 'claims'

    const list: (Memory | Conflict)[] = lane === 'claims' ? claims : conflicts
    index = Math.max(0, Math.min(index, list.length - 1))
    const current = list[index]
    if (!current) return

    clear()
    write()
    write(
      `  ${bold('What your agents learned')}   ${
        lane === 'claims' ? accent(`CLAIMS ${claims.length}`) : dim(`claims ${claims.length}`)
      }  ${lane === 'conflicts' ? warn(`CONFLICTS ${conflicts.length}`) : dim(`conflicts ${conflicts.length}`)}`,
    )
    write(`  ${dim(`${index + 1} of ${list.length}`)}   ${dim('tab switches lane')}`)

    if (lane === 'claims') renderClaim(current as Memory, now)
    else renderConflict(current as Conflict, now)

    write()
    write(`  ${lane === 'claims' ? KEYS.claim : KEYS.conflict}`)
    write(`  ${KEYS.nav}`)

    const key = await readKey()
    if (key === null) {
      write()
      return
    }

    // Arrow keys arrive as escape sequences; j/k work everywhere.
    if (key === '[B' || key === 'j') {
      index += 1
      continue
    }
    if (key === '[A' || key === 'k') {
      index -= 1
      continue
    }
    if (key === '\t') {
      lane = lane === 'claims' ? 'conflicts' : 'claims'
      index = 0
      continue
    }

    if (lane === 'claims') {
      const claim = current as Memory
      if (key === 'a') store.review.keep(claim.id, 'human')
      else if (key === 'd') store.review.drop(claim.id, 'human')
      else if (key === 'p') store.review.pin(claim.id, 'human')
      else if (key === 'e') {
        write()
        const edited = await prompt(`${dim('new text:')}`)
        if (edited.trim()) store.review.edit(claim.id, edited.trim(), 'human')
      }
    } else {
      const conflict = current as Conflict
      const resolution = {
        '1': 'a',
        '2': 'b',
        b: 'both',
        m: 'merge',
        n: 'dismiss',
      } as const
      const chosen = resolution[key as keyof typeof resolution]
      if (chosen) store.conflicts.resolve(conflict.id, chosen, 'human')
    }
  }
}

export const printQueue = (store: Store): void => {
  const claims = store.review.pending(200)
  const conflicts = store.conflicts.open(200)
  const now = store.now()

  write()
  write(
    `  ${bold('Review queue')}  ${dim(`${claims.length} claims · ${conflicts.length} conflicts`)}`,
  )
  for (const claim of claims.slice(0, 20)) {
    write(
      `  ${dim(claim.id.slice(-6))}  ${bar(claim.strength, 6)}  ${dim(claim.writer.padEnd(7))} ${truncate(claim.text, 78)}`,
    )
  }
  for (const conflict of conflicts.slice(0, 20)) {
    write(`  ${warn('▲')} ${warn(conflict.kind.padEnd(22))} ${dim(ago(conflict.createdAt, now))}`)
    write(`      A  ${truncate(conflict.a.text, 76)}`)
    write(`      B  ${truncate(conflict.b.text, 76)}`)
  }
  write()
}
