/**
 * `displayNumber` en la config que genera el scaffolder — es el número de tema que VE
 * el opositor ("Bloque II - Tema 3"), así que un error aquí se le muestra tal cual.
 *
 * DEFECTO REAL (26/07/2026, construyendo Agentes de Tributos de la ATC): el generador
 * hacía `topic_number - 100`, que solo acierta con el prefijo de bloque 1xx. Ese
 * temario reinicia la numeración por bloque y guarda el Bloque II como 201-225 → la
 * config salía con `displayNumber: 101-125` en vez de 1-25.
 *
 * Importa la función REAL del scaffolder, no una copia.
 */
const { buildConfigEntry } = require('@/scripts/create-oposicion.cjs')

const baseSpec = (temario) => ({
  identity: {
    nombre: 'Oposición de prueba',
    short_name: 'Prueba',
    slug: 'oposicion-de-prueba',
    position_type: 'oposicion_de_prueba',
    grupo: 'C',
    subgrupo: 'C1',
    categoria: 'administrativa',
    tipo_acceso: 'libre',
    administracion: 'autonomica',
    titulo_requerido: 'Bachiller',
  },
  examScoring: { penaltyDivisor: 3, source: 'Boletín X, base 8. confidence:alta' },
  bloques: [
    { numero: 1, titulo: 'Bloque I' },
    { numero: 2, titulo: 'Bloque II' },
  ],
  temario,
  convocatoria: { año: 2026, estado_proceso: 'inscripcion_abierta', diario_oficial: 'BOC' },
})

/** Extrae los pares {id, displayNumber} de la entrada TS generada. */
function pares(entry) {
  return [...entry.matchAll(/\{ id: (\d+), name: '[^']*'(?:, displayNumber: (\d+))? \}/g)].map(
    (m) => ({ id: Number(m[1]), displayNumber: m[2] ? Number(m[2]) : null })
  )
}

describe('buildConfigEntry — displayNumber por prefijo de bloque', () => {
  it('BLOQUE II con prefijo 2xx numera 1..N, no 101..1NN (el fallo real)', () => {
    const entry = buildConfigEntry(
      baseSpec([
        { topic_number: 201, titulo: 'Primero del bloque II', epigrafe: 'x', bloque: 2 },
        { topic_number: 225, titulo: 'Último del bloque II', epigrafe: 'x', bloque: 2 },
      ])
    )
    const p = pares(entry)
    expect(p.find((x) => x.id === 201).displayNumber).toBe(1)
    expect(p.find((x) => x.id === 225).displayNumber).toBe(25)
  })

  it('sigue funcionando el prefijo 1xx que ya usaban otras oposiciones', () => {
    const entry = buildConfigEntry(
      baseSpec([{ topic_number: 115, titulo: 'Tema con prefijo 1', epigrafe: 'x', bloque: 1 }])
    )
    expect(pares(entry).find((x) => x.id === 115).displayNumber).toBe(15)
  })

  it('soporta un tercer bloque (3xx) sin tocar el generador otra vez', () => {
    const spec = baseSpec([{ topic_number: 307, titulo: 'Tema del bloque III', epigrafe: 'x', bloque: 3 }])
    spec.bloques.push({ numero: 3, titulo: 'Bloque III' })
    expect(pares(buildConfigEntry(spec)).find((x) => x.id === 307).displayNumber).toBe(7)
  })

  it('los temas SIN prefijo no llevan displayNumber (el id ya es el número visible)', () => {
    const entry = buildConfigEntry(
      baseSpec([{ topic_number: 7, titulo: 'Tema sin prefijo', epigrafe: 'x', bloque: 1 }])
    )
    expect(pares(entry).find((x) => x.id === 7).displayNumber).toBeNull()
  })

  it('un `numero` explícito en el spec manda sobre el cálculo', () => {
    const entry = buildConfigEntry(
      baseSpec([{ topic_number: 210, numero: 4, titulo: 'Renumerado a mano', epigrafe: 'x', bloque: 2 }])
    )
    expect(pares(entry).find((x) => x.id === 210).displayNumber).toBe(4)
  })
})
