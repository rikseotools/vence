// __tests__/health/topicsActivosParidad.test.ts
//
// El barrido de salud SOLO cuenta topics ACTIVOS, y lo hace en sus DOS copias.
//
// ## El verde falso que fija este test (T-384, 31/07/2026)
//
// La query de topics del barrido no filtraba `is_active`. Un topic desactivado no existe para el
// opositor —no se le sirve, no puede estudiarlo— pero contaba igual, así que la comprobación de la
// tarjeta («temas_count ≠ topics reales») **cuadraba con filas fantasma**.
//
// Caso real: `etgoa-sanidad-consumo`, PUBLICADA, con la tarjeta prometiendo **120 temas** y **20
// activos** (19 disponibles) y 4 usuarios estudiándola. El detector decía que todo bien porque los
// otros 100 seguían en la tabla como inactivos. Lo cazaba el test de CI `configDbIntegrity` —que sí
// filtra activos— y el **desacuerdo entre los dos** fue la pista: cuando dos comprobaciones del
// mismo hecho discrepan, una está ciega.
//
// Por qué un test y no solo el arreglo: un filtro `AND ...` se cae en un refactor sin que nada
// chille, y su ausencia **no rompe nada** — produce silencio, que es justo lo que no se ve. Y
// tiene que valer para las dos copias: el writer real es el `@Cron` del backend y el `.cjs` es su
// gemelo manual; si el filtro solo está en uno, el panel y el CLI discrepan en silencio.

import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(__dirname, '../..')

const COPIAS = [
  { nombre: 'CLI (scripts/health-sweep.cjs)', ruta: 'scripts/health-sweep.cjs' },
  {
    nombre: '@Cron (backend/src/content-health-sweep)',
    ruta: 'backend/src/content-health-sweep/content-health-sweep.service.ts',
  },
]

/** Extrae la query de topics de cada copia (la que alimenta la tarjeta de temas). */
function queryDeTopics(ruta: string): string {
  const src = fs.readFileSync(path.join(ROOT, ruta), 'utf8')
  const i = src.indexOf('topic_law_question_summary')
  expect(i).toBeGreaterThan(-1)
  // Ventana amplia alrededor: cubre el SELECT entero sin depender del formato exacto.
  return src.slice(Math.max(0, i - 400), i + 400)
}

describe('barrido de salud — la tarjeta de temas cuenta SOLO topics activos', () => {
  it.each(COPIAS)('$nombre filtra is_active al contar topics', ({ ruta }) => {
    const q = queryDeTopics(ruta)
    expect(q).toMatch(/tp\.is_active/)
  })

  it('las dos copias lo hacen igual (si solo una filtra, discrepan en silencio)', () => {
    const filtran = COPIAS.map(({ ruta }) => /tp\.is_active/.test(queryDeTopics(ruta)))
    expect(filtran).toEqual([true, true])
  })

  // La lógica de la tarjeta: comparar la promesa con lo que de verdad hay. Se fija aquí en puro
  // para que el criterio no dependa de leer SQL: con topics inactivos por medio, el número que
  // vale es el de activos, y con 120 prometidos y 20 activos TIENE que haber hallazgo.
  it('el criterio: 120 prometidos con 20 activos es hallazgo, no verde', () => {
    const hayHallazgo = (temasCount: number, topicsActivos: number) => temasCount !== topicsActivos
    expect(hayHallazgo(120, 20)).toBe(true)   // el caso etgoa
    expect(hayHallazgo(120, 120)).toBe(false) // coherente
    expect(hayHallazgo(20, 20)).toBe(false)
  })
})
