const fs = require('fs')
const path = require('path')
const {
  UMBRALES,
  UMBRAL_BANDA_CIEGA,
  naturalezaArticulo,
  disparaFinding,
  disparaBandaCiega,
  temasQueDisparan,
  rankingHuerfanos,
  simulaCobertura,
  proponeLote,
  marcaEnCurso,
  usarDeudaCompleta,
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

  // 31/07/2026 — el contador de TEMAS no es una métrica de progreso, y esto lo fija.
  // Cubrir artículos de un tema mal cubierto lo empuja por encima del corte del 60% y lo hace
  // ENTRAR en el finding, aunque el trabajo haya mejorado el tema. Medido en producción con 31
  // preguntas sobre 10 artículos: 353 → 358 temas (8 entraron cruzando el 60% desde el 48-58%,
  // 3 salieron) mientras los ARTÍCULOS huérfanos bajaban 3.540 → 3.530, exactamente los 10
  // cubiertos. Quien mida la campaña por el número de temas concluirá que el trabajo no sirve.
  it('CUBRIR artículos puede hacer que un tema ENTRE en el finding (no es un bug)', () => {
    // 28/55 = 50,9% → por debajo del corte, es `low_coverage`: no cuenta.
    expect(disparaFinding({ n: 55, cubiertos: 28 })).toBe(false)
    // se cubren 6 artículos → 34/55 = 61,8%, cruza el 60% y aún le quedan 21 huecos: entra.
    expect(disparaFinding({ n: 55, cubiertos: 34 })).toBe(true)
  })
})

// ── T-543: la banda que ni article_no_coverage ni low_coverage ven ──────────────
describe('disparaBandaCiega (umbrales del detector cobertura_banda_ciega)', () => {
  it('dispara con ≥4 huecos, cobertura <60% y preguntas dentro de la banda', () => {
    expect(disparaBandaCiega({ n: 20, cubiertos: 9, preguntas: 20 })).toBe(true) // 45%
  })

  it('NO dispara si la cobertura llega al 60%: eso es article_no_coverage, otro detector', () => {
    expect(disparaBandaCiega({ n: 10, cubiertos: 6, preguntas: 20 })).toBe(false)
  })

  it('NO dispara con menos de 4 huecos', () => {
    expect(disparaBandaCiega({ n: 10, cubiertos: 7, preguntas: 20 })).toBe(false) // 3 huecos
  })

  it('NO dispara en temas de menos de 4 artículos', () => {
    expect(disparaBandaCiega({ n: 3, cubiertos: 0, preguntas: 20 })).toBe(false)
  })

  it('NO dispara por debajo de 6 preguntas: eso ya lo caza low_coverage', () => {
    expect(disparaBandaCiega({ n: 20, cubiertos: 9, preguntas: 5 })).toBe(false)
  })

  it('NO dispara por encima del techo calibrado: con tantas preguntas no se nota al estudiar', () => {
    expect(disparaBandaCiega({ n: 20, cubiertos: 9, preguntas: 51 })).toBe(false)
    expect(disparaBandaCiega({ n: 20, cubiertos: 9, preguntas: 287 })).toBe(false) // caso real medido
  })

  it('SÍ dispara en los dos extremos de la banda calibrada (6 y 50 incluidos)', () => {
    expect(disparaBandaCiega({ n: 20, cubiertos: 9, preguntas: UMBRAL_BANDA_CIEGA.minPreguntas })).toBe(true)
    expect(disparaBandaCiega({ n: 20, cubiertos: 9, preguntas: UMBRAL_BANDA_CIEGA.maxPreguntas })).toBe(true)
  })

  it('el tema entero cubierto no dispara', () => {
    expect(disparaBandaCiega({ n: 10, cubiertos: 10, preguntas: 20 })).toBe(false)
  })

  // Caso real medido el 05/08/2026 contra RDS: auxiliar_administrativo_universidad_alcala T16.
  it('caso real: 6/20 artículos (30%) y 6 preguntas — el más doloroso de la banda', () => {
    expect(disparaBandaCiega({ n: 20, cubiertos: 6, preguntas: 6 })).toBe(true)
  })
})

