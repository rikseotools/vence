/**
 * @jest-environment node
 */
/**
 * Guardarraíl: la identidad de sesión se resuelve en UN solo sitio (T-407).
 *
 * Todo el reparto de trabajo entre sesiones cuelga de ese identificador — el claim del backlog y
 * su lease, la cola de impugnaciones, el guardarraíl de push, el latido y el mapa de solape. Si
 * dos herramientas del mismo worktree resuelven identidades distintas, todo eso empieza a mentir
 * sin romperse, que es la peor forma de fallar.
 *
 * Y ya pasó: el 31/07 una sesión reportó que el dossier de una impugnación la avisaba de que la
 * tarea la tenía «otra sesión» **siendo ella misma**. Detrás había SEIS copias del resolvedor con
 * DOS reglas distintas (unas leían el `.session-id` del worktree, otras solo la variable de
 * entorno). Una de las seis se había escrito ESE MISMO DÍA, lo que dice todo sobre por qué esto
 * necesita un guardarraíl y no una corrección puntual.
 *
 * Se comprueba por TEXTO porque corre en CI sin BD ni worktrees: se busca el patrón de "resolver
 * la identidad a mano" en los scripts que la usan.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const REPO = process.cwd()

/** Los scripts que reparten trabajo entre sesiones: todos tienen que preguntar al mismo módulo. */
const CONSUMIDORES = [
  'scripts/backlog.cjs',
  'scripts/backlog-push-guard.cjs',
  'scripts/impugnaciones/cola.cjs',
  'scripts/impugnaciones/revisar-impugnacion.cjs',
  'scripts/impugnaciones/revisar-feedback.cjs',
  'scripts/sessions/latir.cjs',
  'scripts/deploy-marcar.cjs',
]

const leer = (rel: string) => readFileSync(join(REPO, rel), 'utf8')
/** Quita comentarios de línea: una MENCIÓN en prosa no es una implementación. */
const sinComentarios = (s: string) => s.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

describe('guardarraíl — una sola identidad de sesión', () => {
  it('el módulo compartido existe y expone resolverSid', () => {
    expect(existsSync(join(REPO, 'lib/sessions/sid.cjs'))).toBe(true)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require('@/lib/sessions/sid.cjs')
    expect(typeof m.resolverSid).toBe('function')
  })

  it('todos los repartidores de trabajo lo USAN', () => {
    // Se busca el SÍMBOLO importado, no la ruta: varios lo requieren con `path.join(…, 'sessions',
    // 'sid.cjs')` porque corren desde worktrees distintos, así que la ruta literal no aparece.
    const sinUsar = CONSUMIDORES.filter((f) => !/\bresolverSid\b/.test(leer(f)))
    expect({ noUsanElModuloCompartido: sinUsar }).toEqual({ noUsanElModuloCompartido: [] })
  })

  it('ninguno vuelve a leer `.session-id` por su cuenta', () => {
    // El fallo concreto: dos reglas distintas para el mismo dato. Si alguien lo relee a mano,
    // vuelve a poder divergir aunque el módulo exista.
    const culpables = CONSUMIDORES.filter((f) => /readFileSync\([^)]*\.session-id/.test(sinComentarios(leer(f))))
    expect({ releenElFicheroAMano: culpables }).toEqual({ releenElFicheroAMano: [] })
  })

  it('ninguno lee CLAUDE_CODE_SESSION_ID por su cuenta', () => {
    // Es la mitad del fallo original: `revisar-impugnacion.cjs` miraba SOLO la variable, así que
    // en un worktree creado con el tooling no coincidía con quien había reclamado.
    const culpables = CONSUMIDORES.filter((f) => sinComentarios(leer(f)).includes('process.env.CLAUDE_CODE_SESSION_ID'))
    expect({ leenLaVariableAMano: culpables }).toEqual({ leenLaVariableAMano: [] })
  })

  it('el módulo compartido es el ÚNICO sitio que mira las dos fuentes', () => {
    const src = leer('lib/sessions/sid.cjs')
    expect(src).toContain('.session-id')
    expect(src).toContain('CLAUDE_CODE_SESSION_ID')
  })
})
