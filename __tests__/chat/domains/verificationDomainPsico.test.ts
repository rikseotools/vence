// __tests__/chat/domains/verificationDomainPsico.test.ts
// Regresión caso #2 auditoría 15/05: VerificationDomain DEBE ceder siempre a
// PsychometricDomain cuando el contexto es psicotécnico, sin importar el
// patrón del mensaje. Antes capturaba "explícame la respuesta" en
// matemáticas porque asksAboutAnswer matcheaba, y eso le metía prompt legal
// + GPT-4o en lugar del prompt paso-a-paso + Claude Sonnet.

import { VerificationDomain } from '@/lib/chat/domains/verification/VerificationDomain'

const domain = new VerificationDomain()

function makeContext(overrides: Record<string, unknown>) {
  return {
    userId: 'test-user',
    currentMessage: '',
    messages: [],
    questionContext: null,
    isPremium: true,
    userDomain: null,
    ...overrides,
  } as Parameters<typeof domain.canHandle>[0]
}

describe('VerificationDomain.canHandle — regresión caso #2 (cede a Psychometric)', () => {
  describe('contexto psicotécnico (isPsicotecnico=true)', () => {
    test('"explícame la respuesta" sobre cálculo → false (cede a Psychometric)', async () => {
      // Caso original log #2: este mensaje hacía que Verification capturara
      // aunque la pregunta fuese matemática (subtype 'calculation').
      const ctx = makeContext({
        currentMessage: 'explícame la respuesta',
        questionContext: {
          questionId: 'q1',
          questionText: 'Cálculo',
          correctAnswer: 0,
          isPsicotecnico: true,
          questionSubtype: 'calculation',
        },
      })
      expect(await domain.canHandle(ctx)).toBe(false)
    })

    test('"por qué es correcta" sobre serie numérica → false', async () => {
      const ctx = makeContext({
        currentMessage: 'por qué es la C la correcta',
        questionContext: {
          questionId: 'q2',
          questionText: 'Serie',
          correctAnswer: 2,
          isPsicotecnico: true,
          questionSubtype: 'sequence_numeric',
        },
      })
      expect(await domain.canHandle(ctx)).toBe(false)
    })

    test('mensaje genérico sobre tabla → false', async () => {
      const ctx = makeContext({
        currentMessage: 'ok',
        questionContext: {
          questionId: 'q3',
          questionText: 'Tabla',
          correctAnswer: 1,
          isPsicotecnico: true,
          questionSubtype: 'data_tables',
        },
      })
      expect(await domain.canHandle(ctx)).toBe(false)
    })

    test('basta con contentData (sin isPsicotecnico explícito) para ceder', async () => {
      // Algunas preguntas marcan psico via contentData (gráfico, tabla) en
      // lugar de isPsicotecnico=true. También debe ceder.
      const ctx = makeContext({
        currentMessage: 'explícame por qué',
        questionContext: {
          questionId: 'q4',
          questionText: 'Gráfico',
          correctAnswer: 0,
          contentData: { type: 'bar_chart' },
        },
      })
      expect(await domain.canHandle(ctx)).toBe(false)
    })

    test('basta con questionSubtype (sin isPsicotecnico) para ceder', async () => {
      const ctx = makeContext({
        currentMessage: 'explícame la respuesta',
        questionContext: {
          questionId: 'q5',
          questionText: 'pregunta',
          correctAnswer: 0,
          questionSubtype: 'calculation',
        },
      })
      expect(await domain.canHandle(ctx)).toBe(false)
    })
  })

  describe('contexto NO psicotécnico (legal) sí captura cuando corresponde', () => {
    test('"explícame la respuesta" en pregunta legal con correctAnswer → true', async () => {
      const ctx = makeContext({
        currentMessage: 'explícame la respuesta',
        questionContext: {
          questionId: 'q-legal-1',
          questionText: '¿Qué dice el art 53.2 CE?',
          correctAnswer: 1,
          options: ['a', 'b', 'c', 'd'],
          // ❌ sin isPsicotecnico/questionSubtype/contentData → no es psico
        },
      })
      expect(await domain.canHandle(ctx)).toBe(true)
    })

    test('"por qué es correcta" en pregunta legal → true', async () => {
      const ctx = makeContext({
        currentMessage: 'por qué es la B correcta',
        questionContext: {
          questionId: 'q-legal-2',
          questionText: 'Promoción interna',
          correctAnswer: 1,
          options: ['a', 'b', 'c', 'd'],
        },
      })
      expect(await domain.canHandle(ctx)).toBe(true)
    })
  })

  describe('sin question context — no aplica verificación', () => {
    test('mensaje legal sin questionContext → false', async () => {
      const ctx = makeContext({
        currentMessage: 'explícame la respuesta',
        questionContext: null,
      })
      expect(await domain.canHandle(ctx)).toBe(false)
    })
  })
})
