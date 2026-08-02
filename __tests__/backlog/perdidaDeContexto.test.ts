/**
 * @jest-environment node
 */
// Unitarios de la lógica PURA del guardarraíl de pérdida de contexto (T-428).
// Importa la función REAL que corre el hook `.husky/pre-push` (vía scripts/contexto-push-guard.cjs),
// no una copia: así el test no da falso verde el día que el detector cambie.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { parseFichasConCuerpo, findPerdidaDeContexto, bloqueantes } = require('@/lib/backlog/perdidaDeContexto.cjs')
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

/** Cuerpo de N caracteres, en viñetas como las fichas reales. */
const cuerpo = (n: number) => `- ${'x'.repeat(Math.max(0, n - 2))}`

const ficha = (id: string, chars: number, opts: { hecha?: boolean } = {}) =>
  `### [${id}] 🟠 ${opts.hecha ? '✅ [HECHA 31/07] ' : '[ABIERTO 31/07] '}Título de ${id}\n\n${cuerpo(chars)}\n`

describe('parseFichasConCuerpo — trocear el markdown', () => {
  it('saca id, cabecera y cuerpo de cada ficha', () => {
    const md = `## Abiertas\n\n${ficha('T-100', 500)}\n${ficha('T-101', 300)}`
    const f = parseFichasConCuerpo(md)
    expect([...f.keys()]).toEqual(['T-100', 'T-101'])
    expect(f.get('T-100').chars).toBeGreaterThan(400)
    expect(f.get('T-100').doneMarked).toBe(false)
  })

  it('una ficha NO se come la sección que viene detrás', () => {
    const md = `${ficha('T-100', 500)}\n## Hechas\n\ntexto de otra sección que no es de la ficha\n`
    expect(parseFichasConCuerpo(md).get('T-100').cuerpo).not.toMatch(/otra sección/)
  })

  it('detecta el ✅ de la cabecera', () => {
    expect(parseFichasConCuerpo(ficha('T-100', 100, { hecha: true })).get('T-100').doneMarked).toBe(true)
  })

  it('una cabecera sin id no es una ficha', () => {
    expect(parseFichasConCuerpo('### Sección cualquiera\n\ntexto\n').size).toBe(0)
  })

  it('un id REPETIDO no inventa una pérdida (de eso ya avisa fichaDuplicada)', () => {
    // Si la segunda ocurrencia pisara a la primera, una ficha larga duplicada al final del
    // fichero se leería como "encogió" y el guard bloquearía por un problema que es otro.
    const md = `${ficha('T-100', 4000)}\n${ficha('T-100', 50)}`
    expect(parseFichasConCuerpo(md).get('T-100').chars).toBeGreaterThan(3000)
  })

  it('entradas basura no explotan', () => {
    expect(parseFichasConCuerpo('').size).toBe(0)
    expect(parseFichasConCuerpo(null).size).toBe(0)
    expect(parseFichasConCuerpo(undefined).size).toBe(0)
  })

  it('una cabecera que CITA otra tarea se registra con SU id, no con el citado', () => {
    // Falso positivo real (02/08): `### [T-492] … (la deuda que dejó [T-377])` se registraba
    // como ficha de T-377 —el `.*` era codicioso y capturaba el ÚLTIMO id— y su cuerpo corto
    // se comparaba contra la ficha larga de T-377: «pierde 85%», push bloqueado, y T-377
    // intacta en el fichero. Citar una tarea no es serla.
    const md = '### [T-492] 🟠 [ABIERTO 02/08] Deuda que dejó [T-377]\n\n- cuerpo corto de la nueva\n'
    const f = parseFichasConCuerpo(md)
    expect([...f.keys()]).toEqual(['T-492'])
    expect(f.has('T-377')).toBe(false)
  })

  it('la cita en la cabecera no puede fabricar una pérdida de la ficha citada', () => {
    const antes = ficha('T-377', 14000)
    const despues = `${antes}\n### [T-492] 🟠 Deuda que dejó [T-377]\n\n- cuerpo corto\n`
    const { hallazgos } = findPerdidaDeContexto(antes, despues)
    expect(hallazgos.filter(h => h.id === 'T-377')).toEqual([])
  })
})

