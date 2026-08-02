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

// ── LA MÁQUINA ES LA OTRA MITAD DE LA IDENTIDAD (T-484, 02/08/2026) ───────────────────────────
// Con sesiones en servidores remotos, «quién soy» no basta: dos sesiones en `/app/vence` de dos
// contenedores distintos no comparten nada, y dos sid iguales en máquinas distintas comparten
// claim y lease. Así que «qué máquina soy» se resuelve igual que el sid: en UN solo sitio.
//
// Sin esto, el fallo de T-407 se repite exactamente igual una capa más abajo — y ya empezaba:
// `latir.cjs` llamaba a `os.hostname()` por su cuenta mientras nadie más miraba ese dato, así que
// el host que se ESCRIBÍA y el que se habría COMPARADO podían no ser el mismo.
describe('guardarraíl — una sola resolución de MÁQUINA', () => {
  /** Quien decide algo con la máquina: el latido la escribe, el guard del índice compara con ella. */
  const CONSUMIDORES_HOST = [
    'scripts/sessions/latir.cjs',
    'scripts/sessions/latidos.cjs',
    'scripts/check-indice-compartido.cjs',
    'lib/sessions/indiceCompartido.cjs',
  ]

  it('el módulo compartido expone `maquina` y `mismaMaquina`', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const m = require('@/lib/sessions/sid.cjs')
    expect(typeof m.maquina).toBe('function')
    expect(typeof m.mismaMaquina).toBe('function')
  })

  it('nadie llama a os.hostname() por su cuenta', () => {
    const culpables = CONSUMIDORES_HOST.filter((f) => /\bos\.hostname\s*\(/.test(sinComentarios(leer(f))))
    expect({ resuelvenLaMaquinaAMano: culpables }).toEqual({ resuelvenLaMaquinaAMano: [] })
  })

  it('nadie lee VENCE_SESSION_HOST por su cuenta', () => {
    // Es el gemelo de CLAUDE_CODE_SESSION_ID: la variable existe porque en un contenedor el
    // hostname cambia en cada arranque, y quien la lea a medias verá otra máquina que el resto.
    const culpables = CONSUMIDORES_HOST.filter((f) => sinComentarios(leer(f)).includes('VENCE_SESSION_HOST'))
    expect({ leenLaVariableAMano: culpables }).toEqual({ leenLaVariableAMano: [] })
  })

  it('el módulo compartido es el ÚNICO sitio que mira las dos fuentes de la máquina', () => {
    const src = leer('lib/sessions/sid.cjs')
    expect(src).toContain('VENCE_SESSION_HOST')
    expect(src).toContain('os.hostname()')
  })

  it('el comparador de máquinas tiene TRES estados: no se puede colapsar a booleano', () => {
    // Un `false` donde debería haber `null` convierte «no lo sé» en «otra máquina», y entonces el
    // guard del índice deja pasar a dos sesiones que SÍ comparten disco — el fallo que existe
    // para cazar, pero silencioso.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mismaMaquina } = require('@/lib/sessions/sid.cjs')
    expect(mismaMaquina(null, 'x')).toBe(null)
    expect(mismaMaquina('x', 'y')).toBe(false)
    expect(mismaMaquina('x', 'x')).toBe(true)
  })
})
