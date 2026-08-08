/**
 * @jest-environment node
 */
// GUARDARRAÍL — quien le pregunta al núcleo de revisión tiene que traerle las columnas del VEREDICTO.
//
// ── EL FALLO QUE LO ORIGINA, MEDIDO (T-486, 06/08) ──────────────────────────────────────────
// El núcleo `lib/backlog/revision.cjs` decide con DOS columnas: `review_requested_at` (hay
// entregable) y `reviewed_at`/`review_verdict` (ya lo miró alguien). Al partir el estado en dos,
// el criterio quedó bien y los 37 unit en verde… pero cinco `SELECT` del CLI seguían trayendo
// solo la primera. Un núcleo correcto alimentado con una fila incompleta contesta mal, y lo hace
// **en silencio**: `undefined` no lanza, simplemente parece «todavía sin revisar».
//
// Lo cazó `npm run sim:espera-revision` (29/30) y NO los unit, porque los unit construyen la fila
// a mano — que es justo la fila que el código real no producía. Es la misma lección que ya costó
// tiempo en esta casa: **un guardarraíl de TEXTO no es una ejecución**, y aquí se añade el de
// texto precisamente porque la ejecución solo cubre el camino que la simulación recorre.
//
// Qué exige: que todo `SELECT` que traiga `review_requested_at` traiga también `reviewed_at`. No
// juzga qué se hace con ellas — juzga que quien pregunta no le esconda media pregunta al núcleo.
import fs from 'fs'
import path from 'path'

const REPO = path.resolve(__dirname, '..', '..')

// ── LOS CONSUMIDORES SE BUSCAN, NO SE LISTAN (08/08/2026) ───────────────────────────────────
// Esta lista estaba escrita a mano con tres ficheros «porque son pocos y así añadir uno es
// deliberado». El cuarto nació invisible: `app/api/admin/system-health/route.ts` —el que alimenta
// el semáforo de la flota en /admin/salud-sistema— traía `review_requested_at` sin `reviewed_at`,
// y el guardarraíl no lo miraba porque no estaba en la lista. Medido al encontrarlo: **12 filas
// contadas como pendientes, 11 de ellas YA revisadas**, y una espera máxima de 4,1 h donde la cola
// real llevaba 0,2 h.
//
// Es el patrón que esta casa ya pagó con los cinco escritores de `seguimiento_url` ([T-130]) y con
// las cuatro puertas de `target_oposicion` ([T-339]): contar a ojo los sitios que tocan algo es
// exactamente cómo se deja uno fuera. Así que se BUSCAN.
const RAICES = ['app', 'lib', 'scripts', 'backend/src']
const IGNORAR = /(^|\/)(node_modules|\.next|dist|coverage)(\/|$)/

function ficherosDeCodigo(dir: string, out: string[] = []): string[] {
  const abs = path.join(REPO, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (IGNORAR.test(rel)) continue
    if (e.isDirectory()) ficherosDeCodigo(rel, out)
    else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) out.push(rel)
  }
  return out
}

/** Todo fichero de código que consulte `backlog_tasks` trayendo la columna de la entrega. */
function fuentes(): string[] {
  return RAICES.flatMap((r) => ficherosDeCodigo(r)).filter((rel) => {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8')
    return src.includes('review_requested_at') && /FROM\s+(public\.)?backlog_tasks/i.test(src)
  })
}

const FUENTES = fuentes()

/**
 * Trocea por sentencia SELECT … FROM para no juzgar el fichero entero: un fichero puede tener un
 * SELECT que sí necesita las columnas y otro que no las toca.
 */
