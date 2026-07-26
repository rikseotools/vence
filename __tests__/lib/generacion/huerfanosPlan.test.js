const fs = require('fs')
const path = require('path')
const {
  UMBRALES,
  disparaFinding,
  temasQueDisparan,
  rankingHuerfanos,
  simulaCobertura,
  proponeLote,
  marcaEnCurso,
} = require('../../../lib/generacion/huerfanosPlan')

/** Fixture: n artículos de una ley en un tema, `cubiertos` de ellos con preguntas. */
function tema({ pt, topicId, tema: t = 1, leySlug = 'ley-x', ley = 'Ley X', desde = 1, n, cubiertos }) {
  return Array.from({ length: n }, (_, i) => ({
    pt,
    topicId,
    tema: t,
    leySlug,
    ley,
    articulo: String(desde + i),
    cubierto: i < cubiertos,
  }))
}

describe('disparaFinding (umbrales del detector article_no_coverage)', () => {
  it('dispara con ≥4 huecos y ≥60% cubierto', () => {
    expect(disparaFinding({ n: 10, cubiertos: 6 })).toBe(true)
  })

  it('no dispara si el tema está entero cubierto', () => {
    expect(disparaFinding({ n: 10, cubiertos: 10 })).toBe(false)
  })

  it('no dispara con menos de 4 huecos (ese es el corte del detector)', () => {
    expect(disparaFinding({ n: 10, cubiertos: 7 })).toBe(false)
  })

  it('no dispara por debajo del 60% de cobertura: eso es low_coverage, otro problema', () => {
    expect(disparaFinding({ n: 20, cubiertos: 11 })).toBe(false)
  })

  it('no dispara en temas de menos de 4 artículos', () => {
    expect(disparaFinding({ n: 3, cubiertos: 0 })).toBe(false)
  })
})

describe('rankingHuerfanos (prioriza por ALCANCE cross-oposición)', () => {
  // Mismo artículo escopado por 3 oposiciones vs otro escopado por 1.
  const filas = [
    ...tema({ pt: 'opo_a', topicId: 'tA', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'opo_b', topicId: 'tB', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'opo_c', topicId: 'tC', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'opo_d', topicId: 'tD', leySlug: 'ley-y', ley: 'Ley Y', desde: 100, n: 10, cubiertos: 6 }),
  ]

  it('pone arriba el artículo que escopan más oposiciones', () => {
    const r = rankingHuerfanos(filas)
    expect(r[0].nOposiciones).toBe(3)
    expect(r[0].oposiciones).toEqual(['opo_a', 'opo_b', 'opo_c'])
    expect(r[r.length - 1].nOposiciones).toBe(1)
  })

  it('ignora los huérfanos de temas que NO disparan (cubrirlos no baja el badge)', () => {
    const conTemaSano = [...filas, ...tema({ pt: 'opo_e', topicId: 'tE', leySlug: 'ley-z', ley: 'Ley Z', desde: 200, n: 10, cubiertos: 9 })]
    expect(rankingHuerfanos(conTemaSano).some((a) => a.leySlug === 'ley-z')).toBe(false)
  })

  it('no propone artículos ya cubiertos', () => {
    expect(rankingHuerfanos(filas).some((a) => a.articulo === '1')).toBe(false)
  })
})

describe('simulaCobertura (impacto ANTES de escribir una sola pregunta)', () => {
  const filas = [
    ...tema({ pt: 'opo_a', topicId: 'tA', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'opo_b', topicId: 'tB', n: 10, cubiertos: 6 }),
  ]

  it('apaga los dos temas al cubrir los 4 huecos compartidos', () => {
    const arts = ['7', '8', '9', '10'].map((articulo) => ({ leySlug: 'ley-x', articulo }))
    const s = simulaCobertura(filas, arts)
    expect(s.temasAntes).toBe(2)
    expect(s.temasDespues).toBe(0)
    expect(s.oposicionesLimpias).toEqual(['opo_a', 'opo_b'])
  })

  // El detector exige ≥4 huecos: cubrir UNO ya lo apaga y deja 3 artículos
  // sirviendo 0 preguntas, ahora invisibles para el badge. Que la simulación lo
  // diga es lo que evita cerrar el lote creyendo el tema cubierto.
  it('apagar el finding NO es cubrir el tema: avisa de los huérfanos residuales', () => {
    const s = simulaCobertura(filas, [{ leySlug: 'ley-x', articulo: '7' }])
    expect(s.temasDespues).toBe(0)
    expect(s.huerfanosResidualesEnTemasApagados).toEqual(['ley-x#10', 'ley-x#8', 'ley-x#9'])
  })

  it('cubrir los 4 huecos no deja residuo', () => {
    const arts = ['7', '8', '9', '10'].map((articulo) => ({ leySlug: 'ley-x', articulo }))
    expect(simulaCobertura(filas, arts).huerfanosResidualesEnTemasApagados).toEqual([])
  })

  it('el ranking completo (soloQueDisparan:false) ve la deuda que el badge ya no muestra', () => {
    const extra = new Set(['ley-x#7'])
    expect(rankingHuerfanos(filas, { cubiertosExtra: extra })).toEqual([]) // el badge ya no pide nada
    const real = rankingHuerfanos(filas, { soloQueDisparan: false, cubiertosExtra: extra })
    expect(real.map((a) => a.articulo).sort()).toEqual(['10', '8', '9'])
  })

  it('no cuenta artículos de otra ley aunque coincida el número', () => {
    const s = simulaCobertura(filas, ['7', '8', '9', '10'].map((articulo) => ({ leySlug: 'otra-ley', articulo })))
    expect(s.temasDespues).toBe(2)
  })
})

