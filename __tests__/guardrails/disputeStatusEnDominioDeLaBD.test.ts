/**
 * Todo `status` que el código escriba en una impugnación tiene que existir en el CHECK de la BD.
 *
 * Qué defiende (28/07/2026): `/api/v2/disputes/appeal` llevaba desde su creación haciendo
 * `SET status='appealed'` contra una tabla cuyo CHECK solo admitía
 * ('pending','reviewing','resolved','rejected'). El endpoint **fallaba siempre**, y como el camino
 * alternativo escribía `pending`, las alegaciones volvían a la cola **disfrazadas de impugnación
 * nueva**: quien las cogía no veía que ya se había respondido y, al cerrarlas, el usuario recibía
 * un segundo correo. El panel de admin, que solo pinta el texto de la alegación cuando
 * `status === 'appealed'`, no lo mostró jamás.
 *
 * Coste real medido: 29 alegaciones en la historia, **3 sin respuesta**, una esperando desde el
 * 21/03. Nada de esto lanzó una alarma: un `UPDATE` que viola un CHECK falla en su petición y ahí
 * se queda.
 *
 * Este test no necesita BD: compara el dominio declarado en la migración con lo que el código
 * escribe de verdad. Si alguien añade un estado nuevo en el código sin migrarlo —o al revés— salta
 * aquí, que es donde cuesta un minuto arreglarlo.
 */
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

// `__dirname` y no `process.cwd()`: en este repo Jest se ejecuta con node_modules enlazado desde
// el árbol principal y el cwd no siempre es la raíz del worktree.
const RAIZ = join(__dirname, '..', '..')
const MIGRACIONES = join(RAIZ, 'supabase/migrations')

/** Estados que la BD admite, leídos de la ÚLTIMA migración que define el CHECK de status. */
function estadosPermitidosPorLaBD(): string[] {
  const ficheros = readdirSync(MIGRACIONES)
    .filter((f) => f.endsWith('.sql'))
    .sort() // el nombre empieza por fecha: el último es el vigente
  const conCheck = ficheros.filter((f) =>
    /question_disputes_status_check/.test(readFileSync(join(MIGRACIONES, f), 'utf8')),
  )
  expect(conCheck.length).toBeGreaterThan(0)
  const sql = readFileSync(join(MIGRACIONES, conCheck[conCheck.length - 1]), 'utf8')
  const bloque = sql.slice(sql.indexOf('question_disputes_status_check'))
  return [...bloque.matchAll(/'([a-z_]+)'::text/g)].map((m) => m[1])
}

/** Estados que el código escribe de verdad en una impugnación. */
function estadosQueEscribeElCodigo(): { estado: string; donde: string }[] {
  const fuentes = [
    'lib/api/dispute/queries.ts',
    'lib/api/v2/dispute/queries.ts',
    'app/api/v2/disputes/appeal/route.ts',
  ]
  const out: { estado: string; donde: string }[] = []
  for (const f of fuentes) {
    const src = readFileSync(join(RAIZ, f), 'utf8')
    // `status: 'x'` (Drizzle) y `status = 'x'` (SQL crudo)
    for (const m of src.matchAll(/status\s*[:=]\s*'([a-z_]+)'/g)) out.push({ estado: m[1], donde: f })
  }
  return out
}

describe('el dominio de `status` de las impugnaciones no puede divergir', () => {
  it('la BD admite `appealed` (sin él, alegar es imposible)', () => {
    expect(estadosPermitidosPorLaBD()).toContain('appealed')
  })

  it('todo estado que el código escribe está permitido por la BD', () => {
    const permitidos = estadosPermitidosPorLaBD()
    const escritos = estadosQueEscribeElCodigo()
    expect(escritos.length).toBeGreaterThan(0) // si no encuentra nada, el test no protege nada
    const fuera = escritos.filter((e) => !permitidos.includes(e.estado))
    // Si esto falla: el código escribe un estado que el CHECK de la BD rechaza. El UPDATE revienta
    // en su petición y nadie se entera — exactamente lo que pasó con `appealed` durante meses.
    expect(fuera.map((f) => `${f.estado} (${f.donde})`)).toEqual([])
  })

  it('la alegación deja la impugnación en `appealed`, no en `pending`', () => {
    // `pending` la devolvía a la cola como si fuera nueva. La distinción es lo que evita el
    // segundo correo al usuario y lo que hace que el panel de admin enseñe el texto alegado.
    const src = readFileSync(join(RAIZ, 'lib/api/dispute/queries.ts'), 'utf8')
    const bloqueApelacion = src.slice(src.indexOf('appealText: appealText.trim()') - 400, src.indexOf('appealText: appealText.trim()'))
    expect(bloqueApelacion).toContain("status: 'appealed'")
  })
})
