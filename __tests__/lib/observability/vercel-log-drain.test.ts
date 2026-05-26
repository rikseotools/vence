/**
 * @jest-environment node
 */
// __tests__/lib/observability/vercel-log-drain.test.ts
//
// Tests del parser PURO Vercel Log Drain → ObservableEvent.

import {
  parseVercelLogBody,
  shouldPersist,
  toObservableEvent,
  type VercelLogEntry,
} from '@/lib/observability/vercel-log-drain'

describe('parseVercelLogBody', () => {
  it('parsea NDJSON (formato preferido de Vercel)', () => {
    const ndjson = [
      JSON.stringify({ id: '1', message: 'a' }),
      JSON.stringify({ id: '2', message: 'b' }),
      JSON.stringify({ id: '3', message: 'c' }),
    ].join('\n')
    const result = parseVercelLogBody(ndjson)
    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('1')
    expect(result[2].message).toBe('c')
  })

  it('parsea JSON array (formato legacy)', () => {
    const array = JSON.stringify([
      { id: '1', message: 'a' },
      { id: '2', message: 'b' },
    ])
    const result = parseVercelLogBody(array)
    expect(result).toHaveLength(2)
  })

  it('parsea JSON object único', () => {
    const single = JSON.stringify({ id: '1', message: 'lone' })
    const result = parseVercelLogBody(single)
    expect(result).toHaveLength(1)
    expect(result[0].message).toBe('lone')
  })

  it('ignora líneas vacías y separadores en NDJSON', () => {
    const ndjson = '\n' + JSON.stringify({ id: '1' }) + '\n\n' + JSON.stringify({ id: '2' }) + '\n'
    const result = parseVercelLogBody(ndjson)
    expect(result).toHaveLength(2)
  })

  it('ignora líneas malformadas pero conserva el resto', () => {
    const ndjson = [
      JSON.stringify({ id: '1' }),
      '{ broken json',
      JSON.stringify({ id: '2' }),
    ].join('\n')
    const result = parseVercelLogBody(ndjson)
    expect(result).toHaveLength(2)
    expect(result.map((e) => e.id)).toEqual(['1', '2'])
  })

  it('body vacío → []', () => {
    expect(parseVercelLogBody('')).toEqual([])
    expect(parseVercelLogBody('   ')).toEqual([])
    expect(parseVercelLogBody('\n\n')).toEqual([])
  })

  it('body totalmente malformado → []', () => {
    expect(parseVercelLogBody('not json at all')).toEqual([])
  })
})

describe('shouldPersist', () => {
  it('statusCode ≥ 500 → SÍ persiste', () => {
    expect(shouldPersist({ statusCode: 500 })).toBe(true)
    expect(shouldPersist({ statusCode: 504 })).toBe(true)
    expect(shouldPersist({ responseStatusCode: 503 })).toBe(true)
  })

  it('statusCode ∈ [400, 499] → SÍ persiste', () => {
    expect(shouldPersist({ statusCode: 401 })).toBe(true)
    expect(shouldPersist({ statusCode: 404 })).toBe(true)
    expect(shouldPersist({ statusCode: 429 })).toBe(true)
  })

  it('statusCode < 400 → NO persiste salvo level=error/warn', () => {
    expect(shouldPersist({ statusCode: 200 })).toBe(false)
    expect(shouldPersist({ statusCode: 304 })).toBe(false)
    expect(shouldPersist({ statusCode: 200, level: 'error' })).toBe(true)
    expect(shouldPersist({ statusCode: 200, level: 'warning' })).toBe(true)
  })

  it('sin statusCode pero level=error/warn → SÍ persiste', () => {
    expect(shouldPersist({ level: 'error', message: 'build failed' })).toBe(true)
    expect(shouldPersist({ level: 'warn', message: 'something' })).toBe(true)
    expect(shouldPersist({ level: 'warning', message: 'something' })).toBe(true)
  })

  it('level=info sin statusCode → NO persiste (ruido de éxito)', () => {
    expect(shouldPersist({ level: 'info', message: 'OK' })).toBe(false)
    expect(shouldPersist({ message: 'no level' })).toBe(false)
  })

  it('caso original Gap 14: 504 Runtime Timeout → SÍ persiste', () => {
    const entry: VercelLogEntry = {
      id: 'log_xxx',
      timestamp: 1716663060000,
      message: 'Vercel Runtime Timeout Error: Task timed out after 300 seconds',
      source: 'lambda',
      statusCode: 504,
      path: '/api/v2/admin/dashboard',
      method: 'GET',
    }
    expect(shouldPersist(entry)).toBe(true)
  })
})