describe('proponeLote', () => {
  const filas = [
    ...tema({ pt: 'opo_a', topicId: 'tA', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'opo_b', topicId: 'tB', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'opo_c', topicId: 'tC', leySlug: 'ley-y', ley: 'Ley Y', desde: 100, n: 10, cubiertos: 6 }),
  ]

  it('propone UNA sola ley (scope estrecho del manual) y mide su impacto', () => {
    const lote = proponeLote(filas, { maxArticulos: 4 })
    expect(lote.leySlug).toBe('ley-x')
    expect(new Set(lote.articulos.map((a) => a.leySlug)).size).toBe(1)
    expect(lote.articulos).toHaveLength(4)
    expect(lote.impacto.temasApagados).toHaveLength(2)
  })

  it('respeta excluirLeyes para que dos sesiones en paralelo no colisionen', () => {
    expect(proponeLote(filas, { excluirLeyes: ['ley-x'] }).leySlug).toBe('ley-y')
  })

  it('devuelve null cuando no queda nada que hacer', () => {
    expect(proponeLote(tema({ pt: 'opo_a', topicId: 'tA', n: 10, cubiertos: 10 }))).toBeNull()
  })
})

// ── GUARDARRAÍL: el planificador es un ESPEJO del detector ──────────────────
// Si alguien recalibra `article_no_coverage` en el sweep y no toca este lib, el
// planner propondría lotes que no apagan nada y la campaña perseguiría un badge
// que ya no se mueve. Mismo patrón que `content-sweep-parity`.
describe('paridad con el detector article_no_coverage', () => {
  const SERVICE = path.join(__dirname, '../../../backend/src/content-health-sweep/content-health-sweep.service.ts')

  it('los umbrales del planificador siguen siendo los del sweep', () => {
    const src = fs.readFileSync(SERVICE, 'utf8')
    const having = src.slice(src.indexOf('HAVING count(*) >='), src.indexOf('HAVING count(*) >=') + 700)

    expect(having).toContain(`HAVING count(*) >= ${UMBRALES.minArticulos}`)
    expect(having).toContain(`/ count(*) >= ${UMBRALES.minCobertura}`)
    expect(having).toMatch(new RegExp(`count\\(\\*\\) - count\\(\\*\\) FILTER[\\s\\S]*?>= ${UMBRALES.minHuecos}`))
  })
})

// ── Señales aportadas al fusionar el planificador duplicado (26/07/2026) ──────
// El 26/07 dos sesiones construyeron dos planificadores a la vez. Al retirar el
// duplicado, estas dos señales suyas se trajeron aquí porque no las había.

describe('rankingHuerfanos — demanda (a cuánta gente llega el hueco)', () => {
  // Mismo artículo huérfano en dos oposiciones de tamaño muy distinto.
  const filas = [
    ...tema({ pt: 'grande', topicId: 'T1', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'pequena', topicId: 'T2', n: 10, cubiertos: 6 }),
  ]

  it('sin datos de demanda, usuarios queda a 0 y no rompe nada', () => {
    expect(rankingHuerfanos(filas).every((a) => a.usuarios === 0)).toBe(true)
  })

  it('suma los usuarios de las oposiciones que escopan el artículo', () => {
    const r = rankingHuerfanos(filas, { demanda: { grande: 2000, pequena: 30 } })
    expect(r[0].usuarios).toBe(2030)
  })

  it('no duplica al mismo opositor porque su oposición lo escope en dos temas', () => {
    const dosTemas = [
      ...tema({ pt: 'grande', topicId: 'T1', n: 10, cubiertos: 6 }),
      ...tema({ pt: 'grande', topicId: 'T2', tema: 2, n: 10, cubiertos: 6 }),
    ]
    const r = rankingHuerfanos(dosTemas, { demanda: { grande: 2000 } })
    expect(r[0].nTemas).toBe(2)
    expect(r[0].usuarios).toBe(2000)
  })

  it('la demanda NO altera el orden: sigue mandando el alcance', () => {
    const mixto = [
      ...tema({ pt: 'a', topicId: 'T1', leySlug: 'ancha', n: 10, cubiertos: 6 }),
      ...tema({ pt: 'b', topicId: 'T2', leySlug: 'ancha', n: 10, cubiertos: 6 }),
      ...tema({ pt: 'c', topicId: 'T3', leySlug: 'estrecha', desde: 100, n: 10, cubiertos: 6 }),
    ]
    const r = rankingHuerfanos(mixto, { demanda: { c: 99999 } })
    expect(r[0].leySlug).toBe('ancha') // 2 oposiciones vs 1, pese a la demanda
  })
})

