import { openStore } from '@ledger/core'

/**
 * Fill a store with a plausible year of agent activity, so the UI can be seen
 * doing something before you have any memories of your own.
 *
 * Deterministic: the same seed produces the same store every time, which is
 * what makes it usable for screenshots and for eyeballing a UI change.
 *
 *   bun run demo                       # writes /tmp/ledger-demo.db
 *   bun run demo -- ./somewhere.db
 *   ledger serve --db /tmp/ledger-demo.db
 */

const DAY = 86_400_000
const NOW = Date.parse('2026-08-04T09:00:00Z')

const path = process.argv[2] ?? '/tmp/ledger-demo.db'

let clock = NOW
const store = openStore({ path, clock: () => clock })

/** Small deterministic PRNG — the demo must be byte-identical run to run. */
let seed = 20260804
const rnd = (): number => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const pick = <T>(list: readonly T[]): T => list[Math.floor(rnd() * list.length)] as T

const AGENTS = [
  { id: 'wren', role: 'daily assistant', write: 'prefs, people, home' },
  { id: 'forge', role: 'coding agent', write: 'code, projects' },
  { id: 'atlas', role: 'research agent', write: 'reading, projects, people' },
] as const

for (const a of AGENTS) {
  store.agents.describe(a.id, { role: a.role, writeScope: a.write, readScope: 'all clusters' })
}

/**
 * Slot-filled templates. Real-shaped sentences rather than lorem ipsum, because
 * the point of the demo is to show what good memories look like.
 */
const SLOT: Record<string, readonly string[]> = {
  pref: [
    'metric units',
    'inline citations',
    'short answers first',
    'ISO dates',
    'tables over prose',
    'plain-text email',
    '24-hour time',
  ],
  ctx: [
    'all outputs',
    'weekly digests',
    'code review notes',
    'research briefs',
    'anything shared publicly',
  ],
  dislike: [
    'hedging language',
    'emoji',
    'exclamation marks',
    'restated questions',
    'auto-generated titles',
  ],
  person: [
    'Mara Ostrowski',
    'Dr. Yuen',
    'Sam Ferreira',
    'Nadia Brandt',
    'Rowan Pike',
    'Iris Delacroix',
    'Priya Raman',
    'Lena Kovač',
  ],
  role: [
    'design lead',
    'staff engineer',
    'clinic manager',
    'contracts admin',
    'research partner',
    'accountant',
  ],
  org: ['Halden', 'Brightpath', 'Vessel Labs', 'Northline', 'Corda Health', 'Merit & Fold'],
  met: ['at Config 2024', 'through Sam', 'at the Lisbon offsite', 'in the Kestrel kickoff'],
  channel: ['Signal', 'email', 'a phone call', 'the shared doc'],
  mod: [
    'opal/parser',
    'opal/runtime',
    'opal-cli',
    'the wasm loader',
    'the retry wrapper',
    'migrations',
    'opal/router',
    'the CI cache',
  ],
  issue: [
    'panics on empty frontmatter',
    'leaks a file handle per run',
    'double-counts retries',
    'drops the trailing newline',
    'times out at 30s under load',
    'silently swallows 429s',
  ],
  fix: [
    'guarded in #4412',
    'patched on the 2.3 branch',
    'still open, tracked in #4610',
    'worked around with a mutex',
  ],
  never: [
    'run migrations after seed',
    'mutate the config object',
    'call it from a worker thread',
    'trust the cached manifest',
  ],
  why: ['it corrupts the index', 'the ordering is load-bearing', 'CI will pass and prod will not'],
  city: ['Lisbon', 'Reykjavík', 'Kyoto', 'Trieste', 'Ghent', 'Tromsø', 'Porto', 'Ljubljana'],
  place: [
    'an Alfama guesthouse',
    'the harbour apartment',
    'a ryokan near Gion',
    'a canal-side flat',
  ],
  placedetail: [
    'top floor, no lift',
    'check-in after 16:00',
    'ten minutes from the terminal',
    'quiet side, courtyard view',
  ],
  healthfact: [
    'Lactose intolerant; hard cheeses are fine',
    'Resting heart rate sits around 54',
    'Sleeps poorly above 20°C',
    'Takes vitamin D through winter',
  ],
  trainday: ['Tue/Thu/Sun', 'weekday mornings', 'Mon/Wed/Fri'],
  trainnote: ['8-10km, heart rate under 155', 'intervals on Thursdays', 'always before breakfast'],
  terms: ['net-30', 'net-45', 'on receipt', 'net-60'],
  payhabit: [
    'always late by about nine days',
    'pays early when invoiced Monday',
    'requires a PO number',
  ],
  moneything: ['quarterly tax', 'the studio rent', 'the hardware budget', 'the domain portfolio'],
  due: [
    'Apr 15, Jun 15, Sep 15, Jan 15',
    'the first working day of the month',
    'annually in January',
  ],
  device: [
    'The thermostat',
    'The router',
    'The kitchen lights',
    'The garage sensor',
    'The NAS',
    'The doorbell',
  ],
  devicefact: [
    'holds 19°C overnight, 21°C from 06:00',
    'reboots itself every Sunday 04:00',
    'takes E14 bulbs, 2700K',
    'runs on the guest VLAN',
  ],
  resetstep: [
    'hold the side button ten seconds',
    'pull power, wait a minute, repower',
    'reset from the app, not the device',
  ],
  idea: [
    'attention as a compression scheme',
    'that scale substitutes for structure',
    'that memory is retrieval, not storage',
    'that defaults decide behaviour',
  ],
  source: [
    'Peng 2023',
    'the Halden retro doc',
    'Chapter 4 of the ops handbook',
    'the Vessel Labs whitepaper',
    'the Northline postmortem',
  ],
  procgoal: [
    'ship a release',
    'onboard a new agent',
    'archive a project',
    'run the weekly review',
    'rotate credentials',
  ],
  procsteps: [
    'tag, changelog, publish, then announce',
    'provision, scope, dry-run, enable writes',
    'freeze, export, tombstone',
  ],
  ritual: [
    'The weekly review',
    'The Monday planning block',
    'The monthly cleanup',
    'The quarterly audit',
  ],
  when: ['Friday 16:00', 'Monday 09:30', 'the last Thursday of the month'],
  proj: [
    'Kestrel',
    'the Northline migration',
    'the ops handbook',
    'the Vessel integration',
    'the pricing revamp',
  ],
  projmove: ['moved to Sep 14', 'slipped a week', 'is on track', 'is paused', 'ships this Friday'],
  projreason: [
    'the security review',
    'the Halden dependency',
    'two people going on leave',
    'a scope change from Rowan',
  ],
  blocker: ['the Brightpath contract', 'a decision from Mara', 'the ARM builder', 'legal sign-off'],
}

