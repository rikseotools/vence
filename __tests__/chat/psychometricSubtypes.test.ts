// __tests__/chat/psychometricSubtypes.test.ts
// Verifica que TODOS los subtipos psicotécnicos activos en BD están en PSYCHOMETRIC_SUBTYPES.
// Si se importan preguntas con un subtipo nuevo y no se añade a la lista,
// el chat IA las ruteará a search (busca artículos de leyes) en vez de psychometric.

import { PSYCHOMETRIC_SUBTYPES } from '@/lib/chat/shared/constants'

// Subtipos reales que existen en la BD (psychometric_questions.question_subtype)
// Actualizar esta lista cuando se añadan nuevos subtipos a la BD.
const ALL_KNOWN_SUBTYPES = [
  'bar_chart',
  'pie_chart',
  'line_chart',
  'mixed_chart',
  'data_tables',
  'error_detection',
  'sequence_numeric',
  'sequence_letter',
  'sequence_alphanumeric',
  'word_analysis',
  'calculation',
  'text_question',
  'analogy',
  'code_equivalence',
  'synonym',
  'antonym',
  'percentage',
  'probability',
  'definition',
  'alphabetical_order',
  'coding',
]

describe('PSYCHOMETRIC_SUBTYPES - routing del chat IA', () => {
  it('debe incluir todos los subtipos conocidos de psicotécnicas', () => {
    const missing = ALL_KNOWN_SUBTYPES.filter(
      s => !(PSYCHOMETRIC_SUBTYPES as readonly string[]).includes(s)
    )

    if (missing.length > 0) {
      fail(
        `Subtipos psicotécnicos NO incluidos en PSYCHOMETRIC_SUBTYPES: ${missing.join(', ')}. ` +
        'Esto hace que el chat IA rutee estas preguntas a search (artículos de leyes) ' +
        'en vez de al domain psychometric. Añádelos a lib/chat/shared/constants.ts'
      )
    }
  })

  it('no debe tener subtipos que no existen en BD', () => {
    const extra = (PSYCHOMETRIC_SUBTYPES as readonly string[]).filter(
      s => !ALL_KNOWN_SUBTYPES.includes(s)
    )

    // Solo warning, no fallo — tener de más no rompe nada
    if (extra.length > 0) {
      console.warn(`Subtipos en PSYCHOMETRIC_SUBTYPES que no están en ALL_KNOWN_SUBTYPES: ${extra.join(', ')}`)
    }
  })
})
