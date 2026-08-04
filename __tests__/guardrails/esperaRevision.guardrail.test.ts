/**
 * @jest-environment node
 */
// La quinta espera se hace cumplir en el UPDATE ATÓMICO, no solo en el mensaje. (T-539)
//
// ── POR QUÉ EXISTE ESTE GUARDARRAÍL ─────────────────────────────────────────────────────────
// La primera versión de esta función puso la comprobación SOLO en `claimGate`, que es quien redacta
// el motivo del rechazo. Los tests unitarios pasaban —el gate devolvía `awaiting_review`— y la
// tarea **se entregaba igual**, porque quien decide de verdad es el `UPDATE ... WHERE` del claim.
// Lo destapó la simulación contra la BD, no los tests.
//
// Es el mismo reparto que el resto del CLI y está escrito en CLAUDE.md: *«la comprobación va en el
// MISMO UPDATE atómico que el lease y con el reloj del SERVIDOR»*. Con dos sesiones compitiendo,
// comprobar fuera de la sentencia es una carrera: las dos leen «libre» y las dos escriben.
//
// Este guardarraíl es de TEXTO a propósito: no puede ejecutar el CLI (el CI no tiene BD), pero sí
// puede asegurar que la condición sigue estando donde tiene que estar. La prueba de que FUNCIONA es
// `npm run sim:espera-revision`; esto solo impide que alguien la saque de la sentencia sin querer.

const fs = require('fs')
const path = require('path')

const CLI = fs.readFileSync(path.join(process.cwd(), 'scripts', 'backlog.cjs'), 'utf8')

/**
 * El bloque del claim: desde SU update hasta el FOR UPDATE que lo cierra.
 *
 * Se ancla en `UPDATE public.backlog_tasks t` —la única sentencia del fichero con alias, y la del
 * claim— y se busca el cierre HACIA ADELANTE desde ahí. La primera versión hacía lo contrario
 * (buscar `FOR UPDATE SKIP LOCKED` y retroceder) y encontraba la mención en el COMENTARIO DE
 * CABECERA del fichero, con lo que el guardarraíl se caía sin que nada estuviera mal.
 */
function sentenciaDelClaim(): string {
  const desde = CLI.indexOf('UPDATE public.backlog_tasks t\n')
  expect(desde).toBeGreaterThan(0)
  const hasta = CLI.indexOf('FOR UPDATE SKIP LOCKED', desde)
  expect(hasta).toBeGreaterThan(desde)
  return CLI.slice(desde, hasta)
}

describe('el claim impide las CINCO esperas dentro de su propia sentencia', () => {
  const sql = sentenciaDelClaim()

  it.each([
    ['reloj', /snooze_until IS NULL OR snooze_until <= now\(\)/],
    ['deploy', /wake_on_deploy_sha IS NULL/],
    ['otra tarea', /blocked_by/],
    ['revisión humana', /review_requested_at IS NULL/],
  ])('la espera por %s se comprueba en el UPDATE', (_nombre, patron) => {
    expect(sql).toMatch(patron)
  })

  it('y las cuatro forzables se pueden saltar con --force, no a mano', () => {
    // Cada una va emparejada con la variable de force en el mismo predicado: si alguien quitara
    // ese emparejamiento, --force dejaría de funcionar o la espera dejaría de aplicar.
    for (const campo of ['snooze_until', 'wake_on_deploy_sha', 'review_requested_at']) {
      const linea = sql.split('\n').find((l) => l.includes(campo) && l.includes('AND ('))
      expect(linea).toBeDefined()
      expect(linea).toMatch(/\$\{force\}/)
    }
  })

  // El lease de PERSONA es el único NO forzable, y tiene que seguir siéndolo: forzarlo es pisar el
  // trabajo de otra sesión, que es lo que ningún --force debería permitir.
  it('el lease ajeno sigue sin ser forzable', () => {
    const linea = sql.split('\n').find((l) => l.includes('lease_until < now()'))
    expect(linea).toBeDefined()
    expect(linea).not.toMatch(/\$\{force\}/)
  })
})

describe('el gate que EXPLICA el rechazo ve los mismos datos que la sentencia', () => {
  // Si el SELECT que alimenta a `claimGate` no trae la columna, el rechazo ocurre pero se explica
  // con otro motivo. Pasó: la simulación reclamaba y el mensaje no mencionaba la revisión.
  it('el SELECT del motivo incluye review_requested_at', () => {
    const i = CLI.indexOf('const gate = claimGate(')
    expect(i).toBeGreaterThan(0)
    const select = CLI.slice(CLI.lastIndexOf('SELECT id, title, status', i), i)
    expect(select).toMatch(/review_requested_at/)
  })
})

describe('una petición de revisión sin entregable no puede existir', () => {
  const mig = fs.readFileSync(
    path.join(process.cwd(), 'supabase', 'migrations', '20260804_backlog_espera_revision.sql'), 'utf8')

  // El CLI se puede saltar (otra herramienta, un UPDATE a mano); la tabla no. Mismo criterio que
  // el CHECK de `due_reason`, que impide inventarse un plazo sin motivo externo.
  it('lo hace cumplir un CHECK, no solo el CLI', () => {
    expect(mig).toMatch(/ADD CONSTRAINT backlog_tasks_review_completo_check/)
    expect(mig).toMatch(/length\(btrim\(review_note\)\)\s*>=\s*20/)
  })
})
