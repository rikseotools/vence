/**
 * @jest-environment node
 */
// Unitarios del núcleo PURO que detecta un epígrafe cortado en seco, prometiendo una lista de
// materias que no llega a traer (T-625). Importa el módulo REAL de producción, nunca una copia.
//
// Medido el 07/08/2026 contra RDS (reproducido, no solo leído de la ficha): 14 de 3.799 temas
// activos con epígrafe casan `btrim(epigrafe) ~ ':\s*$'`. Este test usa CASOS REALES del banco
// (no inventados) para que la regresión, si vuelve, se note contra ejemplos que ya existieron.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analizarEpigrafeTruncado, epigrafesTruncados } = require('@/lib/health/epigrafeTruncado.cjs') as {
  analizarEpigrafeTruncado: (t: string | null | undefined) => { truncado: boolean }
  epigrafesTruncados: (
    f: Array<{ slug?: string; tema?: number; epigrafe?: string | null }>,
  ) => Array<{ slug?: string; tema?: number }>
}

describe('analizarEpigrafeTruncado — casos reales del banco (medidos 07/08/2026)', () => {
  it('caza los 4 casos reales que dan pie a la ficha', () => {
    for (const texto of [
      'La Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público:',
      'Régimen Jurídico del Sector Público (I):',
      'La contratación del sector público (II):',
      'Acción protectora del sistema de Seguridad Social:',
    ]) {
      expect(analizarEpigrafeTruncado(texto).truncado).toBe(true)
    }
  })

  it('caza aunque queden espacios tras los dos puntos (caso real: enfermero_scs_canarias T31)', () => {
    const texto = 'Promoción de la autonomía personal y atención a la dependencia: '
    expect(analizarEpigrafeTruncado(texto).truncado).toBe(true)
  })
})

describe('analizarEpigrafeTruncado — lo que NO puede marcar', () => {
  it('un `:` EN MEDIO de la frase no acusa — el corte es solo por el FINAL', () => {
    for (const texto of [
      'Tema 1. La Constitución Española de 1978: estructura y contenido.',
      'Tema 5. El acto administrativo: concepto, clases y elementos.',
      'Tema 9. Procedimiento administrativo común de las Administraciones Públicas.',
    ]) {
      expect(analizarEpigrafeTruncado(texto).truncado).toBe(false)
    }
  })

  it('un epígrafe normal, sin dos puntos en ningún sitio, sale limpio', () => {
    expect(analizarEpigrafeTruncado('El Presupuesto General del Estado.').truncado).toBe(false)
  })

  it('tolera nulo, vacío, solo espacios y no-cadena', () => {
    expect(analizarEpigrafeTruncado(null).truncado).toBe(false)
    expect(analizarEpigrafeTruncado(undefined).truncado).toBe(false)
    expect(analizarEpigrafeTruncado('').truncado).toBe(false)
    expect(analizarEpigrafeTruncado('   ').truncado).toBe(false)
    // @ts-expect-error — entrada inválida a propósito
    expect(analizarEpigrafeTruncado(42).truncado).toBe(false)
  })
})

describe('epigrafesTruncados — el lote', () => {
  it('devuelve solo los truncados', () => {
    const r = epigrafesTruncados([
      { slug: 'administrativo_extremadura', tema: 14, epigrafe: 'Régimen Jurídico del Sector Público (I):' },
      { slug: 'aux-admin-estado', tema: 1, epigrafe: 'Tema 1. La Constitución Española de 1978: estructura.' },
      { slug: 'celador_sescam_clm', tema: 2, epigrafe: 'Ley de Ordenación Sanitaria de Castilla-La Mancha:' },
    ])
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.slug)).toEqual(['administrativo_extremadura', 'celador_sescam_clm'])
  })

  it('lista vacía y ausencia de lista no rompen', () => {
    expect(epigrafesTruncados([])).toEqual([])
    // @ts-expect-error — el llamador puede no tener nada que pasar
    expect(epigrafesTruncados(undefined)).toEqual([])
  })
})
