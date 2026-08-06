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

/** Ficheros que consultan el backlog. Se listan a mano: son pocos y así añadir uno es deliberado. */
const FUENTES = [
  'scripts/backlog.cjs',
  'scripts/flota/flota.cjs',
  'scripts/sessions/parte.cjs',
]

/**
 * Trocea por sentencia SELECT … FROM para no juzgar el fichero entero: un fichero puede tener un
 * SELECT que sí necesita las columnas y otro que no las toca.
 */
function selectsCon(texto: string, columna: string): string[] {
  const out: string[] = []
  // `[^`]*?` y no `[\s\S]*?`: cada consulta vive dentro de su propia plantilla de JS, así que la
  // comilla invertida es la frontera natural. Sin ella, el emparejamiento saltaba de una consulta
  // a la siguiente y acusaba a un SELECT de `worktree_sessions` de no traer columnas del backlog.
  const re = /SELECT[^`]*?FROM\s+public\.backlog_tasks/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(texto)) !== null) {
    if (m[0].includes(columna)) out.push(m[0])
  }
  return out
}

describe('nadie le pregunta al núcleo de revisión con media fila', () => {
  it.each(FUENTES)('%s trae el veredicto siempre que trae la entrega', (rel) => {
    const abs = path.join(REPO, rel)
    if (!fs.existsSync(abs)) return                       // el fichero puede moverse; eso no es este fallo
    const src = fs.readFileSync(abs, 'utf8')
    const conEntrega = selectsCon(src, 'review_requested_at')
    for (const sel of conEntrega) {
      // Un SELECT que solo COMPRUEBA si hay entrega (p.ej. `(review_requested_at IS NOT NULL) AS …`)
      // no alimenta al núcleo: no le pasa la fila, le pasa un booleano ya resuelto.
      if (/review_requested_at\s+IS\s+(NOT\s+)?NULL/i.test(sel)) continue
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
