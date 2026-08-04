import { describe, expect, test } from 'bun:test'
import { contentTokens, OVERLAP_FLOOR, pairKey, suspect } from './conflicts.ts'

describe('contentTokens', () => {
  test('drops stopwords, punctuation and bare numbers', () => {
    const tokens = contentTokens('The thermostat holds 19°C overnight.')
    expect([...tokens].sort()).toEqual(['holds', 'overnight', 'thermostat'])
  })

  test('keeps numbers that carry meaning beyond the digits', () => {
    expect(contentTokens('Passport valid to 2036-02')).toContain('2036-02')
  })

  test('is case-insensitive', () => {
    expect(contentTokens('Kestrel')).toEqual(contentTokens('kestrel'))
  })
})

describe('suspect', () => {
  test('proposes a pair that shares a subject but differs on the number', () => {
    const s = suspect(
      'The thermostat holds 19°C overnight, 21°C from 06:00',
      'The thermostat overnight setpoint is 17.5°C since the heat pump install',
    )
    expect(s).not.toBeNull()
    expect(s?.signals).toContain('divergent numbers')
  })

  test('proposes a pair that differs on the weekday schedule', () => {
    const s = suspect(
      'Trains Tue/Thu/Sun, 8-10km under heart rate 155',
      'Trains Mon/Wed/Fri mornings after the knee strain',
    )
    expect(s?.signals).toContain('divergent weekdays')
  })

  test('proposes a pair where only one side is a negation', () => {
    const s = suspect(
      'Lactose intolerant; hard cheeses are fine',
      'Lactose intolerant, avoids all hard cheeses since March',
    )
    expect(s?.signals).toContain('negation on one side')
  })

  test('proposes a pair that differs on the clock time', () => {
    const s = suspect(
      'The weekly review runs Friday 16:00 for 25 minutes',
      'The weekly review runs Friday 09:30 for 25 minutes',
    )
    expect(s?.signals).toContain('divergent times')
  })

  test('stays silent on unrelated claims even when both contain numbers', () => {
    expect(suspect('Kestrel ships Sep 14', 'The router runs firmware 3.4')).toBeNull()
  })

  test('stays silent on two claims that agree', () => {
    expect(
      suspect('The thermostat holds 19°C overnight', 'The thermostat holds 19°C overnight'),
    ).toBeNull()
  })

  test('stays silent when claims overlap but nothing concrete diverges', () => {
    // Same subject, compatible detail, no numbers/dates/negation in tension.
    expect(
      suspect('Mara Ostrowski is design lead at Halden', 'Mara Ostrowski is design lead at Halden'),
    ).toBeNull()
  })

  test('scores a pair with more divergence signals higher, overlap held equal', () => {
    // Both pairs have identical content tokens on each side — bare numbers are
    // excluded from tokens — so only the signal count differs.
    const one = suspect('Renews every 12 months', 'Renews every 24 months')
    const two = suspect('Review runs at 16:00', 'Review runs at 17:00')
    expect(one?.signals).toEqual(['divergent numbers'])
    expect(two?.signals).toEqual(['divergent numbers', 'divergent times'])
    expect(two?.score).toBeGreaterThan(one?.score ?? 1)
  })

  test('scores a pair with more topical overlap higher, signals held equal', () => {
    const close = suspect('Review runs at 16:00', 'Review runs at 17:00')
    const looser = suspect('Review runs at 16:00', 'Review meeting starts at 17:00')
    expect(close?.signals).toEqual(looser?.signals ?? [])
    expect(close?.score).toBeGreaterThan(looser?.score ?? 1)
  })

  test('proposes a rewritten update that shares only its subject', () => {
    // The whole-text overlap here is ~0.07; the subject match is what catches it.
    const s = suspect(
      'Trains Tue/Thu/Sun, 8-10km with heart rate under 155',
      'Trains Mon/Wed/Fri mornings after the knee strain',
    )
    expect(s).not.toBeNull()
    expect(s?.signals).toContain('divergent weekdays')
  })

  test('is symmetric in its score', () => {
    const a = 'Brightpath invoices net-30 and pays late'
    const b = 'Brightpath invoices net-45 and pays late'
    expect(suspect(a, b)?.score).toBe(suspect(b, a)?.score ?? -1)
  })

  test('rejects pairs below the overlap floor before looking at signals', () => {
    const s = suspect('Passport expires 2029-04', 'The CI cache takes 9 minutes cold')
    expect(s).toBeNull()
    expect(OVERLAP_FLOOR).toBeGreaterThan(0)
  })
})

describe('pairKey', () => {
  test('orders a pair the same way regardless of argument order', () => {
    expect(pairKey('m2', 'm1')).toEqual(pairKey('m1', 'm2'))
  })
})