const CLUSTERS: readonly {
  id: string
  n: number
  tags: readonly string[]
  templates: readonly string[]
}[] = [
  {
    id: 'prefs',
    n: 232,
    tags: ['style', 'ui', 'format'],
    templates: [
      'Prefers {pref} for {ctx}',
      'Dislikes {dislike} in {ctx}',
      'Default to {pref} unless asked otherwise',
    ],
  },
  {
    id: 'people',
    n: 208,
    tags: ['contact', 'org', 'intro'],
    templates: [
      '{person} — {role} at {org}, met {met}',
      '{person} prefers {channel} for anything time-sensitive',
      '{org} contact is {person}',
    ],
  },
  {
    id: 'code',
    n: 268,
    tags: ['opal', 'build', 'api', 'ci'],
    templates: ['{mod} {issue} — {fix}', 'Never {never} in {mod}; {why}', '{mod} {issue}'],
  },
  {
    id: 'travel',
    n: 176,
    tags: ['trip', 'booking', 'place'],
    templates: ['{city}: {place}, {placedetail}', 'Booked {place} for {city} — {placedetail}'],
  },
  {
    id: 'health',
    n: 148,
    tags: ['diet', 'training', 'medical'],
    templates: ['{healthfact}', 'Trains {trainday}, {trainnote}'],
  },
  {
    id: 'money',
    n: 132,
    tags: ['invoice', 'tax', 'sub'],
    templates: ['{org} invoices {terms}, {payhabit}', '{moneything} due {due}'],
  },
  {
    id: 'home',
    n: 156,
    tags: ['device', 'network', 'house'],
    templates: ['{device} {devicefact}', 'To reset {device}: {resetstep}'],
  },
  {
    id: 'reading',
    n: 214,
    tags: ['note', 'paper', 'quote'],
    templates: ['Highlighted: {idea}, from {source}', '{source} argues {idea}'],
  },
  {
    id: 'proc',
    n: 168,
    tags: ['runbook', 'ritual', 'checklist'],
    templates: [
      'To {procgoal}: {procsteps}',
      '{ritual} runs {when}',
      'Before you {procgoal}, {procsteps}',
    ],
  },
  {
    id: 'projects',
    n: 186,
    tags: ['kestrel', 'status', 'deadline'],
    templates: ['{proj} {projmove} after {projreason}', '{proj} is blocked on {blocker}'],
  },
]

const fill = (template: string): string =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => pick(SLOT[key] ?? ['—']))

const ids: string[] = []
for (const cluster of CLUSTERS) {
  for (let i = 0; i < cluster.n; i += 1) {
    // Creation skews recent: a store fills up faster the longer it is used.
    clock = NOW - rnd() ** 1.7 * 540 * DAY
    const written = store.memories.write({
      text: fill(pick(cluster.templates)),
      cluster: cluster.id,
      agent: pick(AGENTS).id,
      tags: [pick(cluster.tags)],
    })
    if (written.isOk()) ids.push(written.value.id)
  }
}
clock = NOW

/**
 * Retrieval history: a long tail nothing ever reads, a few memories the fleet
 * leans on constantly. Written straight to the columns rather than through
 * countReads so a year of history does not take a year of calls.
 */
