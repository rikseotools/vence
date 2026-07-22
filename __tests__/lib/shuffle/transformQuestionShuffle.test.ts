/**
 * @jest-environment node
 */
// Test de la lógica de barajado DENTRO de transformQuestion (serve), con la función
// REAL de producción y filas sintéticas (sin BD → corre en CI). Entorno node porque
// importar transformQuestion arrastra el driver postgres.js (@/db/client).
//
// Cubre el bug latente que cazó la revisión adversarial: cuando la opción correcta NO
// está entre las presentes (hueco NO final: p.ej. C vacía con correct_option=3), el
// bail-out debe servir NATURAL intacto, no opciones permutadas con la clave descolocada.

import { transformQuestion } from '@/lib/api/filtered-questions/queries'
import { isValidOrder, displayedToOriginal } from '@/lib/shuffle/permute'

// Fila mínima con el shape que lee transformQuestion (el resto usa fallbacks).
const row = (over: Record<string, unknown>): any => ({
  id: '11111111-1111-1111-1111-111111111111',
  questionText: '¿Pregunta?',
  optionA: 'Alfa',
  optionB: 'Bravo',
  optionC: 'Charlie',
  optionD: 'Delta',
  optionE: null,
  explanation: 'Explicación sin citar letras de opción.',
  correctOption: 0,
  shuffleMode: 'full',
  primaryArticleId: '22222222-2222-2222-2222-222222222222',
  sourceTopic: null,
  ...over,
})

describe('transformQuestion — barajado eligible', () => {
  it('permuta, adjunta option_order válido y preserva la opción correcta', () => {
    const natural = ['Alfa', 'Bravo', 'Charlie', 'Delta']
    // Varias exposiciones (nonce aleatorio interno) para no depender de una permutación.
    let sawReorder = false
    for (let i = 0; i < 30; i++) {
      const out = transformQuestion(row({ correctOption: 2 }), i, true) as any
      expect(isValidOrder(out.option_order, 4)).toBe(true)
      // multiset intacto
      expect([...out.options].sort()).toEqual([...natural].sort())
      // options[i] === natural[order[i]]
      out.options.forEach((opt: string, pos: number) => {
        expect(opt).toBe(natural[out.option_order[pos]])
      })
      // la correcta original (Charlie=idx2) se muestra en correct_option remapeado
      expect(out.options[out.correct_option]).toBe('Charlie')
      expect(displayedToOriginal(out.option_order, out.correct_option)).toBe(2)
      if (out.option_order.some((v: number, idx: number) => v !== idx)) sawReorder = true
    }
    expect(sawReorder).toBe(true)
  })
})

describe('transformQuestion — bail-out seguro (bug de la revisión adversarial)', () => {
  it('correcta en hueco NO presente → sirve NATURAL intacto (no permuta con clave descolocada)', () => {
    // C vacía → naturalOptions = [Alfa, Bravo, Delta] (n=3), pero correct_option=3 (Delta
    // en columna DB). order.indexOf(3) === -1 → NO debe barajar.
    for (let i = 0; i < 20; i++) {
      const out = transformQuestion(row({ optionC: null, correctOption: 3 }), i, true) as any
      expect(out.options).toEqual(['Alfa', 'Bravo', 'Delta'])
      expect(out.correct_option).toBe(3) // original, sin remapear
      expect(out.option_order ?? null).toBeNull() // señala "no barajado" — coherente con las opciones
    }
  })
})

describe('transformQuestion — no elegibles y flag off', () => {
  it('shuffle_mode no_shuffle → natural aunque shuffle=true', () => {
    const out = transformQuestion(row({ shuffleMode: 'no_shuffle', correctOption: 1 }), 0, true) as any
    expect(out.options).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta'])
    expect(out.correct_option).toBe(1)
    expect(out.option_order ?? null).toBeNull()
  })

  it('explicación que cita letras → natural (letra-anclada, espera Fase 2)', () => {
    const out = transformQuestion(
      row({ explanation: 'La opción A es correcta porque...', correctOption: 0 }),
      0,
      true,
    ) as any
    expect(out.options).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta'])
    expect(out.option_order ?? null).toBeNull()
  })

  it('shuffle=false → natural, byte-idéntico (flag off, retrocompat)', () => {
    const out = transformQuestion(row({ correctOption: 2 }), 0, false) as any
    expect(out.options).toEqual(['Alfa', 'Bravo', 'Charlie', 'Delta'])
    expect(out.correct_option).toBe(2)
    expect(out.option_order ?? null).toBeNull()
  })
})
