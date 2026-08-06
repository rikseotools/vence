/**
 * Nadie vuelve a contar filas afectadas a mano. (T-613)
 *
 * ── EL DEFECTO QUE LO MOTIVA ────────────────────────────────────────────────
 * Hablamos con Postgres por **postgres-js** en los dos árboles
 * (`drizzle-orm/postgres-js`). Su resultado de un `DELETE`/`UPDATE` sin
 * `RETURNING` es un array VACÍO con las filas afectadas en **`.count`**;
 * `rowCount` es de node-postgres y aquí vale `undefined` SIEMPRE.
 *
 * El patrón `res.rowCount ?? res.length ?? 0` se copió de un servicio a otro
 * («calcado de ArchiveInteractionsService», dice el comentario) y devolvía 0 en
 * todos. En los drenadores por lotes eso no era un log inexacto: el bucle corta
 * con «si el lote devolvió menos de lo pedido, hemos terminado», así que salían
 * en la PRIMERA vuelta. `telemetry-retention` borraba 50 k por noche en vez de
 * 2,5 M y `archive-interactions` 10 k en vez de 200 k, las dos reportando
 * `status: 'success'` con 0 filas — semanas en verde con las dos tablas mayores
 * de la BD (6,9 GB y 10 GB) creciendo sin freno.
 *
 * ── POR QUÉ UN GUARDARRAÍL Y NO SOLO EL ARREGLO ─────────────────────────────
 * Porque el patrón se PROPAGÓ copiándose, y porque parece correcto: con
 * `RETURNING`, `.length` sí da el número bueno (ese es el caso de
 * `lib/api/subscription/queries.ts`, que NO está afectado). O sea que quien lo
 * revise verá un sitio donde funciona y cuatro donde no, sin nada que los
 * distinga a ojo.
 */
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = join(__dirname, '..', '..')

/** Los dos árboles que hablan con la BD. `scripts/` usa `pg` crudo y no aplica. */
const ARBOLES = ['backend/src', 'lib', 'app', 'db', 'utils']

/** Ficheros que PUEDEN nombrar el patrón: los que lo explican. */
const EXENTOS = [
  'backend/src/db/filasAfectadas.ts',
  'lib/db/filasAfectadas.ts',
  'backend/src/db/filasAfectadas.spec.ts',
  '__tests__/guardrails/filasAfectadas.guardrail.test.ts',
]

function grep(patron: string): string[] {
  const arboles = ARBOLES.map((a) => join(RAIZ, a)).join(' ')
  try {
    const salida = execSync(
      `grep -rn --include=*.ts --include=*.tsx -e ${JSON.stringify(patron)} ${arboles} || true`,
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    )
    return salida
      .split('\n')
      .filter(Boolean)
      .map((l) => l.replace(RAIZ + '/', ''))
      .filter((l) => !EXENTOS.some((e) => l.startsWith(e + ':')))
  } catch {
    return []
  }
}

describe('filas afectadas: un solo contador (T-613)', () => {
  it('nadie lee `rowCount` de un resultado de la BD por su cuenta', () => {
    const usos = grep('rowCount ?? ')
    expect({
      usos,
      arreglo:
        usos.length > 0
          ? 'usa `filasAfectadas(res)` (backend/src/db/ o lib/db/). `rowCount` es de node-postgres: ' +
            'con postgres-js vale undefined SIEMPRE, así que esa expresión devuelve 0 y, dentro de un ' +
            'bucle de lotes, lo corta en la primera vuelta (T-613).'
          : null,
    }).toEqual({ usos: [], arreglo: null })
  })

  it('los dos espejos del helper existen y dicen lo mismo', () => {
    // El backend NO puede importar de `lib/` en runtime (su imagen no la lleva),
    // así que hay dos copias a la fuerza. Lo que no puede haber es que diverjan:
    // se comparan los CUERPOS, ignorando el punto y coma y los comentarios.
    const cuerpo = (ruta: string) => {
      const src = readFileSync(join(RAIZ, ruta), 'utf8')
      const desde = src.indexOf('export function filasAfectadas')
      expect(desde).toBeGreaterThan(-1)
      return src
        .slice(desde)
        .replace(/;/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    expect(cuerpo('lib/db/filasAfectadas.ts')).toBe(
      cuerpo('backend/src/db/filasAfectadas.ts'),
    )
  })

  it('los drenadores por lotes usan el helper (son los que se rompen de verdad)', () => {
    const drenadores = [
      'backend/src/telemetry-retention/telemetry-retention.service.ts',
      'backend/src/archive-interactions/archive-interactions.service.ts',
    ]
    for (const d of drenadores) {
      const src = readFileSync(join(RAIZ, d), 'utf8')
      expect({ fichero: d, usa: src.includes('filasAfectadas(') }).toEqual({
        fichero: d,
        usa: true,
      })
    }
  })

  it('y publican lo que les QUEDA: sin ese número, «0 borradas» no se puede interpretar', () => {
    // Esta es la lección de fondo de T-613, y por eso se vigila aquí y no solo en
    // el spec del servicio: el arreglo del contador NO es la protección.
    const crons = [
      'backend/src/telemetry-retention/telemetry-retention.cron.ts',
      'backend/src/archive-interactions/archive-interactions.cron.ts',
    ]
    for (const c of crons) {
      const src = readFileSync(join(RAIZ, c), 'utf8')
      expect({ fichero: c, emite: src.includes('remaining') }).toEqual({
        fichero: c,
        emite: true,
      })
    }
  })

  it('la poda de `observable_events` tiene UN solo dueño', () => {
    // Hubo dos crons podando la misma tabla con criterios distintos (`ts` vs
    // `created_at`) y horarios pegados (04:00 y 04:10). El viejo llevaba días
    // muriendo en el statement_timeout y mandando un correo diario. Dos puertas
    // al mismo recurso no protegen: se contradicen.
    //
    // El único podador legítimo construye el nombre de la tabla (`purgeTable`), así
    // que un `DELETE FROM ... observable_events` LITERAL en cualquier sitio es, por
    // construcción, un segundo podador.
    const otros = grep('DELETE FROM public.observable_events').concat(
      grep('DELETE FROM observable_events'),
    )
    expect({
      otrosPodadores: [...new Set(otros.map((l) => l.split(':')[0]))],
      arreglo: otros.length
        ? 'la retención de observable_events vive SOLO en TelemetryRetentionService'
        : null,
    }).toEqual({ otrosPodadores: [], arreglo: null })

    // Y el dueño declarado sigue siendo el que es (si alguien renombra la tabla en
    // el servicio, este guardarraíl dejaría de vigilar nada sin decirlo).
    const dueño = readFileSync(
      join(RAIZ, 'backend/src/telemetry-retention/telemetry-retention.service.ts'),
      'utf8',
    )
    expect(dueño).toContain("'observable_events'")
    expect(dueño).toContain('purgeTable')
  })
})