function selectsCon(texto: string, columna: string): string[] {
  const out: string[] = []
  // `[^`]*?` y no `[\s\S]*?`: cada consulta vive dentro de su propia plantilla de JS, así que la
  // comilla invertida es la frontera natural. Sin ella, el emparejamiento saltaba de una consulta
  // a la siguiente y acusaba a un SELECT de `worktree_sessions` de no traer columnas del backlog.
  // `public.` OPCIONAL: el panel escribe `FROM backlog_tasks` a secas y quedaba fuera del
  // troceo, así que ni siquiera se examinaban sus SELECT.
  const re = /SELECT[^`]*?FROM\s+(?:public\.)?backlog_tasks/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    if (m[0].includes(columna)) out.push(m[0])
  }
  return out
}

describe('nadie le pregunta al núcleo de revisión con media fila', () => {
  it('encuentra consumidores (si esto falla, el guardarraíl se quedó ciego)', () => {
    // Un descubrimiento que devuelve cero pasaría TODO en verde sin mirar nada — la forma más
    // silenciosa de perder un guardarraíl.
    expect(FUENTES.length).toBeGreaterThanOrEqual(4)
    expect(FUENTES).toContain('app/api/admin/system-health/route.ts')
  })

  it.each(FUENTES)('%s trae el veredicto siempre que trae la entrega', (rel) => {
    const abs = path.join(REPO, rel)
    if (!fs.existsSync(abs)) return                       // el fichero puede moverse; eso no es este fallo
    const src = fs.readFileSync(abs, 'utf8')
    const conEntrega = selectsCon(src, 'review_requested_at')
    for (const sel of conEntrega) {
      // La exención es SOLO para el booleano ya resuelto —`(review_requested_at IS NOT NULL) AS
      // tiene_entrega`—, que no le pasa la fila al núcleo sino una respuesta.
      //
      // Antes bastaba con que la columna apareciese en un `IS NULL` EN CUALQUIER SITIO, y eso es
      // justo la forma del SELECT del panel (`SELECT review_requested_at … WHERE
      // review_requested_at IS NOT NULL`): filtraba por ella Y la proyectaba cruda, o sea que sí
      // alimentaba el cálculo, y aun así quedaba exento. Un guardarraíl con una exención más ancha
      // que su regla no protege de nada.
      const proyeccion = sel.slice(0, sel.search(/\bFROM\b/i))
      // Se QUITAN primero los booleanos ya resueltos y solo entonces se busca la columna cruda.
      // Mirarlo al revés daba falso rojo en los tres sitios legítimos: dentro de
      // `(review_requested_at IS NOT NULL) AS pedida` la columna también «aparece», claro.
      const sinBooleanos = proyeccion.replace(/\(\s*review_requested_at\s+IS\s+(NOT\s+)?NULL\s*\)/gi, '')
      if (!/review_requested_at/i.test(sinBooleanos)) continue
      expect(sel).toMatch(/reviewed_at/)
    }
  })

  it('y el núcleo sigue siendo el ÚNICO que decide qué significa cada columna', () => {
    // Si alguien re-implementa el criterio fuera, `flota` y `backlog list` empiezan a contar
    // distinto y el número que Manuel lee deja de ser comprobable. El criterio se importa.
    for (const rel of ['scripts/flota/flota.cjs', 'scripts/backlog.cjs']) {
      const src = fs.readFileSync(path.join(REPO, rel), 'utf8')
      expect(src).toMatch(/require\([^)]*revision\.cjs['"]\)/)
    }
  })

  it('el núcleo expone los tres estados por separado (partirlo fue el arreglo)', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const REV = require('@/lib/backlog/revision.cjs')
    for (const f of ['tieneEntrega', 'esperaRevision', 'esperaDecision', 'devueltaConProblemas']) {
      expect(typeof REV[f]).toBe('function')
    }
    // Y el contrato que el resto del sistema asume: los dos estados son EXCLUYENTES.
    const entregada = { review_requested_at: '2026-08-06T09:00:00Z' }
    const revisada = { ...entregada, reviewed_at: '2026-08-06T10:00:00Z', review_verdict: 'ok' }
    expect(REV.esperaRevision(entregada) && REV.esperaDecision(entregada)).toBe(false)
    expect(REV.esperaRevision(revisada) && REV.esperaDecision(revisada)).toBe(false)
    expect(REV.esperaRevision(revisada)).toBe(false)
    expect(REV.esperaDecision(revisada)).toBe(true)
  })
})

describe('el SQL atómico del claim está de acuerdo con el núcleo', () => {
  // La puerta que de verdad impide coger una tarea vive en el `UPDATE … WHERE` del claim, no en
  // claimGate (eso solo explica el fallo). Son dos escrituras del mismo criterio, así que lo
  // mínimo exigible es que la excepción de la devolución esté en las dos.
  it('la devuelta con «problemas» se entrega también en el SQL, no solo en claimGate', () => {
    const src = fs.readFileSync(path.join(REPO, 'scripts', 'backlog.cjs'), 'utf8')
    // Se ancla en `force_claim_reason`, que solo escribe el UPDATE del claim. Anclar directamente
    // en `FOR UPDATE SKIP LOCKED` daba un falso rojo: esa frase sale ANTES en el comentario de
    // cabecera del fichero, así que el trozo examinado era la cabecera y no la consulta.
    const set = src.indexOf('force_claim_reason =')
    expect(set).toBeGreaterThan(0)                        // si cambia el anclaje, el test lo dice
    const fin = src.indexOf('FOR UPDATE SKIP LOCKED', set)
    expect(fin).toBeGreaterThan(set)
    const claim = src.slice(set, fin)
    expect(claim).toMatch(/review_requested_at IS NULL/)
    expect(claim).toMatch(/review_verdict\s*=\s*'problemas'/)
  })
})
