import pathlib

p = pathlib.Path('/home/manuel/vence-sessions/movil3/__tests__/guardrails/revisionColumnas.guardrail.test.ts')
s = p.read_text()

VIEJO = """/** Ficheros que consultan el backlog. Se listan a mano: son pocos y así añadir uno es deliberado. */
const FUENTES = [
  'scripts/backlog.cjs',
  'scripts/flota/flota.cjs',
  'scripts/sessions/parte.cjs',
]"""

NUEVO = """// ── LOS CONSUMIDORES SE BUSCAN, NO SE LISTAN (08/08/2026) ───────────────────────────────────
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
const IGNORAR = /(^|\\/)(node_modules|\\.next|dist|coverage)(\\/|$)/

function ficherosDeCodigo(dir: string, out: string[] = []): string[] {
  const abs = path.join(REPO, dir)
  if (!fs.existsSync(abs)) return out
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, e.name)
    if (IGNORAR.test(rel)) continue
    if (e.isDirectory()) ficherosDeCodigo(rel, out)
    else if (/\\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) out.push(rel)
  }
  return out
}

/** Todo fichero de código que consulte `backlog_tasks` trayendo la columna de la entrega. */
function fuentes(): string[] {
  return RAICES.flatMap((r) => ficherosDeCodigo(r)).filter((rel) => {
    const src = fs.readFileSync(path.join(REPO, rel), 'utf8')
    return src.includes('review_requested_at') && /FROM\\s+(public\\.)?backlog_tasks/i.test(src)
  })
}

const FUENTES = fuentes()"""

assert VIEJO in s, 'bloque FUENTES no encontrado'
s = s.replace(VIEJO, NUEVO)

# El troceo solo reconoce `FROM public.backlog_tasks`; el panel usa `FROM backlog_tasks`.
s = s.replace(
    "  const re = /SELECT[^`]*?FROM\\s+public\\.backlog_tasks/gi",
    "  // `public.` OPCIONAL: el panel escribe `FROM backlog_tasks` a secas y quedaba fuera del\n"
    "  // troceo, así que ni siquiera se examinaban sus SELECT.\n"
    "  const re = /SELECT[^`]*?FROM\\s+(?:public\\.)?backlog_tasks/gi")

# La exención dejaba pasar justo la forma del panel.
VIEJA_EXENCION = """      // Un SELECT que solo COMPRUEBA si hay entrega (p.ej. `(review_requested_at IS NOT NULL) AS …`)
      // no alimenta al núcleo: no le pasa la fila, le pasa un booleano ya resuelto.
      if (/review_requested_at\\s+IS\\s+(NOT\\s+)?NULL/i.test(sel)) continue"""
NUEVA_EXENCION = """      // La exención es SOLO para el booleano ya resuelto —`(review_requested_at IS NOT NULL) AS
      // tiene_entrega`—, que no le pasa la fila al núcleo sino una respuesta.
      //
      // Antes bastaba con que la columna apareciese en un `IS NULL` EN CUALQUIER SITIO, y eso es
      // justo la forma del SELECT del panel (`SELECT review_requested_at … WHERE
      // review_requested_at IS NOT NULL`): filtraba por ella Y la proyectaba cruda, o sea que sí
      // alimentaba el cálculo, y aun así quedaba exento. Un guardarraíl con una exención más ancha
      // que su regla no protege de nada.
      const proyeccion = sel.slice(0, sel.search(/\\bFROM\\b/i))
      const soloBooleano = /\\(\\s*review_requested_at\\s+IS\\s+(NOT\\s+)?NULL\\s*\\)/i.test(proyeccion)
      const proyectaCruda = /(^|[\\s,(])review_requested_at\\s*(,|$|\\s)/im.test(proyeccion)
      if (soloBooleano && !proyectaCruda) continue"""
assert VIEJA_EXENCION in s, 'exención no encontrada'
s = s.replace(VIEJA_EXENCION, NUEVA_EXENCION)

# El it.each sobre una lista descubierta necesita que la lista no esté vacía.
ANCLA = """describe('nadie le pregunta al núcleo de revisión con media fila', () => {
  it.each(FUENTES)"""
NUEVO_ANCLA = """describe('nadie le pregunta al núcleo de revisión con media fila', () => {
  it('encuentra consumidores (si esto falla, el guardarraíl se quedó ciego)', () => {
    // Un descubrimiento que devuelve cero pasaría TODO en verde sin mirar nada — la forma más
    // silenciosa de perder un guardarraíl.
    expect(FUENTES.length).toBeGreaterThanOrEqual(4)
    expect(FUENTES).toContain('app/api/admin/system-health/route.ts')
  })

  it.each(FUENTES)"""
assert ANCLA in s, 'ancla del describe no encontrada'
s = s.replace(ANCLA, NUEVO_ANCLA)

p.write_text(s)
print('guardarraíl reforzado')
