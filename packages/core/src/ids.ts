const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

/**
 * Short, sortable, collision-resistant ids: a base-36 millisecond timestamp
 * followed by 6 random characters. Sortable matters — `m` ids in creation order
 * make the event log and any hand-written SQL readable.
 */
export const newId = (prefix: string): string => {
  const time = Date.now().toString(36)
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  let random = ''
  for (const b of bytes) random += ALPHABET[b % ALPHABET.length]
  return `${prefix}_${time}${random}`
}

/** Slugify a label into a cluster id. */
export const slug = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