describe('marcaEnCurso — no elegir una ley que otra sesión está trabajando', () => {
  const filas = [
    ...tema({ pt: 'a', topicId: 'T1', leySlug: 'lprl', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'b', topicId: 'T2', leySlug: 'otra', desde: 100, n: 10, cubiertos: 6 }),
  ]

  it('marca solo las leyes con batch reciente', () => {
    const r = marcaEnCurso(rankingHuerfanos(filas), ['lprl'])
    expect(r.filter((a) => a.enCurso).every((a) => a.leySlug === 'lprl')).toBe(true)
    expect(r.some((a) => a.leySlug === 'otra' && a.enCurso === false)).toBe(true)
  })

  it('sin lista, no marca ninguna', () => {
    expect(marcaEnCurso(rankingHuerfanos(filas)).every((a) => a.enCurso === false)).toBe(true)
  })

  it('AVISA pero no filtra: continuar lo que otra sesión dejó a medias puede ser correcto', () => {
    const r = marcaEnCurso(rankingHuerfanos(filas), ['lprl'])
    expect(r).toHaveLength(rankingHuerfanos(filas).length)
  })
})

// ── Acotar a UNA oposición (26/07/2026) ─────────────────────────────────────
// Estrategia "cerrar la oposición con más usuarios" en vez de perseguir el badge:
// nació de medir que las oposiciones con más opositores tienen POCOS huecos.
describe('rankingHuerfanos con `oposicion` (cerrar una oposición del todo)', () => {
  const filas = [
    // opo_a comparte los huecos 7-10 de ley-x con opo_b…
    ...tema({ pt: 'opo_a', topicId: 'tA', n: 10, cubiertos: 6 }),
    ...tema({ pt: 'opo_b', topicId: 'tB', n: 10, cubiertos: 6 }),
    // …y opo_b tiene ADEMÁS huecos propios en otra ley.
    ...tema({ pt: 'opo_b', topicId: 'tB2', leySlug: 'ley-y', ley: 'Ley Y', desde: 100, n: 10, cubiertos: 6 }),
  ]

  it('deja fuera los huecos que no son de esa oposición', () => {
    const r = rankingHuerfanos(filas, { oposicion: 'opo_a' })
    expect(r.every((a) => a.leySlug === 'ley-x')).toBe(true)
    expect(rankingHuerfanos(filas, { oposicion: 'opo_b' }).some((a) => a.leySlug === 'ley-y')).toBe(true)
  })

  it('el alcance y los usuarios siguen siendo GLOBALES, no los de la oposición acotada', () => {
    const r = rankingHuerfanos(filas, { oposicion: 'opo_a', demanda: { opo_a: 100, opo_b: 900 } })
    // El artículo lo escopan las dos oposiciones: se reporta 2 y 1.000 usuarios,
    // aunque el ranking se haya pedido "de opo_a".
    expect(r[0].nOposiciones).toBe(2)
    expect(r[0].usuarios).toBe(1000)
  })

  it('sin `oposicion` el comportamiento no cambia (compatibilidad)', () => {
    expect(rankingHuerfanos(filas).length).toBe(rankingHuerfanos(filas, { oposicion: null }).length)
  })

  it('devuelve vacío si la oposición no tiene huecos', () => {
    expect(rankingHuerfanos(filas, { oposicion: 'opo_inexistente' })).toEqual([])
  })

  it('proponeLote acotado propone una ley de ESA oposición y mide impacto global', () => {
    const lote = proponeLote(filas, { oposicion: 'opo_b', maxArticulos: 4 })
    expect(['ley-x', 'ley-y']).toContain(lote.leySlug)
    expect(lote.impacto.temasAntes).toBe(3) // los 3 temas globales que disparan
  })
})
