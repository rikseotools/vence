// __tests__/lib/proportionalTopicVsArticle.test.ts
//
// Bug 15/05/2026 (caso Nila): test aleatorio "ambos bloques" devolvía
// 94% Bloque I / 6% Bloque II, porque `selectProportionallyByArticle`
// se ejecutaba DESPUÉS de `selectProportionally` y rehacía la selección
// por artículo único — y Bloque I tiene 6x más artículos que Bloque II,
// así que ganaba el round-robin.
//
// Fix: skipear `selectProportionallyByArticle` cuando `proportionalByTopic`
// está activo y hay multi-topic.

import {
  selectProportionally,
  selectProportionallyByArticle,
} from '@/lib/api/filtered-questions/queries'

type Q = {
  id: string
  articleNumber: string
  lawShortName: string
  sourceTopic: number | null
}

/**
 * Genera un pool simulando el catálogo real: Bloque I con MUCHOS más
 * artículos únicos que Bloque II (proporción ~6:1, como BD real).
 */
function buildPool(): Q[] {
  const pool: Q[] = []
  // Bloque I: 16 topics × 60 artículos × 3 preguntas/artículo = 2880 preguntas
  for (let t = 1; t <= 16; t++) {
    for (let a = 1; a <= 60; a++) {
      for (let n = 0; n < 3; n++) {
        pool.push({
          id: `B1-T${t}-A${a}-Q${n}`,
          articleNumber: String(a),
          lawShortName: `LawB1-${t}`,
          sourceTopic: t,
        })
      }
    }
  }
  // Bloque II: 12 topics × 10 artículos × 3 preguntas/artículo = 360 preguntas
  for (let t = 101; t <= 112; t++) {
    for (let a = 1; a <= 10; a++) {
      for (let n = 0; n < 3; n++) {
        pool.push({
          id: `B2-T${t}-A${a}-Q${n}`,
          articleNumber: String(a),
          lawShortName: `LawB2-${t}`,
          sourceTopic: t,
        })
      }
    }
  }
  return pool
}

describe('Distribución proporcional por topic — caso multi-bloque', () => {
  const pool = buildPool()
  const allTopics = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,101,102,103,104,105,106,107,108,109,110,111,112]

  it('selectProportionally reparte equitativamente entre los 28 topics', () => {
    const result = selectProportionally(pool, allTopics, 100)
    const byTopic: Record<number, number> = {}
    for (const q of result) {
      const t = q.sourceTopic ?? 0
      byTopic[t] = (byTopic[t] || 0) + 1
    }

    const bI = Object.entries(byTopic).filter(([t]) => Number(t) <= 16).reduce((s, [, v]) => s + v, 0)
    const bII = Object.entries(byTopic).filter(([t]) => Number(t) >= 101).reduce((s, [, v]) => s + v, 0)
    expect(bI + bII).toBe(100)
    // 16 topics × 4 = 64, 12 topics × 3 = 36 — Hamilton exacto
    expect(bI).toBeGreaterThanOrEqual(56)
    expect(bI).toBeLessThanOrEqual(72)
    expect(bII).toBeGreaterThanOrEqual(28)
    expect(bII).toBeLessThanOrEqual(44)
    // Cada topic debe tener al menos 3 preguntas (no quedar a cero)
    for (const t of allTopics) {
      expect((byTopic[t] || 0)).toBeGreaterThanOrEqual(3)
    }
  })

  it('selectProportionallyByArticle aplicado DESPUÉS rompe el balance (regresión)', () => {
    // Esto reproduce el bug original. selectProportionallyByArticle se ejecuta
    // sobre el pool entero, y como Bloque I tiene 16×60=960 artículos vs
    // Bloque II 12×10=120 (ratio 8:1), el round-robin favorece masivamente
    // al Bloque I.
    const balanced = selectProportionally(pool, allTopics, 100)
    const rebalanced = selectProportionallyByArticle(balanced, pool, 100, { log: false })

    const byBlock = { I: 0, II: 0 }
    for (const q of rebalanced) {
      const t = q.sourceTopic ?? 0
      if (t <= 16) byBlock.I++
      else if (t >= 101) byBlock.II++
    }
    // El bug original: Bloque II queda con muy poco (típicamente <20%)
    // Documenta el comportamiento que justifica el skip — si esto cambiase,
    // habría que revisar la lógica del fix.
    expect(byBlock.I).toBeGreaterThan(byBlock.II * 2)
  })
})
