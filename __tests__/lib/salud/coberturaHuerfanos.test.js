const fs = require('fs')
const path = require('path')
const {
  UMBRALES,
  simularCobertura,
  rankearLeyes,
  rankearArticulos,
} = require('../../../lib/salud/coberturaHuerfanos')

// Fixture calcado del caso real que motivó el módulo (LPRL, 26/07/2026):
// un artículo compartido por muchas oposiciones vale mucho más que uno exclusivo.
//   - artA y artB son de la LPRL y salen en los 3 temas → alto reuso.
//   - artC..artF son de una ley autonómica y solo salen en T3.
const par = (pt, topic, art, ley, label) => ({
  position_type: pt,
  topic_id: topic,
  article_id: art,
  law_key: ley,
  label,
})

const PARES = [
  // T1 (oposición 1): 4 huérfanos → dispara el detector
  par('opo1', 'T1', 'artA', 'LPRL'),
  par('opo1', 'T1', 'artB', 'LPRL'),
  par('opo1', 'T1', 'artG', 'OTRA'),
  par('opo1', 'T1', 'artH', 'OTRA'),
  // T2 (oposición 2): solo los 2 de la LPRL
  par('opo2', 'T2', 'artA', 'LPRL'),
  par('opo2', 'T2', 'artB', 'LPRL'),
  // T3 (oposición 3): los 2 de la LPRL + 4 de la ley autonómica
  par('opo3', 'T3', 'artA', 'LPRL'),
  par('opo3', 'T3', 'artB', 'LPRL'),
  par('opo3', 'T3', 'artC', 'AUTONOMICA'),
  par('opo3', 'T3', 'artD', 'AUTONOMICA'),
  par('opo3', 'T3', 'artE', 'AUTONOMICA'),
  par('opo3', 'T3', 'artF', 'AUTONOMICA'),
]

describe('simularCobertura', () => {
  it('sin cubrir nada, ningún tema está a cero', () => {
    expect(simularCobertura(PARES, []).temasACero).toBe(0)
  })

  it('no cuenta como cerrada una oposición que nunca disparaba (línea base)', () => {
    // T2 solo tiene 2 huérfanos → está por debajo del umbral y NO genera
    // hallazgo. Sin cubrir nada, los hallazgos cerrados tienen que ser 0.
    expect(simularCobertura(PARES, []).findingsCerrados).toBe(0)
    expect(simularCobertura(PARES, []).temasBajoUmbral).toBe(1) // T2, que ya lo estaba
  })

  it('cubrir los 2 artículos compartidos deja T2 a cero y apaga el hallazgo de opo1', () => {
    const r = simularCobertura(PARES, ['artA', 'artB'])
    expect(r.temasACero).toBe(1) // T2 solo tenía esos dos
    // T1 baja a 2 huérfanos y T3 a 4: T1 deja de disparar, T3 sigue.
    expect(r.temasBajoUmbral).toBe(2)
    expect(r.findingsCerrados).toBe(1) // solo opo1: opo2 no disparaba y opo3 sigue
  })

  it('distingue "a cero" de "bajo umbral" — no confunde arreglar con maquillar', () => {
    // Cubrir un solo artículo de T1 lo deja en 3 huérfanos: apaga el hallazgo
    // SIN haber arreglado el tema. El módulo tiene que separar las dos cosas.
    const r = simularCobertura(PARES, ['artG'])
    expect(r.temasACero).toBe(0)
    expect(r.temasBajoUmbral).toBe(2) // T1 (3 restantes) y T2 (2 restantes)
  })

  it('cubrirlo todo cierra todos los temas y todos los hallazgos', () => {
    const todos = [...new Set(PARES.map((p) => p.article_id))]
    const r = simularCobertura(PARES, todos)
    // 3 temas a cero, pero solo 2 hallazgos: opo2 nunca tuvo uno que cerrar.
    expect(r).toMatchObject({ temasACero: 3, findingsCerrados: 2 })
  })

  it('acepta Set o array indistintamente', () => {
    expect(simularCobertura(PARES, new Set(['artA', 'artB']))).toEqual(simularCobertura(PARES, ['artA', 'artB']))
  })
})

describe('rankearLeyes', () => {
  const ranking = rankearLeyes(PARES)

  it('pone primero la ley más rentable, no la que tiene más artículos', () => {
    // AUTONOMICA tiene el doble de artículos (4 vs 2) pero solo cierra T3.
    // LPRL, con 2, cierra T2 → mejor ratio. Ese es justo el error que evita.
    expect(ranking[0].ley).toBe('LPRL')
    expect(ranking[0].ratio).toBeGreaterThan(ranking.find((r) => r.ley === 'AUTONOMICA').ratio)
  })

  it('calcula el ratio como temas cerrados por artículo escrito', () => {
    const lprl = ranking.find((r) => r.ley === 'LPRL')
    expect(lprl).toMatchObject({ articulos: 2, temasACero: 1, ratio: 0.5 })
  })

  it('la ley exclusiva NO cierra su tema sola: quedan los artículos compartidos', () => {
    // Cubrir los 4 de AUTONOMICA deja T3 con artA y artB aún huérfanos → 0 temas
    // a cero pese a ser el doble de trabajo. Es exactamente la trampa que este
    // ranking evita: "la ley con más huecos" no es "la ley que más cierra".
    const auto = ranking.find((r) => r.ley === 'AUTONOMICA')
    expect(auto).toMatchObject({ articulos: 4, temasACero: 0, ratio: 0 })
  })
})

describe('rankearArticulos', () => {
  it('ordena por número de temas que desbloquea', () => {
    const r = rankearArticulos(PARES)
    expect(r[0].temas).toBe(3)
    expect(['artA', 'artB']).toContain(r[0].articleId)
    expect(r[0].oposiciones).toBe(3)
  })

  it('un artículo exclusivo queda al final', () => {
    const r = rankearArticulos(PARES)
    expect(r[r.length - 1].temas).toBe(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GUARDARRAÍL — este módulo prioriza sobre el MISMO universo que el detector que
// alimenta el badge. Si allí mueven un umbral y aquí no, el ranking ordenaría
// sobre un universo que ya nadie mide, y nadie se enteraría: el ranking seguiría
// pareciendo razonable. Se comparan contra el texto del writer real.
// ─────────────────────────────────────────────────────────────────────────────
describe('paridad de umbrales con el detector article_no_coverage', () => {
  const BACKEND = fs.readFileSync(
    path.resolve(__dirname, '../../../backend/src/content-health-sweep/content-health-sweep.service.ts'),
    'utf8',
  )
  // Bloque del detector: desde su SELECT hasta el add(...) del kind.
  const bloque = BACKEND.slice(
    BACKEND.indexOf('const sinPreg'),
    BACKEND.indexOf("'article_no_coverage'"),
  )

  it('el bloque del detector se localiza (si esto falla, el service se ha reescrito)', () => {
    expect(bloque.length).toBeGreaterThan(200)
    expect(bloque).toContain('HAVING')
  })

  it('mínimo de artículos por tema coincide', () => {
    expect(bloque).toContain(`count(*) >= ${UMBRALES.MIN_ARTS_TEMA}`)
  })

  it('umbral de cobertura mínima coincide', () => {
    expect(bloque).toContain(`>= ${UMBRALES.COBERTURA_MIN}`)
  })

  it('mínimo de huecos para disparar coincide', () => {
    expect(bloque).toContain(`>= ${UMBRALES.HUECOS_MIN}`)
  })
})
