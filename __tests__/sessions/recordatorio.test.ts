/**
 * @jest-environment node
 */
// El recordatorio de método a media tarea (T-495).
//
// Manuel: *«a veces se les olvida, y me he dado cuenta de que si se lo pongo cada poco lo hacen
// mejor»*. El método ya se imprime al `claim` y el `pre-push` bloquea sin capas, pero entre esos
// dos extremos hay horas — y la decisión de «¿esto ya existe?» se toma EN MEDIO.
//
// Lo que NO es: un temporizador. Un texto cada N minutos llega en mitad de una edición y se
// aprende a saltar, que es como murieron tres guardarraíles el 31/07.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { esHerramienta, palabrasDe, recordatorioPorFicherosNuevos, recordatorioPorTiempo } =
  require('@/lib/sessions/recordatorio.cjs')

describe('esHerramienta — a qué tiene sentido preguntarle «¿ya existe?»', () => {
  it.each([
    ['lib/sessions/parte.cjs'],
    ['scripts/sim/barrido-rutas.ts'],
    ['components/AlgoNuevo.tsx'],
  ])('%s → sí', (r) => expect(esHerramienta(r)).toBe(true))

  // Estrenar una ficha, una migración o un test no es construir una herramienta. Preguntárselo
  // sería ruido, y el ruido es lo que mata al recordatorio.
  it.each([
    ['docs/runbooks/algo.md'],
    ['supabase/migrations/20260803_algo.sql'],
    ['__tests__/sessions/parte.test.ts'],
    ['lib/sessions/parte.spec.ts'],
    ['scratchpad/prueba.cjs'],
    ['public/img/logo.png'],
  ])('%s → no', (r) => expect(esHerramienta(r)).toBe(false))
})

describe('palabrasDe — el comando de búsqueda sale ESCRITO, o es papel pintado', () => {
  it('saca las palabras distintivas del nombre, no de la ruta', () => {
    expect(palabrasDe('lib/sessions/recordatorio.cjs')).toEqual(['recordatorio'])
  })

  it('parte kebab, snake y camelCase', () => {
    expect(palabrasDe('scripts/sim/barrido-rutas.ts')).toEqual(['barrido', 'rutas'])
    expect(palabrasDe('lib/admin/toolRegistry.ts')).toEqual(['tool', 'registry'])
  })

  it('descarta lo que no distingue nada', () => {
    expect(palabrasDe('lib/utils/index.ts')).toEqual([])
  })
})

describe('recordatorioPorFicherosNuevos', () => {
  it('el silencio es la respuesta por defecto: sin ficheros nuevos, nada', () => {
    expect(recordatorioPorFicherosNuevos([])).toBe(null)
    expect(recordatorioPorFicherosNuevos(null)).toBe(null)
  })

  it('un commit de solo documentación NO recuerda nada', () => {
    expect(recordatorioPorFicherosNuevos(['docs/runbooks/x.md', '__tests__/a.test.ts'])).toBe(null)
  })

  // Las palabras salen del NOMBRE del fichero, no del directorio: `lib` y `convocatoria` son la
  // carpeta de media herramienta del repo y buscarlas devolvería de todo. Lo que distingue a
  // `notaInterna.cjs` es «nota interna».
  it('al estrenar una herramienta, trae el comando con SUS palabras', () => {
    const r = recordatorioPorFicherosNuevos(['lib/convocatoria/notaInterna.cjs'])
    expect(r.motivo).toBe('ficheros_nuevos')
    expect(r.lineas.join('\n')).toContain('npm run tools:buscar -- nota interna')
  })

  it('nombra las dos preguntas que evitan rehacer trabajo, y las capas', () => {
    const t = recordatorioPorFicherosNuevos(['lib/x/detector.cjs']).lineas.join('\n')
    expect(t).toContain('¿YA EXISTE?')
    expect(t).toContain('SILO')
    expect(t).toContain('guardarraíl')
  })
})

describe('recordatorioPorTiempo — momentos, no reloj', () => {
  // El umbral es el del lease (90 min) a propósito: recordar cada diez minutos es un temporizador
  // con otro nombre, y un temporizador se aprende a saltar.
  it('por debajo del umbral no dice nada', () => {
    expect(recordatorioPorTiempo(10)).toBe(null)
    expect(recordatorioPorTiempo(89)).toBe(null)
  })

  it('a partir del umbral, recuerda', () => {
    expect(recordatorioPorTiempo(90)).not.toBe(null)
    expect(recordatorioPorTiempo(200).lineas[0]).toContain('3h')
  })

  it.each([[null], [undefined], [NaN], [-5]])('una duración imposible no dispara nada (%s)', (m) => {
    expect(recordatorioPorTiempo(m as any)).toBe(null)
  })

  it('dice lo que Manuel repite: nada de chapuzas, integrado, con capas', () => {
    const t = recordatorioPorTiempo(120).lineas.join('\n')
    expect(t).toContain('chapuzas')
    expect(t).toContain('OBSERVABLE')
    expect(t).toContain('silos')
    expect(t).toContain('vence-sim')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// CADENCIA POR RELOJ (T-486, 06/08)
//
// Orden de Manuel: «las frases no solo deben saltar en cada tarea, también de forma cada x
// minutos para que no se le olviden». Los tres canales anteriores NO alcanzan a un trabajador
// autónomo que encadena tareas: el hook `UserPromptSubmit` necesita prompts y un `claude -p` no
// los tiene; el `pre-commit` solo dispara al estrenar ficheros; y `heartbeat` sí lo imprime pero
// exige que el trabajador se ACUERDE de lanzarlo — que es exactamente el modo de fallo que se
// está corrigiendo (la misma razón por la que «lee el manual entero» no funciona).
// ═══════════════════════════════════════════════════════════════════════════════════════════
describe('el método vuelve por reloj, sin depender de que nadie se acuerde', () => {
  const REC = require('@/lib/sessions/recordatorio.cjs')
  const AHORA = new Date('2026-08-06T12:00:00Z')
  const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60000)

  it('a una sesión nueva se le enseña enseguida (nunca visto = toca)', () => {
    expect(REC.tocaRecordar({ ultimo: null, ahora: AHORA })).toBe(true)
  })

  it('no se repite en cada comando: eso sería ruido y se aprende a ignorar', () => {
    expect(REC.tocaRecordar({ ultimo: haceMin(5), ahora: AHORA })).toBe(false)
    expect(REC.tocaRecordar({ ultimo: haceMin(29), ahora: AHORA })).toBe(false)
  })

  it('pero vuelve pasada la cadencia', () => {
    expect(REC.tocaRecordar({ ultimo: haceMin(REC.CADA_MIN), ahora: AHORA })).toBe(true)
    expect(REC.tocaRecordar({ ultimo: haceMin(180), ahora: AHORA })).toBe(true)
  })

  it('el bloque lleva las frases de la casa, no una paráfrasis', () => {
    const t = REC.bloqueMetodo().join('\n')
    expect(t).toMatch(/nada de chapuzas/)
    expect(t).toMatch(/tools:buscar/)
    expect(t).toMatch(/nada de silos/)
    expect(t).toMatch(/capas/)
    // Que salga de la MISMA constante que el resto de canales: dos redacciones del método
    // divergen, y entonces cada sesión trabaja con una versión distinta de las reglas.
    for (const l of REC.METODO) expect(t).toContain(l)
  })
})
