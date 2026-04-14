// __tests__/lib/api/oep-signals/hito-validation.test.ts
// Tests unitarios del validador de hitos (turno libre vs promoción interna,
// fechas lejanas, etc.). Caso de origen: Galicia/Isabel 14/04/2026.

import {
  validateHitoForOposicion,
  hasBlockingErrors,
  __internal,
} from '@/lib/api/oep-signals/hito-validation'

describe('hito-validation — detectTurno', () => {
  const { detectTurno } = __internal

  test('detecta turno libre en texto oficial', () => {
    expect(detectTurno('Proceso selectivo por turno libre')).toBe('libre')
    expect(detectTurno('Sistema de oposición libre')).toBe('libre')
    expect(detectTurno('acceso libre al cuerpo C2')).toBe('libre')
  })

  test('detecta promoción interna', () => {
    expect(detectTurno('por el turno de promoción interna')).toBe('promocion_interna')
    expect(detectTurno('PROMOCIÓN INTERNA en cuerpo auxiliar')).toBe('promocion_interna')
    expect(detectTurno('turno interno')).toBe('promocion_interna')
  })

  test('detecta ambos turnos cuando la resolución los menciona juntos', () => {
    expect(detectTurno('por el turno de acceso libre y promoción interna')).toBe('ambos')
  })

  test('devuelve desconocido si no hay señal clara', () => {
    expect(detectTurno('Lista provisional de admitidos')).toBe('desconocido')
    expect(detectTurno('')).toBe('desconocido')
    expect(detectTurno(null)).toBe('desconocido')
  })
})

describe('hito-validation — validateHitoForOposicion', () => {
  const opLibre = { slug: 'auxiliar-administrativo-galicia', tipo_acceso: 'libre' }
  const opInterna = { slug: 'auxiliar-administrativo-galicia-interna', tipo_acceso: 'promocion_interna' }

  test('BLOQUEA hito de promoción interna en oposición libre (caso Galicia/Isabel)', () => {
    const hito = {
      titulo: 'Lista provisional admitidos y excluidos (DOG) - turno de promoción interna',
      fecha: '2026-03-27',
    }
    const issues = validateHitoForOposicion(hito, opLibre)
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].code).toBe('TURNO_MISMATCH')
    expect(hasBlockingErrors(issues)).toBe(true)
  })

  test('BLOQUEA hito de turno libre en oposición de promoción interna (caso simétrico)', () => {
    const hito = {
      titulo: 'Fecha primer ejercicio turno libre',
      fecha: '2026-09-20',
    }
    const issues = validateHitoForOposicion(hito, opInterna)
    expect(issues).toHaveLength(1)
    expect(issues[0].code).toBe('TURNO_MISMATCH')
    expect(hasBlockingErrors(issues)).toBe(true)
  })

  test('PERMITE hito genérico (sin mención de turno) en oposición libre', () => {
    const hito = {
      titulo: 'Convocatoria publicada en DOG',
      fecha: '2025-11-25',
    }
    const issues = validateHitoForOposicion(hito, opLibre)
    expect(hasBlockingErrors(issues)).toBe(false)
  })

  test('PERMITE hito que menciona AMBOS turnos en cualquier oposición', () => {
    const hito = {
      titulo: 'Resolución de admitidos y excluidos',
      descripcion: 'Publicada la lista para el turno libre y promoción interna',
      fecha: '2026-04-01',
    }
    expect(hasBlockingErrors(validateHitoForOposicion(hito, opLibre))).toBe(false)
    expect(hasBlockingErrors(validateHitoForOposicion(hito, opInterna))).toBe(false)
  })

  test('detecta turno en sourceText cuando el título es genérico', () => {
    const hito = {
      titulo: 'Listas provisionales',
      fecha: '2026-03-27',
      sourceText: 'Proceso selectivo por el turno de promoción interna en el cuerpo C2',
    }
    const issues = validateHitoForOposicion(hito, opLibre)
    expect(hasBlockingErrors(issues)).toBe(true)
  })

  test('warning si fecha > 2 años en futuro', () => {
    const futuro = new Date()
    futuro.setUTCFullYear(futuro.getUTCFullYear() + 3)
    const hito = {
      titulo: 'Examen estimado',
      fecha: futuro.toISOString().slice(0, 10),
    }
    const issues = validateHitoForOposicion(hito, opLibre)
    expect(issues.some(i => i.code === 'FECHA_LEJANA' && i.severity === 'warning')).toBe(true)
    expect(hasBlockingErrors(issues)).toBe(false)
  })

  test('no warn por fechas normales (próximos meses)', () => {
    const proximo = new Date()
    proximo.setUTCMonth(proximo.getUTCMonth() + 6)
    const hito = {
      titulo: 'Examen primer ejercicio',
      fecha: proximo.toISOString().slice(0, 10),
    }
    const issues = validateHitoForOposicion(hito, opLibre)
    expect(issues.filter(i => i.code === 'FECHA_LEJANA')).toHaveLength(0)
  })

  test('oposición con tipo_acceso null/unknown no activa validación de turno', () => {
    const hito = {
      titulo: 'Resolución turno de promoción interna',
      fecha: '2026-03-27',
    }
    const op = { slug: 'estabilizacion-x', tipo_acceso: null }
    const issues = validateHitoForOposicion(hito, op)
    expect(hasBlockingErrors(issues)).toBe(false)
  })
})