describe('toObservableEvent', () => {
  it('caso Gap 14 — 504 Runtime Timeout → eventType=runtime_kill, severity=critical', () => {
    const entry: VercelLogEntry = {
      id: 'log_xxxxxxxxxxxxxxxx',
      timestamp: 1716663060000,
      message: 'Vercel Runtime Timeout Error: Task timed out after 300 seconds',
      level: 'error',
      source: 'lambda',
      deploymentId: 'dpl_abcdefgh12345',
      projectId: 'prj_xxxxx',
      host: 'www.vence.es',
      path: '/api/v2/admin/dashboard',
      method: 'GET',
      statusCode: 504,
      requestId: 'req_xxx',
      executionRegion: 'lhr1',
    }
    const ev = toObservableEvent(entry)
    expect(ev.source).toBe('vercel')
    expect(ev.severity).toBe('critical')
    expect(ev.eventType).toBe('runtime_kill')
    expect(ev.endpoint).toBe('/api/v2/admin/dashboard')
    expect(ev.httpStatus).toBe(504)
    expect(ev.errorMessage).toContain('Runtime Timeout')
    expect(ev.deployVersion).toBe('abcdefgh')
    expect(ev.metadata).toMatchObject({
      drain: true,
      vercelLogId: 'log_xxxxxxxxxxxxxxxx',
      vercelSource: 'lambda',
      executionRegion: 'lhr1',
      requestId: 'req_xxx',
      method: 'GET',
      host: 'www.vence.es',
    })
  })

  it('500 genérico (no timeout) → eventType=http_5xx', () => {
    const ev = toObservableEvent({
      message: 'Internal Server Error',
      statusCode: 500,
      path: '/api/foo',
    })
    expect(ev.eventType).toBe('http_5xx')
    expect(ev.severity).toBe('critical')
  })

  it('500 con "exceeded memory" → eventType=runtime_kill', () => {
    const ev = toObservableEvent({
      message: 'Lambda exceeded memory limit',
      statusCode: 500,
    })
    expect(ev.eventType).toBe('runtime_kill')
  })

  it('4xx → eventType=http_4xx, severity=warn', () => {
    const ev = toObservableEvent({ statusCode: 401, path: '/api/profile' })
    expect(ev.eventType).toBe('http_4xx')
    expect(ev.severity).toBe('warn')
  })

  it('build error → eventType=deploy_failed', () => {
    const ev = toObservableEvent({
      level: 'error',
      source: 'build',
      message: 'Build failed: type error in foo.ts',
    })
    expect(ev.eventType).toBe('deploy_failed')
    expect(ev.severity).toBe('error')
  })

  it('genérico sin status → eventType=vercel_log', () => {
    const ev = toObservableEvent({
      level: 'warning',
      message: 'cold start detected',
      source: 'lambda',
    })
    expect(ev.eventType).toBe('vercel_log')
    expect(ev.severity).toBe('warn')
  })

  it('timestamp → ISO string en ts', () => {
    const ev = toObservableEvent({ timestamp: 1716663060000, statusCode: 500 })
    expect(typeof ev.ts).toBe('string')
    expect(ev.ts).toMatch(/^2024-/)
  })

  it('sin timestamp → ts undefined (sink usa NOW())', () => {
    const ev = toObservableEvent({ statusCode: 500 })
    expect(ev.ts).toBeUndefined()
  })

  it('truncates errorMessage a 2000 chars', () => {
    const long = 'x'.repeat(5000)
    const ev = toObservableEvent({ statusCode: 500, message: long })
    expect(ev.errorMessage?.length).toBe(2000)
  })

  it('truncates userAgent a 200 chars en metadata', () => {
    const long = 'UA-' + 'x'.repeat(500)
    const ev = toObservableEvent({ statusCode: 500, requestUserAgent: long })
    expect((ev.metadata?.userAgent as string).length).toBe(200)
  })

  it('deploymentId sin prefix "dpl_" → slice directo a 8 chars', () => {
    const ev = toObservableEvent({ statusCode: 500, deploymentId: 'abcdefgh12345' })
    expect(ev.deployVersion).toBe('abcdefgh')
  })

  it('sin deploymentId → deployVersion null', () => {
    const ev = toObservableEvent({ statusCode: 500 })
    expect(ev.deployVersion).toBeNull()
  })
})
