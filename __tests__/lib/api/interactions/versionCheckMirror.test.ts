// __tests__/lib/api/interactions/versionCheckMirror.test.ts
//
// [T-168] user_interactions está bloqueada por RLS para el rol de lectura de la flota
// (0 filas sin error, indistinguible de "no hay eventos") — estos dos tests cubren el
// espejo que hace legible, sin esa migración, la señal que delata un deploy cortando un
// test real: version_check_reload_immediate.

import {
  severidadEspejoVersionCheck,
  construirEventoEspejo,
} from '@/lib/api/interactions/versionCheckMirror'

describe('severidadEspejoVersionCheck — qué se espeja y con qué urgencia', () => {
  it('reload_immediate es la señal de DAÑO: warn', () => {
    expect(severidadEspejoVersionCheck('version_check_reload_immediate')).toBe('warn')
  })

  it('reload_deferred es una mitigación funcionando: info', () => {
    expect(severidadEspejoVersionCheck('version_check_reload_deferred')).toBe('info')
  })

  it('reload_suppressed (el guard de ráfaga de T-168) también es info', () => {
    expect(severidadEspejoVersionCheck('version_check_reload_suppressed')).toBe('info')
  })

  it('cualquier otro eventType de user_interactions NO se espeja (null)', () => {
    expect(severidadEspejoVersionCheck('test_answer_submitted')).toBeNull()
    expect(severidadEspejoVersionCheck('page_navigation')).toBeNull()
    expect(severidadEspejoVersionCheck('version_check_deferred')).toBeNull() // nombre distinto, no confundir
  })

  it('no revienta con string vacío o basura', () => {
    expect(severidadEspejoVersionCheck('')).toBeNull()
    expect(severidadEspejoVersionCheck('version_check_reload')).toBeNull()
  })
})

describe('construirEventoEspejo — la forma exacta del ObservableEvent', () => {
  it('null si el eventType no se espeja (la decisión manda, no se construye nada)', () => {
    expect(construirEventoEspejo({ eventType: 'test_answer_submitted' })).toBeNull()
  })

  it('construye el evento completo con todos los campos presentes', () => {
    const ev = construirEventoEspejo({
      eventType: 'version_check_reload_immediate',
      userId: 'user-123',
      pageUrl: '/leyes/ley-39-2015/avanzado',
      deployVersion: 'aa51c6be',
      sessionId: 'sess-abc',
      value: { clientVersion: 'c85c983d', newVersion: 'aa51c6be', pathname: '/leyes/ley-39-2015/avanzado' },
    })
    expect(ev).toEqual({
      source: 'frontend',
      severity: 'warn',
      eventType: 'version_check_reload_immediate',
      endpoint: '/leyes/ley-39-2015/avanzado',
      userId: 'user-123',
      deployVersion: 'aa51c6be',
      metadata: {
        clientVersion: 'c85c983d',
        newVersion: 'aa51c6be',
        pathname: '/leyes/ley-39-2015/avanzado',
        sessionId: 'sess-abc',
      },
    })
  })

  it('con campos ausentes, usa null en vez de undefined (el sink espera nulls explícitos)', () => {
    const ev = construirEventoEspejo({ eventType: 'version_check_reload_suppressed' })
    expect(ev).toEqual({
      source: 'frontend',
      severity: 'info',
      eventType: 'version_check_reload_suppressed',
      endpoint: null,
      userId: null,
      deployVersion: null,
      metadata: { sessionId: null },
    })
  })

  it('un usuario anónimo (userId null) se espeja igual — el daño no depende de estar logueado', () => {
    const ev = construirEventoEspejo({ eventType: 'version_check_reload_immediate', userId: null })
    expect(ev?.userId).toBeNull()
    expect(ev?.severity).toBe('warn')
  })
})
