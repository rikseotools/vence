'use strict'

const { diagnosticarSeguimientoError } = require('@/lib/convocatoria/seguimientoFuenteError.cjs')

describe('diagnosticarSeguimientoError', () => {
  it('error: convocatoria con ficha viva (inscripcion_abierta) — caso real cuidador-diputacion-cordoba', () => {
    const d = diagnosticarSeguimientoError({
      estadoProceso: 'inscripcion_abierta',
      seguimientoUrl: 'https://empleo.dipucordoba.es/',
    })
    expect(d.severidad).toBe('error')
    expect(d.motivo).toContain('ciegos a sus cambios')
    expect(d.motivo).toContain('empleo.dipucordoba.es')
  })

  it('error: pendiente_examen también es ficha viva — caso real administrativo-junta-general-asturias', () => {
    expect(diagnosticarSeguimientoError({ estadoProceso: 'pendiente_examen' }).severidad).toBe('error')
  })

  it('error: convocada, inscripcion_cerrada, lista_admitidos — todos ficha viva', () => {
    for (const estado of ['convocada', 'inscripcion_cerrada', 'lista_admitidos']) {
      expect(diagnosticarSeguimientoError({ estadoProceso: estado }).severidad).toBe('error')
    }
  })

  it('warn: oep_aprobada — sin ficha concreta que vigilar todavía', () => {
    const d = diagnosticarSeguimientoError({ estadoProceso: 'oep_aprobada' })
    expect(d.severidad).toBe('warn')
    expect(d.motivo).toContain('el radar')
  })

  it('warn: examen_realizado — el ciclo actual ya pasó, no hay ficha viva de la próxima convocatoria', () => {
    expect(diagnosticarSeguimientoError({ estadoProceso: 'examen_realizado' }).severidad).toBe('warn')
  })

  it('warn: sin_oep, nombramientos, estado desconocido o ausente', () => {
    for (const estado of ['sin_oep', 'nombramientos', 'algo_nuevo', null, undefined]) {
      expect(diagnosticarSeguimientoError({ estadoProceso: estado }).severidad).toBe('warn')
    }
  })

  it('el motivo menciona el estado_proceso concreto (para que la cola diga por qué)', () => {
    const d = diagnosticarSeguimientoError({ estadoProceso: 'convocada' })
    expect(d.motivo).toContain("estado_proceso='convocada'")
  })

  it('sin seguimientoUrl no revienta y no menciona una URL vacía', () => {
    const d = diagnosticarSeguimientoError({ estadoProceso: 'convocada' })
    expect(d.motivo).not.toContain('()')
  })

  it('entrada vacía no revienta (fail-safe: warn)', () => {
    expect(diagnosticarSeguimientoError({}).severidad).toBe('warn')
    expect(diagnosticarSeguimientoError().severidad).toBe('warn')
  })
})