describe('findPerdidaDeContexto — el daño que hay que cazar', () => {
  it('ficha VIVA que desaparece del fichero → error (el caso T-427: el cherry-pick)', () => {
    const antes = `${ficha('T-100', 3000)}\n${ficha('T-101', 2000)}`
    const despues = ficha('T-100', 3000)
    const { hallazgos } = findPerdidaDeContexto(antes, despues)
    expect(hallazgos).toHaveLength(1)
    expect(hallazgos[0]).toMatchObject({ id: 'T-101', tipo: 'desaparecida', severidad: 'error' })
  })

  it('ficha VIVA que pierde la mayor parte del cuerpo → error (el caso T-428: el conflicto)', () => {
    const { hallazgos } = findPerdidaDeContexto(ficha('T-100', 9000), ficha('T-100', 1000))
    expect(hallazgos[0]).toMatchObject({ id: 'T-100', tipo: 'mermada', severidad: 'error' })
    expect(hallazgos[0].ratio).toBeGreaterThan(0.8)
  })

  it('la ficha que se AÑADE no es una pérdida', () => {
    const { hallazgos } = findPerdidaDeContexto(ficha('T-100', 3000), `${ficha('T-100', 3000)}\n${ficha('T-101', 2000)}`)
    expect(hallazgos).toHaveLength(0)
  })

  it('AMPLIAR una ficha (el caso normal: documentar) no dispara nada', () => {
    expect(findPerdidaDeContexto(ficha('T-100', 1000), ficha('T-100', 9000)).hallazgos).toHaveLength(0)
  })

  it('un cambio que no toca las fichas no dispara nada', () => {
    const md = `## Abiertas\n\n${ficha('T-100', 3000)}`
    expect(findPerdidaDeContexto(md, md).hallazgos).toHaveLength(0)
  })
})

// Sin estas exenciones el detector grita justo en los dos casos en los que encoger es lo correcto,
// y un guardarraíl que grita en falso acaba apagado entero (T-423).
describe('las exenciones, que son lo que sostiene la precisión', () => {
  it('CERRAR una ficha y condensarla no bloquea: se reporta como info', () => {
    const { hallazgos } = findPerdidaDeContexto(ficha('T-100', 9000), ficha('T-100', 500, { hecha: true }))
    expect(hallazgos[0].severidad).toBe('info')
    expect(bloqueantes(hallazgos)).toHaveLength(0)
  })

  it('…pero se sigue REPORTANDO, para que un borrado no se disfrace de cierre', () => {
    const { hallazgos } = findPerdidaDeContexto(ficha('T-100', 9000), ficha('T-100', 500, { hecha: true }))
    expect(hallazgos).toHaveLength(1)
  })

  it('una ficha que YA estaba cerrada y encoge SÍ bloquea (no hay cierre que lo justifique)', () => {
    const { hallazgos } = findPerdidaDeContexto(
      ficha('T-100', 9000, { hecha: true }),
      ficha('T-100', 500, { hecha: true }),
    )
    expect(hallazgos[0].severidad).toBe('error')
  })

  it('una ficha DIMINUTA que encoge no dispara: por debajo del suelo no se mira el ratio', () => {
    // 300 → 100 caracteres es el 66% del cuerpo y no ha pasado nada.
    expect(findPerdidaDeContexto(ficha('T-100', 300), ficha('T-100', 100)).hallazgos).toHaveLength(0)
  })

  it('perder MUCHO texto pero poca fracción tampoco dispara (una ficha enorme que se poda)', () => {
    // 20.000 → 18.000: son 2.000 caracteres, por encima del suelo, pero solo el 10%.
    expect(findPerdidaDeContexto(ficha('T-100', 20000), ficha('T-100', 18000)).hallazgos).toHaveLength(0)
  })

  it('hacen falta LAS DOS condiciones: suelo absoluto Y fracción', () => {
    expect(findPerdidaDeContexto(ficha('T-100', 4000), ficha('T-100', 1000)).hallazgos).toHaveLength(1)
  })
})

