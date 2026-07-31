/**
 * @jest-environment node
 *
 * Guardarraíl: el detector de «techo de timeout» corre UNA vez y en UNA pasada (T-361).
 *
 * ── El fallo que fija ────────────────────────────────────────────────────────
 * El detector es GLOBAL —mira `observable_events` por endpoint, la oposición no le pinta nada—
 * pero estaba pegado **dentro** del bucle `for (const o of opos)` y, peor, dentro del `if` de otro
 * detector. Se ejecutaba una vez por cada oposición con hallazgos: 95 de 124. Y cada pasada hacía
 * 1 consulta agrupada **más otra por endpoint** con 6 subconsultas correlacionadas contra una tabla
 * de 10,5 M de filas, así que agotaba el `statement_timeout` de 30 s, se tragaba la excepción y no
 * emitía nada. Resultado: **un barrido de 1,3 min pasó a más de 45, y el detector estaba mudo.**
 *
 * Se vigila por lectura de código porque las dos cosas son de COLOCACIÓN y de FORMA de la consulta:
 * en ejecución no fallan, sólo tardan — que es como no verlo hasta que alguien mira el reloj.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = join(__dirname, '..', '..', 'backend/src/content-health-sweep/content-health-sweep.service.ts')
const src = readFileSync(SRC, 'utf-8')

/** Índice del `}` que cierra el bloque abierto en `desde` (que debe contener un `{`). */
function cierreDelBloque(texto: string, desde: number): number {
  let prof = 0
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === '{') prof++
    else if (texto[i] === '}') {
      prof--
      if (prof === 0) return i
    }
  }
  return -1
}

describe('detector de techo de timeout — colocación y forma (T-361)', () => {
  const iBucle = src.indexOf('for (const o of opos) {')
  const iDetector = src.indexOf('── Techo de timeout')

  it('el bucle por oposición y el detector siguen existiendo (si no, este guardarraíl miente)', () => {
    expect(iBucle).toBeGreaterThan(-1)
    expect(iDetector).toBeGreaterThan(-1)
  })

  it('NO está dentro del bucle por oposición: correría 124 veces haciendo lo mismo', () => {
    const finBucle = cierreDelBloque(src, iBucle)
    expect(finBucle).toBeGreaterThan(iBucle)
    expect(iDetector).toBeGreaterThan(finBucle)
  })

  it('una sola pasada: ni una consulta POR ENDPOINT dentro del detector', () => {
    const bloque = src.slice(iDetector, iDetector + 3000)
    // La forma vieja correlacionaba por endpoint dentro de un bucle: 1 + N×6 consultas.
    expect(bloque).not.toMatch(/e\.endpoint\s*=\s*\$\{endpoint\}/)
    // La nueva trae todas las bandas de todos los endpoints agrupadas de una vez.
    expect(bloque).toMatch(/count\(\*\) FILTER \(WHERE duration_ms/)
    expect(bloque).toMatch(/GROUP BY endpoint/)
  })

  it('sigue apoyándose en el índice parcial que lo hace viable', () => {
    // Sin él la consulta tarda 55 s y no cabe en el statement_timeout de 30 s: el detector
    // volvería a estar mudo sin que nada fallara.
    const migracion = readFileSync(
      join(__dirname, '..', '..', 'supabase/migrations/20260731_observable_events_indice_peticiones_lentas.sql'),
      'utf-8',
    )
    expect(migracion).toMatch(/CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_observable_events_peticiones_lentas/)
    expect(migracion).toMatch(/WHERE event_type = 'request_completed' AND duration_ms > 5000/)
  })
})
