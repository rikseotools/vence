// __tests__/lib/observability/sentryHooks.test.ts
// Tests del hook tagDbTimeoutEvent.

import { tagDbTimeoutEvent } from '@/lib/observability/sentry-hooks'
import { DbTimeoutError } from '@/lib/db/timeout'
import type { Event, EventHint } from '@sentry/nextjs'

function makeEvent(): Event {
  return {
    event_id: 'abc',
    level: 'error',
    tags: {},
    extra: {},
  } as Event
}

describe('tagDbTimeoutEvent', () => {
  test('marca DbTimeoutError como warning con tags + extra', () => {
    const event = makeEvent()
    const hint: EventHint = { originalException: new DbTimeoutError(8000) }

    const result = tagDbTimeoutEvent(event, hint)

    expect(result).not.toBeNull()
    expect(result!.level).toBe('warning')
    expect(result!.tags).toMatchObject({
      quick_fail: 'db_timeout',
      component: 'db_timeout',
    })
    expect(result!.extra).toMatchObject({ timeoutMs: 8000 })
  })

  test('no toca event para errores normales', () => {
    const event = makeEvent()
    event.level = 'error'
    const hint: EventHint = { originalException: new Error('Connection refused') }

    const result = tagDbTimeoutEvent(event, hint)

    expect(result).toBe(event)
    expect(result!.level).toBe('error')
    expect(result!.tags).toEqual({}) // sin quick_fail
  })

  test('no toca event para non-Error', () => {
    const event = makeEvent()
    const hint: EventHint = { originalException: 'string error' as unknown as Error }

    const result = tagDbTimeoutEvent(event, hint)

    expect(result).toBe(event)
    expect(result!.tags).toEqual({})
  })

  test('no toca event sin originalException', () => {
    const event = makeEvent()
    const result = tagDbTimeoutEvent(event)

    expect(result).toBe(event)
    expect(result!.tags).toEqual({})
  })

  test('preserva tags y extra existentes (merge, no reemplaza)', () => {
    const event = makeEvent()
    event.tags = { existing: 'tag', another: 'value' }
    event.extra = { existing: 'extra' }
    const hint: EventHint = { originalException: new DbTimeoutError(15000) }

    const result = tagDbTimeoutEvent(event, hint)

    expect(result!.tags).toMatchObject({
      existing: 'tag',
      another: 'value',
      quick_fail: 'db_timeout',
      component: 'db_timeout',
    })
    expect(result!.extra).toMatchObject({
      existing: 'extra',
      timeoutMs: 15000,
    })
  })

  test('detecta DbTimeoutError-like sin instanceof (cross-realm)', () => {
    // Error con mismo name + timeoutMs pero no instancia real (cross-realm)
    const fake = new Error('fake')
    fake.name = 'DbTimeoutError'
    ;(fake as unknown as { timeoutMs: number }).timeoutMs = 5000

    const event = makeEvent()
    const result = tagDbTimeoutEvent(event, { originalException: fake })

    expect(result!.level).toBe('warning')
    expect(result!.tags).toMatchObject({ quick_fail: 'db_timeout' })
    expect(result!.extra).toMatchObject({ timeoutMs: 5000 })
  })
})