describe('bloqueantes — solo los error paran el push', () => {
  it('filtra los info', () => {
    expect(bloqueantes([{ severidad: 'error' }, { severidad: 'info' }])).toHaveLength(1)
  })
  it('entradas basura no explotan', () => {
    expect(bloqueantes(null)).toEqual([])
    expect(bloqueantes(undefined)).toEqual([])
  })
})

// El fichero real es el único sitio donde se ve si el parser aguanta 415 fichas escritas por
// muchas manos: viñetas anidadas, tablas, bloques de código, emojis y tres secciones `## Hechas`.
describe('contra el fichero REAL (el parser tiene que aguantar lo que hay escrito)', () => {
  const md = readFileSync(join(ROOT, 'docs/roadmap/tareas-pendientes.md'), 'utf8')
  const fichas = parseFichasConCuerpo(md)

  it('parsea todas las fichas del fichero vivo', () => {
    const cabeceras = (md.match(/^###\s+.*\[T-\d+\]/gm) || []).length
    // Puede haber ids repetidos (los caza fichaDuplicada); por eso ≤ y no ===.
    expect(fichas.size).toBeGreaterThan(300)
    expect(fichas.size).toBeLessThanOrEqual(cabeceras)
  })

  it('ninguna ficha sale con el cuerpo vacío (señal de que el troceado se rompió)', () => {
    const vacias = [...fichas.values()].filter((f: { chars: number }) => f.chars === 0)
    expect(vacias).toHaveLength(0)
  })

  it('el fichero comparado consigo mismo no da NI UN hallazgo (cero falsos positivos en reposo)', () => {
    expect(findPerdidaDeContexto(md, md).hallazgos).toHaveLength(0)
  })

  it('borrar una ficha real del fichero vivo se caza', () => {
    const id = [...fichas.keys()][0] as string
    const sinElla = md.replace(fichas.get(id).headline, '### [T-999] 🟠 otra cabecera')
    const ids = findPerdidaDeContexto(md, sinElla).hallazgos.map((h: { id: string }) => h.id)
    expect(ids).toContain(id)
  })
})

// El modo de fallo más silencioso posible: el script existe, sus tests pasan, y no lo llama nadie.
describe('cableado: el hook invoca de verdad al guard', () => {
  const prePush = readFileSync(join(ROOT, '.husky/pre-push'), 'utf8')

  it('.husky/pre-push llama a contexto-push-guard y bloquea si falla', () => {
    expect(prePush).toMatch(/node scripts\/contexto-push-guard\.cjs \|\| exit 1/)
  })

  it('va antes del typecheck (es puro git: si bloquea, no pagas los ~14 s de tsc)', () => {
    expect(prePush.indexOf('contexto-push-guard')).toBeLessThan(prePush.indexOf('typecheck-push-guard'))
  })

  it('el escape está documentado en el hook (si no, se acaba usando --no-verify)', () => {
    expect(prePush).toContain('CONTEXTO_GUARD_SKIP=1')
  })

  it('el escape es PROPIO: no lo apaga el de otro guardarraíl', () => {
    const bridge = readFileSync(join(ROOT, 'scripts/contexto-push-guard.cjs'), 'utf8')
    expect(bridge).toMatch(/CONTEXTO_GUARD_SKIP/)
    expect(bridge).not.toMatch(/BACKLOG_GUARD_SKIP|ROBUSTEZ_GUARD_SKIP/)
  })

  it('el bridge mide su propia fricción (bloqueo y escape) — T-423', () => {
    const bridge = readFileSync(join(ROOT, 'scripts/contexto-push-guard.cjs'), 'utf8')
    expect(bridge).toMatch(/friccion\('guard_escape'\)/)
    expect(bridge).toMatch(/friccion\('guard_bloqueo'/)
  })

  it('compara contra origin/main, no contra el padre (o el caso del merge es invisible)', () => {
    const bridge = readFileSync(join(ROOT, 'scripts/contexto-push-guard.cjs'), 'utf8')
    expect(bridge).toMatch(/origin\/main:\$\{FICHERO\}/)
    expect(bridge).toMatch(/merge-base', '--is-ancestor', 'origin\/main', 'HEAD'/)
  })
})