describe('usarDeudaCompleta (T-543 — --oposicion no puede depender del finding)', () => {
  it('sin --deuda ni --oposicion, se acota a lo que mueve el badge', () => {
    expect(usarDeudaCompleta({})).toBe(false)
  })

  it('--deuda pide deuda completa aunque no haya oposición', () => {
    expect(usarDeudaCompleta({ deudaPedida: true })).toBe(true)
  })

  it('--oposicion IMPLICA deuda completa aunque no se pida --deuda explícitamente', () => {
    expect(usarDeudaCompleta({ oposicion: 'subalterno_gva' })).toBe(true)
  })

  it('--oposicion --deuda sigue siendo deuda completa (idempotente)', () => {
    expect(usarDeudaCompleta({ deudaPedida: true, oposicion: 'subalterno_gva' })).toBe(true)
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

// ── GUARDARRAÍL: cobertura_banda_ciega es un ESPEJO del sweep (T-543) ────────
// Mismo patrón que el bloque anterior: si alguien recalibra el detector en el backend
// y no toca este lib (o al revés), el badge y `huerfanos:plan` dejan de estar de acuerdo
// sobre qué tema está en la banda ciega.
describe('paridad con el detector cobertura_banda_ciega', () => {
  const SERVICE = path.join(__dirname, '../../../backend/src/content-health-sweep/content-health-sweep.service.ts')
  const SCRIPT = path.join(__dirname, '../../../scripts/health-sweep.cjs')

  it('el umbral de huecos/artículos/cobertura del backend sigue siendo el del lib', () => {
    const src = fs.readFileSync(SERVICE, 'utf8')
    const marker = src.indexOf("'cobertura_banda_ciega'")
    expect(marker).toBeGreaterThan(-1)
    const bloque = src.slice(Math.max(0, marker - 3500), marker)
    const having = bloque.slice(bloque.indexOf('HAVING count(*) >='))

    expect(having).toContain(`HAVING count(*) >= ${UMBRALES.minArticulos}`)
    expect(having).toMatch(new RegExp(`count\\(\\*\\) - count\\(\\*\\) FILTER[\\s\\S]*?>= ${UMBRALES.minHuecos}`))
    expect(having).toMatch(new RegExp(`/ count\\(\\*\\) < ${UMBRALES.minCobertura}`))
  })

  it('el rango de preguntas del backend coincide con UMBRAL_BANDA_CIEGA', () => {
    const src = fs.readFileSync(SERVICE, 'utf8')
    expect(src).toContain(`WHERE q.preguntas BETWEEN ${UMBRAL_BANDA_CIEGA.minPreguntas} AND ${UMBRAL_BANDA_CIEGA.maxPreguntas}`)
  })

  it('el rango de preguntas del CLI (gemelo) coincide con UMBRAL_BANDA_CIEGA', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8')
    expect(src).toContain('WHERE q.preguntas BETWEEN ${UMBRAL_BANDA_CIEGA.minPreguntas} AND ${UMBRAL_BANDA_CIEGA.maxPreguntas}')
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

// ── T-146: artículos con numeración NO numérica (invisibles al detector) ──────
describe('naturalezaArticulo', () => {
  it('clasifica el entero puro como ordinario y numerado', () => {
    expect(naturalezaArticulo('10')).toEqual({ tipo: 'ordinario', numerado: true, esReforma: false })
    expect(naturalezaArticulo(0).tipo).toBe('ordinario') // art. 0 = "estructura de la norma"
    expect(naturalezaArticulo('00').numerado).toBe(true)
  })

  it('reconoce la familia de REFORMA con y sin espacio, y con tilde', () => {
    // Los tres estilos existen de verdad en la BD: "6bis" (Ley 19/2013),
    // "127 bis" (CP) y "367 quáter" (LECrim).
    for (const n of ['6bis', '127 bis', '70 ter', '367 quáter', '367 quater', '127 quinquies', '127 octies']) {
      const r = naturalezaArticulo(n)
      expect([n, r.tipo]).toEqual([n, 'reforma'])
      expect(r.esReforma).toBe(true)
      expect(r.numerado).toBe(false) // por eso el detector no los ve
    }
  })

  it('NO confunde una disposición con un artículo de reforma por la subcadena', () => {
    // "DAtrigésima" contiene "ter"... si se buscase la subcadena en vez de parsear
    // el número, una disposición adicional entraría en la familia de reforma y se
    // colaría en el badge. Este test es el que impide ese atajo.
    expect(naturalezaArticulo('DAtrigésima').tipo).toBe('adicional')
    expect(naturalezaArticulo('DAtrigésima').esReforma).toBe(false)
  })

  it('separa las disposiciones por clase', () => {
    expect(naturalezaArticulo('DA1').tipo).toBe('adicional')
    expect(naturalezaArticulo('DA_adicional_cuarta').tipo).toBe('adicional')
    expect(naturalezaArticulo('DT2').tipo).toBe('transitoria')
    expect(naturalezaArticulo('DF10').tipo).toBe('final')
    expect(naturalezaArticulo('DDunica').tipo).toBe('derogatoria')
  })

  it('trata "301.1" como apartado y lo demás como otro', () => {
    expect(naturalezaArticulo('301.1').tipo).toBe('apartado')
    expect(naturalezaArticulo('A.1.1').tipo).toBe('otro')
    expect(naturalezaArticulo('General').tipo).toBe('otro')
    expect(naturalezaArticulo('Compromiso8').tipo).toBe('otro')
    expect(naturalezaArticulo('preámbulo').tipo).toBe('otro')
    expect(naturalezaArticulo('').tipo).toBe('otro')
  })
})

describe('fidelidad del espejo con filas no numeradas', () => {
  // Un tema que dispara por sus artículos numerados, MÁS artículos "bis" (que desde el 29/07 SÍ
  // cuentan) y disposiciones (que siguen sin contar).
  // 20 artículos con 16 cubiertos (80%): así, al sumar 4 `bis` huérfanos, el tema SIGUE por
  // encima del 60% de cobertura y el detector lo mantiene. Con el fixture anterior (10/6) los
  // `bis` lo hundían al 43% y el tema se iba a `low_coverage` — comportamiento correcto pero
  // otra pregunta, que se fija aparte más abajo.
  const numerados = tema({ pt: 'opo_a', topicId: 't1', n: 20, cubiertos: 16 })
  const bis = ['24 bis', '70 bis', '70 ter', '103 bis'].map((articulo) => ({
    pt: 'opo_a', topicId: 't1', tema: 1, leySlug: 'ley-x', ley: 'Ley X', articulo, cubierto: false, numerado: false,
  }))
  const disposiciones = ['DA 3', 'DT 2', 'DF7', 'DD única'].map((articulo) => ({
    pt: 'opo_a', topicId: 't1', tema: 1, leySlug: 'ley-x', ley: 'Ley X', articulo, cubierto: false, numerado: false,
  }))

  it('EL ARREGLO (T-146): los `bis` YA cuentan para el veredicto del badge', () => {
    // Antes del 29/07 se descartaban, así que un tema podía darse por cubierto con sus
    // artículos de reforma sirviendo cero preguntas — que es justo donde vive el Derecho nuevo.
    const antes = temasQueDisparan(numerados)
    const despues = temasQueDisparan([...numerados, ...bis])
    expect(despues[0].n).toBe(antes[0].n + bis.length)
    expect(despues[0].huecos).toEqual(expect.arrayContaining(['ley-x#24 bis', 'ley-x#70 ter']))
  })

  it('las DISPOSICIONES siguen sin cambiar el veredicto (universo idéntico al del detector)', () => {
    // La garantía que hace honesto al test de paridad: el planificador evalúa el finding sobre
    // EXACTAMENTE el universo que ve el detector del backend, ni uno más.
    const antes = temasQueDisparan(numerados)
    const despues = temasQueDisparan([...numerados, ...disposiciones])
    expect(despues.map((t) => t.topicId)).toEqual(antes.map((t) => t.topicId))
    expect(despues[0].n).toBe(antes[0].n)
    expect(despues[0].huecos).toEqual(antes[0].huecos)
  })

  it('el ranking enseña los `bis` por defecto y las disposiciones solo si se piden', () => {
    const filas = [...numerados, ...bis, ...disposiciones]
    const arts = (r) => r.map((a) => a.articulo)
    expect(arts(rankingHuerfanos(filas))).toContain('24 bis')
    expect(arts(rankingHuerfanos(filas))).not.toContain('DF7')
    const conInvisibles = rankingHuerfanos(filas, { incluirNoNumerados: true })
    expect(arts(conInvisibles)).toContain('DF7')
    expect(conInvisibles.find((a) => a.articulo === '24 bis').tipo).toBe('reforma')
  })

  it('si los `bis` hunden la cobertura por debajo del 60%, el tema SALE de este detector', () => {
    // No es un fallo: la partición con `low_coverage` es deliberada — `article_no_coverage` es
    // para temas MAYORMENTE cubiertos con huecos puntuales. Al ampliar el universo, algunos
    // temas cruzan esa frontera y los recoge el otro detector. Conviene saberlo al leer el
    // badge: un tema que "desaparece" de aquí no está arreglado.
    const flojo = tema({ pt: 'opo_b', topicId: 't2', n: 10, cubiertos: 6 }) // 60% justo
    expect(temasQueDisparan(flojo).map((t) => t.topicId)).toEqual(['t2'])
    const conBis = temasQueDisparan([...flojo, ...bis.map((b) => ({ ...b, pt: 'opo_b', topicId: 't2' }))])
    expect(conBis).toEqual([]) // 6/14 = 43% → ya no es "mayormente cubierto"
  })

  it('`tipos` acota a la familia que interesa cubrir', () => {
    const filas = [...numerados, ...bis, {
      pt: 'opo_a', topicId: 't1', tema: 1, leySlug: 'ley-x', ley: 'Ley X', articulo: 'DF7', cubierto: false, numerado: false,
    }]
    const r = rankingHuerfanos(filas, { incluirNoNumerados: true, tipos: ['reforma'] })
    expect(r.every((a) => a.tipo === 'reforma')).toBe(true)
    expect(r.map((a) => a.articulo)).not.toContain('DF7')
  })

  it('una simulación NO puede apagar el tema dejando los `bis` a cero (era el engaño de la ficha)', () => {
    // Antes: cubrir los 4 huecos numerados apagaba el badge aunque los 4 "bis" siguieran a
    // cero. Ahora cuentan, así que el tema sigue encendido — que es la verdad.
    const filas = [...numerados, ...bis]
    const imp = simulaCobertura(filas, [17, 18, 19, 20].map((articulo) => ({ leySlug: 'ley-x', articulo: String(articulo) })))
    expect(imp.temasDespues).toBe(1)
  })

  it('y se apaga cuando se cubren TAMBIÉN los `bis`', () => {
    const filas = [...numerados, ...bis]
    const cubre = [...[17, 18, 19, 20].map((a) => ({ leySlug: 'ley-x', articulo: String(a) })),
                   ...bis.map((b) => ({ leySlug: 'ley-x', articulo: b.articulo }))]
    expect(simulaCobertura(filas, cubre).temasDespues).toBe(0)
  })
})

describe('artículos con nota de vigencia (T-151)', () => {
  // cubiertos=7 sobre 10: al sumar la fila con nota quedan 11 arts y 7 cubiertos
  // (0,64 ≥ 0,6 y 4 huecos), así que el tema sigue disparando y el artículo entra al ranking.
  const base = tema({ pt: 'opo_a', topicId: 't1', n: 10, cubiertos: 7 })
  const conNota = { pt: 'opo_a', topicId: 't1', tema: 1, leySlug: 'ley-x', ley: 'Ley X', articulo: '99', cubierto: false, conNotaVigencia: true }

  it('el ranking lo MARCA, no lo oculta: el juicio es de quien genera', () => {
    const r = rankingHuerfanos([...base, conNota])
    const a = r.find((x) => x.articulo === '99')
    expect(a).toBeDefined()
    expect(a.conNotaVigencia).toBe(true)
  })

  it('proponeLote NO lo propone: generar sobre un precepto anulado enseña Derecho inoperante', () => {
    // Caso raíz: el art. 87 ter de la LJCA salió el PRIMERO del ranking justo después de
    // marcarlo como no generable, porque su objeto son dos apartados anulados por el TC.
    const soloConNota = [conNota, { ...conNota, articulo: '98' }, { ...conNota, articulo: '97' }, { ...conNota, articulo: '96' }]
    const lote = proponeLote([...tema({ pt: 'opo_b', topicId: 't9', n: 10, cubiertos: 6 }), ...soloConNota])
    expect(lote.articulos.every((a) => a.articulo !== '99')).toBe(true)
  })
})
