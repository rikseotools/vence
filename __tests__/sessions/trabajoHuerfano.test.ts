/**
 * @jest-environment node
 */
// Unitarios del criterio de «trabajo huérfano» (T-431). Importa el módulo REAL que usan a la vez
// el barrido (`scripts/sessions/huerfanos.cjs`), el mapa de sesiones (`latidos.cjs`) y el guard de
// `borrar-worktree.sh`: si esos tres opinaran distinto, el que protege de verdad —el del borrado,
// que es irreversible— sería el que mintiera.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificarWorktree, resumenBarrida, puedeBorrarse, MIN_SIN_SENAL } =
  require('@/lib/sessions/trabajoHuerfano.cjs')

describe('clasificarWorktree — los cinco worktrees reales del 31/07', () => {
  it('sesion-28jul-d: 3 ficheros que solo existen ahí → CONTENIDO ÚNICO (el que importaba)', () => {
    const r = clasificarWorktree({
      slug: 'sesion-28jul-d',
      ficherosUnicos: ['docs/gotchas.md', 'docs/otro.md', 'CLAUDE.md'],
      commitsAhead: 1, commitsUnicos: 1, minSinSenal: null,
    })
    expect(r.veredicto).toBe('contenido_unico')
    expect(r.gravedad).toBe('warn')
  })

  it('vence-clean: 47 commits sin pushear pero YA en la principal por contenido → ruido', () => {
    // El caso que justifica todo el diseño: contar commits daba 47 y la respuesta correcta es 0.
    const r = clasificarWorktree({
      slug: 'vence-clean', ficherosUnicos: [], commitsAhead: 47, commitsUnicos: 0, minSinSenal: null,
    })
    expect(r.veredicto).toBe('solo_desfasado')
    expect(r.gravedad).toBe('info')
    expect(r.motivo).toMatch(/47 commit/)
  })

  it('pagos-planes: 7 ficheros idénticos a la principal → nada que perder', () => {
    const r = clasificarWorktree({ slug: 'pagos-planes', ficherosUnicos: [], minSinSenal: null })
    expect(r.veredicto).toBe('sin_trabajo')
  })

  it('umu-golive: versión desfasada de algo ya subido → nada que perder', () => {
    const r = clasificarWorktree({ slug: 'umu-golive', ficherosUnicos: [], commitsAhead: 0, minSinSenal: null })
    expect(r.veredicto).toBe('sin_trabajo')
  })

  it('scrape-opositatest: trabajo SIN COMMITEAR también cuenta (es lo más frágil)', () => {
    const r = clasificarWorktree({
      slug: 'scrape', ficherosUnicos: ['docs/limpieza.md'], commitsAhead: 0, commitsUnicos: 0, minSinSenal: null,
    })
    expect(r.veredicto).toBe('contenido_unico')
    expect(r.motivo).toMatch(/sin commitear/)
  })

  it('4 de 5 no avisan: es la proporción que decide si el detector sobrevive', () => {
    const r = resumenBarrida([
      clasificarWorktree({ slug: 'a', ficherosUnicos: ['x'], minSinSenal: null }),
      clasificarWorktree({ slug: 'b', ficherosUnicos: [], commitsAhead: 47, minSinSenal: null }),
      clasificarWorktree({ slug: 'c', ficherosUnicos: [], minSinSenal: null }),
      clasificarWorktree({ slug: 'd', ficherosUnicos: [], minSinSenal: null }),
      clasificarWorktree({ slug: 'e', ficherosUnicos: [], minSinSenal: null }),
    ])
    expect(r.total).toBe(5)
    expect(r.huerfanos).toHaveLength(1)
    expect(r.hallazgo).toBe(true)
  })
})

describe('clasificarWorktree — la vida manda sobre la antigüedad', () => {
  it('sesión VIVA con trabajo propio: no se opina (está trabajando)', () => {
    const r = clasificarWorktree({ slug: 'viva', ficherosUnicos: ['lib/x.js'], minSinSenal: 5 })
    expect(r.veredicto).toBe('en_uso')
  })

  it('un PROCESO dentro manda aunque la señal sea vieja (puede llevar horas compilando)', () => {
    const r = clasificarWorktree({
      slug: 'compilando', ficherosUnicos: ['lib/x.js'], minSinSenal: 60 * 24, procesos: 3,
    })
    expect(r.veredicto).toBe('en_uso')
  })

  it('justo en el umbral sigue viva; pasado el umbral ya se juzga su contenido', () => {
    expect(clasificarWorktree({ slug: 'x', ficherosUnicos: ['a'], minSinSenal: MIN_SIN_SENAL - 1 }).veredicto).toBe('en_uso')
    expect(clasificarWorktree({ slug: 'x', ficherosUnicos: ['a'], minSinSenal: MIN_SIN_SENAL }).veredicto).toBe('contenido_unico')
  })

  it('«nunca latió» NO es «viva»: es el caso típico del worktree abandonado', () => {
    const r = clasificarWorktree({ slug: 'vieja', ficherosUnicos: ['a'], minSinSenal: null, procesos: 0 })
    expect(r.veredicto).toBe('contenido_unico')
  })

  it('procesos = null (no se pudo saber) no convierte un desconocido en «viva»', () => {
    // «No lo sé» tiene que poder decirse, pero no puede inventarse un veredicto tranquilizador:
    // si no hay señal Y no se pueden mirar los procesos, se juzga por el contenido.
    const r = clasificarWorktree({ slug: 'x', ficherosUnicos: ['a'], minSinSenal: null, procesos: null })
    expect(r.veredicto).toBe('contenido_unico')
  })
})

describe('puedeBorrarse — el guard del borrado usa EXACTAMENTE el mismo criterio', () => {
  it('bloquea solo el contenido único', () => {
    const c = clasificarWorktree({ slug: 'x', ficherosUnicos: ['docs/a.md'], minSinSenal: null })
    expect(puedeBorrarse(c)).toMatchObject({ borrable: false })
  })

  it('DEJA borrar los 47 commits que ya están arriba — antes bloqueaba y empujaba al --force', () => {
    // Ese --force descarta también los cambios sin commitear: el bloqueo ruidoso no solo molesta,
    // enseña a usar el gesto que destruye.
    const c = clasificarWorktree({ slug: 'vence-clean', ficherosUnicos: [], commitsAhead: 47, minSinSenal: null })
    expect(puedeBorrarse(c).borrable).toBe(true)
  })

  it('deja borrar lo sincronizado y lo que está en uso lo decide el otro guard', () => {
    expect(puedeBorrarse(clasificarWorktree({ slug: 'x', ficherosUnicos: [], minSinSenal: null })).borrable).toBe(true)
    expect(puedeBorrarse(clasificarWorktree({ slug: 'x', ficherosUnicos: ['a'], minSinSenal: 1 })).borrable).toBe(true)
  })

  it('sin clasificación no inventa un bloqueo', () => {
    expect(puedeBorrarse(null).borrable).toBe(true)
  })
})
