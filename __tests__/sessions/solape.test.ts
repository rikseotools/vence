/**
 * @jest-environment node
 */
// Unitarios del núcleo de solape entre sesiones (T-400). Importan la función REAL que usan el
// latido, `backlog.cjs claim` y `latidos.cjs`, no una copia.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  huellaRelevante, estaViva, calcularSolapes, checkoutsCompartidos,
  sesionesSinHuella, ficherosProbablesDeFicha,
} = require('@/lib/sessions/solape.cjs')

const AHORA = new Date('2026-07-31T12:00:00Z')
const hace = (min: number) => new Date(AHORA.getTime() - min * 60_000).toISOString()
const YO = 'sid-yo'

const ses = (over: Record<string, any> = {}) => ({
  sid: 'sid-otra', slug: 'otra', worktree_path: '/wt/otra',
  last_signal_at: hace(5), touched_files: [], ...over,
})

describe('huellaRelevante — la calibración es lo que hace creíble el aviso', () => {
  it('deja pasar el código, que es donde el choque duele', () => {
    expect(huellaRelevante(['lib/backlog/claim.ts', 'app/api/x/route.ts']))
      .toEqual(['app/api/x/route.ts', 'lib/backlog/claim.ts'])
  })

  // Un aviso que salta siempre deja de leerse. Medido el 31/07: el ÚNICO fichero compartido por
  // 3+ worktrees era el markdown del backlog — lo tocan todas las sesiones por diseño.
  it('descarta los ficheros que TODAS las sesiones tocan por diseño', () => {
    expect(huellaRelevante(['docs/roadmap/tareas-pendientes.md', 'CLAUDE.md', 'package-lock.json'])).toEqual([])
  })

  it('descarta el trabajo desechable de cada sesión (scratchpad, informes, worktrees de agente)', () => {
    expect(huellaRelevante([
      'scratchpad/t115/x.cjs', 'sim-reports/1/a.json', 'data/pilotos/x/y.cjs', '.claude/worktrees/z/a.ts',
    ])).toEqual([])
  })

  it('deduplica y ordena (la salida se compara y se imprime)', () => {
    expect(huellaRelevante(['b/x.ts', 'a/y.ts', 'b/x.ts'])).toEqual(['a/y.ts', 'b/x.ts'])
  })

  it('tolera basura sin reventar', () => {
    expect(huellaRelevante(null)).toEqual([])
    expect(huellaRelevante(['', '   ', null])).toEqual([])
  })
})

describe('calcularSolapes', () => {
  const run = (misFicheros: string[], sesiones: any[]) =>
    calcularSolapes({ misFicheros, sesiones, sid: YO, ahora: AHORA })

  it('encuentra el fichero que otra sesión viva está tocando', () => {
    const r = run(['lib/backlog/claim.ts'], [ses({ touched_files: ['lib/backlog/claim.ts', 'otro.ts'] })])
    expect(r).toHaveLength(1)
    expect(r[0].ficheros).toEqual(['lib/backlog/claim.ts'])
    expect(r[0].minutos).toBe(5)
  })

  it('no me cuenta a MÍ mismo como choque', () => {
    expect(run(['a/x.ts'], [ses({ sid: YO, touched_files: ['a/x.ts'] })])).toEqual([])
  })

  it('ignora sesiones muertas: un choque con quien ya no está no es un choque', () => {
    expect(run(['a/x.ts'], [ses({ last_signal_at: hace(60 * 30), touched_files: ['a/x.ts'] })])).toEqual([])
  })

  it('sin huella publicada NO inventa solape (null ≠ "no toca nada")', () => {
    expect(run(['a/x.ts'], [ses({ touched_files: null })])).toEqual([])
  })

  it('el markdown del backlog compartido NO es un choque (o avisaría siempre)', () => {
    expect(run(['docs/roadmap/tareas-pendientes.md'], [
      ses({ touched_files: ['docs/roadmap/tareas-pendientes.md'] }),
    ])).toEqual([])
  })

  it('ordena por cantidad de solape: primero con quien más pisas', () => {
    const r = run(['a.ts/x.ts', 'b.ts/y.ts', 'c.ts/z.ts'], [
      ses({ sid: 's1', slug: 'poco', touched_files: ['c.ts/z.ts'] }),
      ses({ sid: 's2', slug: 'mucho', touched_files: ['a.ts/x.ts', 'b.ts/y.ts'] }),
    ])
    expect(r.map((x: any) => x.slug)).toEqual(['mucho', 'poco'])
  })
})