const setReads = store.db.query('UPDATE memories SET hits = ?, last_read_at = ? WHERE id = ?')
const addReader = store.db.query(
  'INSERT OR IGNORE INTO memory_readers (memory_id, agent_id) VALUES (?, ?)',
)
const markReviewed = store.db.query('UPDATE memories SET reviewed_at = ? WHERE id = ?')

const history = store.db.transaction(() => {
  ids.forEach((id, i) => {
    const hits = i % 11 === 0 ? 60 + (i % 300) : i % 4 === 0 ? 6 + (i % 9) : i % 3 === 0 ? 2 : 0
    setReads.run(hits, NOW - rnd() ** 2 * 220 * DAY, id)
    if (i % 3 === 0) addReader.run(id, pick(AGENTS).id)
    if (i % 7 === 0) addReader.run(id, pick(AGENTS).id)
    // All but the most recent handful have already been through review.
    if (i < ids.length - 34) markReviewed.run(NOW, id)
  })
})
history()

store.memories.pin(
  ids.filter((_, i) => i % 73 === 0),
  true,
  'human',
)

for (let i = 0; i + 1 < ids.length; i += 2) {
  const a = ids[i]
  const b = ids[i + 1 + Math.floor(rnd() * 5)]
  if (a && b && a !== b) store.memories.link(a, b, 'forge')
}

/** Updates that genuinely contradict something already stored. */
const UPDATES: readonly (readonly [string, string])[] = [
  ['home', 'The thermostat overnight setpoint is 17.5°C since the heat pump install'],
  ['money', 'Brightpath moved to net-45 in the 2026 contract'],
  ['proc', 'The weekly review runs Thursday 09:30'],
  ['health', 'Trains Mon/Wed/Fri mornings after the knee strain'],
  ['travel', 'Reykjavík: the harbour apartment, check-in after 18:00'],
  ['projects', 'Kestrel ships Aug 28, per the exec update'],
  ['code', 'opal/parser drops the trailing newline — still open, tracked in #4610'],
]
UPDATES.forEach(([cluster, text], i) => {
  clock = NOW - (16 - i * 2) * DAY
  store.memories.write({ text, cluster, agent: i % 2 === 0 ? 'wren' : 'atlas' })
})
clock = NOW

/** An agent works through the candidates the store proposed. */
const KINDS = [
  'value drift',
  'stale terms',
  'stale schedule',
  'direct contradiction',
  'stale fact',
  'date conflict',
] as const
store.conflicts.candidates(30).forEach((candidate, i) => {
  store.conflicts.judge({
    candidateId: candidate.id,
    agent: pick(AGENTS).id,
    verdict: i < 6 ? 'conflict' : 'unrelated',
    kind: KINDS[i % KINDS.length] ?? 'value drift',
    detector: 0.55 + rnd() * 0.44,
    note: candidate.signals.join(', '),
  })
})

/** A few ingested documents, one of which has a claim distilled from it. */
const DOCS: readonly (readonly [string, string, string, number])[] = [
  [
    'ops-handbook-v4.md',
    'proc',
    '# Operations handbook\n\nThe weekly review runs Friday at 16:00.\n\n## Credential rotation\n\nRotate credentials on the first Tuesday after payday. Snapshot the index first.\n\n## Releases\n\nTag, changelog, publish, announce. Never run migrations after seed.',
    0.88,
  ],
  [
    'peng-2023-attention.pdf',
    'reading',
    '# Attention as compression\n\nWe argue that attention approximates a learned compression scheme.\n\n## Method\n\nSix benchmarks; scale substitutes for structure.\n\n## Results\n\nCoordination cost grows superlinearly with head count.',
    0.74,
  ],
  [
    'brightpath-contract-2026.pdf',
    'money',
    '# Master services agreement\n\nPayment terms are net-45 from receipt of a valid invoice.\n\n## Termination\n\nEither party may terminate with 60 days notice.',
    0.95,
  ],
  [
    'halden-retro.md',
    'projects',
    '# Halden retro\n\nThe dependency slipped a week.\n\n## Actions\n\nRowan owns the scope change. Design is locked, copy pending.',
    0.61,
  ],
  [
    'kestrel-security-review.docx',
    'code',
    '# Security review\n\nThe wasm loader runs unsandboxed.\n\n## Findings\n\nThree medium, one high. The high blocks the September ship date.',
    0.9,
  ],
]
for (const [filename, cluster, text, trust] of DOCS) {
  store.sources.ingest({ filename, cluster, agent: 'atlas', text, trust })
}

const handbook = store.sources.list().find((s) => s.filename === 'ops-handbook-v4.md')
if (handbook) {
  store.memories.write({
    text: 'Rotate credentials on the first Tuesday after payday',
    cluster: 'proc',
    agent: 'atlas',
    sourceId: handbook.id,
    provenance: 'distilled from ops-handbook-v4.md',
  })
}

const stats = store.stats()
process.stdout.write(
  `\n  ${path}\n` +
    `  ${stats.memories} memories · ${stats.claims} claims · ${stats.chunks} chunks\n` +
    `  ${stats.pending} pending review · ${stats.conflicts} open conflicts · ${stats.sources} sources\n\n` +
    `  ledger serve --db ${path}\n\n`,
)
store.close()
