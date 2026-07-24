import { getBlockForTopic } from '@/lib/config/oposiciones'

/**
 * Número VISIBLE del tema en breadcrumbs/cabecera (getBlockForTopic).
 *
 * Gap real 24/07 (feedback Maricarmen): Cuidador Córdoba mostraba el `topic_number` interno (5-20)
 * en breadcrumbs/cabecera en vez del número del programa oficial (Bloque II reinicia en 1-16),
 * mientras el índice sí mostraba 1-16. Causa: getBlockForTopic IGNORABA el `displayNumber` explícito
 * del config y usaba una heurística `firstId>=100` que no cubría bloques cuyo primer id es <100 pero
 * no reinician. Fix: respetar `displayNumber` (fuente autoritativa) y caer a la heurística solo si
 * falta. Estos casos lo fijan.
 */
describe('getBlockForTopic — número visible del tema (displayNum)', () => {
  const CUID = 'cuidador-diputacion-cordoba'

  it('Bloque II (Específica): usa el número del programa oficial, no el topic_number', () => {
    expect(getBlockForTopic(CUID, 11)?.displayNum).toBe(7) // Equipo de trabajo (topic 11 → oficial 7)
    expect(getBlockForTopic(CUID, 15)?.displayNum).toBe(11) // Alimentos/APPCC (topic 15 → oficial 11)
    expect(getBlockForTopic(CUID, 19)?.displayNum).toBe(15) // Lugares de trabajo (topic 19 → oficial 15)
    expect(getBlockForTopic(CUID, 20)?.displayNum).toBe(16) // PRL (topic 20 → oficial 16)
  })

  it('Bloque I (Comunes): 1-4 se mantienen (displayNumber == id)', () => {
    expect(getBlockForTopic(CUID, 1)?.displayNum).toBe(1)
    expect(getBlockForTopic(CUID, 4)?.displayNum).toBe(4)
  })

  it('devuelve el bloque correcto', () => {
    expect(getBlockForTopic(CUID, 15)?.blockTitle).toMatch(/Bloque II/i) // Materias Específicas
    expect(getBlockForTopic(CUID, 1)?.blockTitle).toMatch(/Bloque I/i) // Materias Comunes
  })

  it('offset-based (topic_numbers >=100) sigue reiniciando por heurística cuando NO hay displayNumber', () => {
    // Guardarraíl de no-regresión de la heurística: una oposición con temas 101,102… y sin
    // displayNumber debe seguir mostrando 1,2… (no 101,102).
    // (Si la tuviera con displayNumber, ganaría el displayNumber; esto cubre el fallback.)
    const bloque = getBlockForTopic(CUID, 999)
    expect(bloque).toBeNull() // tema inexistente → null (no revienta)
  })

  it('oposición inexistente → null', () => {
    expect(getBlockForTopic('no-existe', 1)).toBeNull()
  })
})