// Es un problema DISTINTO y peor: en worktrees separados el choque acaba en un conflicto de git,
// visible y reversible; en el mismo directorio se sobrescriben en vivo y no hay nada que avise.
// Encontrado en cuanto se encendió el mapa: 4 sids latiendo desde el checkout principal.
describe('checkoutsCompartidos — varias sesiones en el MISMO directorio', () => {
  it('agrupa las sesiones vivas que comparten worktree', () => {
    const r = checkoutsCompartidos([
      ses({ sid: 'a', worktree_path: '/repo' }),
      ses({ sid: 'b', worktree_path: '/repo' }),
      ses({ sid: 'c', worktree_path: '/otro' }),
    ], AHORA)
    expect(r).toHaveLength(1)
    expect(r[0].worktree_path).toBe('/repo')
    expect(r[0].sids.sort()).toEqual(['a', 'b'])
  })

  it('una sola sesión por directorio no es un hallazgo', () => {
    expect(checkoutsCompartidos([ses({ sid: 'a', worktree_path: '/repo' })], AHORA)).toEqual([])
  })

  // El caso NORMAL, no el raro: cuando una sesión se muda a un worktree coge la identidad del
  // `.session-id` que hay allí, nace una fila nueva y **la vieja se queda congelada** apuntando
  // al directorio del que se fue. Con la ventana de 24 h que había antes, esas filas fantasma
  // hacían que el aviso siguiera en rojo DESPUÉS de arreglar el problema — que es la forma más
  // rápida de que un aviso se ignore. Medido el 31/07 mudando ocho sesiones.
  it('IGNORA las filas fantasma de sesiones que ya se mudaron (ventana corta)', () => {
    const r = checkoutsCompartidos([
      ses({ sid: 'aqui', worktree_path: '/repo', last_signal_at: hace(5) }),
      ses({ sid: 'fantasma1', worktree_path: '/repo', last_signal_at: hace(90) }),
      ses({ sid: 'fantasma2', worktree_path: '/repo', last_signal_at: hace(120) }),
    ], AHORA)
    expect(r).toEqual([])   // solo queda UNA viva ahí: no es «compartido»
  })

  it('pero SÍ avisa si de verdad hay dos trabajando ahora', () => {
    const r = checkoutsCompartidos([
      ses({ sid: 'a', worktree_path: '/repo', last_signal_at: hace(2) }),
      ses({ sid: 'b', worktree_path: '/repo', last_signal_at: hace(9) }),
      ses({ sid: 'fantasma', worktree_path: '/repo', last_signal_at: hace(200) }),
    ], AHORA)
    expect(r[0].sids.sort()).toEqual(['a', 'b'])
  })

  it('no cuenta a las muertas: dos sesiones que ya no están no se pisan', () => {
    expect(checkoutsCompartidos([
      ses({ sid: 'a', worktree_path: '/repo' }),
      ses({ sid: 'b', worktree_path: '/repo', last_signal_at: hace(60 * 30) }),
    ], AHORA)).toEqual([])
  })
})

describe('sesionesSinHuella — poder decir "no lo sé"', () => {
  it('lista las vivas que no publican huella (un verde ciego sería falso)', () => {
    const r = sesionesSinHuella([
      ses({ sid: 'a', touched_files: null }),
      ses({ sid: 'b', touched_files: ['x/y.ts'] }),
      ses({ sid: 'c', touched_files: null, last_signal_at: hace(60 * 30) }),  // muerta
    ], YO, AHORA)
    expect(r.map((x: any) => x.sid)).toEqual(['a'])
  })
})

describe('ficherosProbablesDeFicha — avisar YA al reclamar, antes de escribir nada', () => {
  it('saca las rutas citadas entre backticks en la ficha', () => {
    const ficha = 'Arreglo en `lib/backlog/pushGuard.cjs` y su test `__tests__/backlog/pushGuard.test.ts`.'
    expect(ficherosProbablesDeFicha(ficha))
      .toEqual(['__tests__/backlog/pushGuard.test.ts', 'lib/backlog/pushGuard.cjs'])
  })

  it('NO toma por fichero cualquier cosa entre backticks', () => {
    expect(ficherosProbablesDeFicha('El campo `is_active`, el comando `claim` y la tarea `T-042`.')).toEqual([])
  })

  it('aplica el mismo filtro de ruido (el markdown del backlog se cita en media docs)', () => {
    expect(ficherosProbablesDeFicha('ver `docs/roadmap/tareas-pendientes.md`')).toEqual([])
  })

  it('ficha vacía o ausente → nada', () => {
    expect(ficherosProbablesDeFicha('')).toEqual([])
    expect(ficherosProbablesDeFicha(null)).toEqual([])
  })
})

describe('estaViva', () => {
  it('viva dentro de la ventana, muerta fuera', () => {
    expect(estaViva(ses({ last_signal_at: hace(60) }), AHORA)).toBe(true)
    expect(estaViva(ses({ last_signal_at: hace(60 * 25) }), AHORA)).toBe(false)
  })
  it('sin señal no está viva (y no revienta)', () => {
    expect(estaViva(ses({ last_signal_at: null }), AHORA)).toBe(false)
    expect(estaViva(null, AHORA)).toBe(false)
  })
})
