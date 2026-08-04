import { describe, expect, test } from 'bun:test'
import { chunkText, extensionOf, isNative, readSourceFile } from './ingest.ts'

describe('extensions', () => {
  test('reads the extension off a path', () => {
    expect(extensionOf('/a/b/ops-handbook-v4.md')).toBe('md')
    expect(extensionOf('Kestrel Security Review.DOCX')).toBe('docx')
    expect(extensionOf('LICENSE')).toBe('')
  })

  test('knows which formats it can read without a parser', () => {
    expect(isNative('notes.md')).toBe(true)
    expect(isNative('inventory.csv')).toBe(true)
    expect(isNative('postmortem.pdf')).toBe(false)
  })
})

describe('chunking', () => {
  test('splits on blank lines and packs up to the target', () => {
    const text = ['alpha'.repeat(100), 'beta'.repeat(100), 'gamma'.repeat(100)].join('\n\n')
    const chunks = chunkText(text, { target: 600, max: 1200 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.length <= 1200)).toBe(true)
  })

  test('starts a new chunk at a heading so a section keeps its title', () => {
    const text = '# Rotation\n\nRotate on Tuesday.\n\n# Freeze\n\nFreeze the index.'
    const chunks = chunkText(text, { target: 5000, max: 6000 })
    expect(chunks).toHaveLength(2)
    expect(chunks[0]).toStartWith('# Rotation')
    expect(chunks[1]).toStartWith('# Freeze')
  })

  test('splits an oversized paragraph at sentence boundaries', () => {
    const sentence = 'The loader times out at thirty seconds under load. '
    const chunks = chunkText(sentence.repeat(60), { target: 400, max: 500 })
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks.every((c) => c.length <= 500)).toBe(true)
    expect(chunks.every((c) => c.trim().endsWith('.'))).toBe(true)
  })

  test('never loses content', () => {
    const text = 'One.\n\nTwo.\n\n# Three\n\nFour.'
    const joined = chunkText(text).join(' ').replace(/\s+/g, ' ')
    for (const word of ['One.', 'Two.', 'Three', 'Four.']) expect(joined).toContain(word)
  })

  test('returns a single chunk for a short document', () => {
    expect(chunkText('Just the one line.')).toEqual(['Just the one line.'])
  })
})

describe('reading files', () => {
  test('reads a native format off disk', async () => {
    const path = `${import.meta.dir}/../fixtures/ops-handbook.md`
    const result = await readSourceFile(path)
    const source = result._unsafeUnwrap()
    expect(source.filename).toBe('ops-handbook.md')
    expect(source.ext).toBe('md')
    expect(source.text).toContain('Rotate credentials')
    expect(source.bytes).toBeGreaterThan(0)
  })

  test('refuses a format it cannot parse, and says what to do instead', async () => {
    const result = await readSourceFile('/tmp/northline-postmortem.pdf')
    const failure = result._unsafeUnwrapErr()
    expect(failure.kind).toBe('unreadable-source')
    if (failure.kind === 'unreadable-source') expect(failure.reason).toContain('parser')
  })

  test('reports a missing file rather than throwing', async () => {
    const result = await readSourceFile('/tmp/definitely-not-here-9f3a.md')
    expect(result._unsafeUnwrapErr()).toMatchObject({
      kind: 'unreadable-source',
    })
  })
})
