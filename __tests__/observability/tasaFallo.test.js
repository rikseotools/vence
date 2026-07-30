const {
  clasificarTasa, endpointsQueFallanMucho,
  TASA_MUESTREO_EXITOS, MIN_EXITOS_OBSERVADOS, TASA_ERROR, TASA_AVISO,
} = require('../../lib/observability/tasaFallo.cjs')

describe('tasa de fallo por endpoint', () => {
  describe('el caso real que se escapó (difficulty-insights, 14 días)', () => {
    // Medido en producción el 30/07/2026 sobre `request_completed`:
    //   48 con 200 (muestreados al 10% → ~480 reales) y 23 con 503 (completos).
    const REAL = { endpoint: '/api/v2/difficulty-insights', exitosObservados: 48, fallos: 23 }

    it('des-muestrea el denominador: 4,6% real, NO el 32,4% en crudo', () => {
      const r = clasificarTasa(REAL)
      expect(r.totalEstimado).toBe(503) // 48/0,1 + 23
      expect(r.tasa).toBe(4.6)
      // El crudo sin corregir sería 23/71 = 32,4%: siete veces peor de lo que es.
      expect(Math.round((23 / 71) * 1000) / 10).toBe(32.4)
    })

    it('aun corregido lo saca en la lista: un 4,6% no es ruido de fondo', () => {
      // `warn`, no `error`: 4,6% queda justo por debajo del 5%. Se deja así a propósito — bajar el
      // umbral para que ESTE caso salga rojo sería ajustar la regla al único ejemplo conocido.
      // Lo que importaba es que deje de ser invisible, y `warn` ya lo saca en la lista.
      expect(clasificarTasa(REAL).severidad).toBe('warn')
    })

    it('gana a un endpoint con MÁS fallos pero mucho más tráfico — lo que fallaba', () => {
      // Con el orden por cantidad, el grande iba primero y el roto no entraba en la lista.
      const grande = { endpoint: '/api/v2/questions/filtered', exitosObservados: 2000, fallos: 60 }
      expect(clasificarTasa(grande).severidad).toBe('ok') // 0,3% = sano
      expect(endpointsQueFallanMucho([grande, REAL])[0].endpoint).toBe(REAL.endpoint)
    })
  })

  describe('la corrección de muestreo', () => {
    it('sin muestreo (todo al 100%) la tasa es la cruda', () => {
      const r = clasificarTasa({ endpoint: '/x', exitosObservados: 90, fallos: 10 }, 1)
      expect({ total: r.totalEstimado, tasa: r.tasa }).toEqual({ total: 100, tasa: 10 })
    })

    it('la misma entrada da tasas MUY distintas según el muestreo — por eso se corrige aquí', () => {
      const e = { endpoint: '/x', exitosObservados: 48, fallos: 23 }
      expect(clasificarTasa(e, 1).tasa).toBe(32.4)
      expect(clasificarTasa(e, 0.1).tasa).toBe(4.6)
    })

    it('un muestreo absurdo cae al valor por defecto en vez de reventar', () => {
      expect(clasificarTasa({ endpoint: '/x', exitosObservados: 48, fallos: 23 }, 0).tasa).toBe(4.6)
      expect(clasificarTasa({ endpoint: '/x', exitosObservados: 48, fallos: 23 }, 7).tasa).toBe(4.6)
    })
  })

  describe('el suelo de muestras', () => {
    it('no opina con pocos éxitos observados, aunque la tasa salga altísima', () => {
      // 2 éxitos vistos → «20 estimados» es una invención; des-muestrear multiplica también el error.
      const r = clasificarTasa({ endpoint: '/raro', exitosObservados: 2, fallos: 10 })
      expect(r.tasa).toBeGreaterThan(30)
      expect(r.severidad).toBe('ok')
    })

    it('el suelo se exige sobre lo OBSERVADO, no sobre lo estimado', () => {
      const justo = { endpoint: '/x', exitosObservados: MIN_EXITOS_OBSERVADOS, fallos: 50 }
      const debajo = { endpoint: '/x', exitosObservados: MIN_EXITOS_OBSERVADOS - 1, fallos: 50 }
      expect(clasificarTasa(justo).severidad).toBe('error')
      expect(clasificarTasa(debajo).severidad).toBe('ok')
    })
  })

  describe('umbrales', () => {
    it('separa aviso de error', () => {
      // exitosObservados=100 → 1000 estimados; los fallos se suman al total.
      const casos = [
        { fallos: 5, esperado: 'ok' },     // 0,5%
        { fallos: 11, esperado: 'warn' },  // 1,1%
        { fallos: 45, esperado: 'warn' },  // 4,3%
        { fallos: 60, esperado: 'error' }, // 5,7%
      ]
      expect(casos.map(c => clasificarTasa({ endpoint: '/x', exitosObservados: 100, fallos: c.fallos }).severidad))
        .toEqual(casos.map(c => c.esperado))
    })

    it('los umbrales son los declarados', () => {
      expect({ TASA_AVISO, TASA_ERROR, MIN_EXITOS_OBSERVADOS, TASA_MUESTREO_EXITOS })
        .toEqual({ TASA_AVISO: 0.01, TASA_ERROR: 0.05, MIN_EXITOS_OBSERVADOS: 20, TASA_MUESTREO_EXITOS: 0.1 })
    })
  })

  describe('entradas degeneradas (no debe reventar el barrido nocturno)', () => {
    it('aguanta nulos, listas vacías y basura', () => {
      expect(endpointsQueFallanMucho(null)).toEqual([])
      expect(endpointsQueFallanMucho([])).toEqual([])
      expect(clasificarTasa({}).severidad).toBe('ok')
      expect(clasificarTasa({ endpoint: '/x', exitosObservados: 0, fallos: 0 }).tasa).toBe(0)
    })

    it('no se cree cifras imposibles (negativos)', () => {
      expect(clasificarTasa({ endpoint: '/x', exitosObservados: -5, fallos: -1 }).tasa).toBe(0)
    })

    it('un endpoint sano no aparece', () => {
      expect(endpointsQueFallanMucho([{ endpoint: '/ok', exitosObservados: 5000, fallos: 3 }])).toEqual([])
    })
  })

  it('ordena de peor a mejor tasa', () => {
    const r = endpointsQueFallanMucho([
      { endpoint: '/b', exitosObservados: 100, fallos: 20 },
      { endpoint: '/a', exitosObservados: 100, fallos: 200 },
      { endpoint: '/c', exitosObservados: 100, fallos: 80 },
    ])
    expect(r.map(x => x.endpoint)).toEqual(['/a', '/c', '/b'])
  })
})
