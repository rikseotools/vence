// Mock de dependencias pesadas que arrastra VerificationService
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }))
jest.mock('@/db/client', () => ({ getDb: jest.fn() }))
jest.mock('@/db/schema', () => ({}))
jest.mock('../../shared/openai', () => ({}), { virtual: true })
jest.mock('@/lib/chat/shared/openai', () => ({ getOpenAI: jest.fn(), CHAT_MODEL: 'test', CHAT_MODEL_PREMIUM: 'test' }))
jest.mock('@/lib/chat/shared/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }))
jest.mock('@/lib/chat/domains/search', () => ({
  searchArticles: jest.fn(),
  formatArticlesForContext: jest.fn(),
  detectLawsFromText: jest.fn(),
  extractArticleNumbers: jest.fn(),
  findArticleInLaw: jest.fn(),
}))
jest.mock('@/lib/chat/domains/verification/ErrorDetector', () => ({
  detectErrorInResponse: jest.fn(),
  analyzeQuestion: jest.fn(),
  generateVerificationContext: jest.fn(),
  formatQuestionForPrompt: jest.fn(),
}))
jest.mock('@/lib/chat/domains/verification/DisputeService', () => ({
  createAutoDispute: jest.fn(),
  generateDisputeConfirmationMessage: jest.fn(),
}))
jest.mock('@/lib/chat/domains/verification/queries', () => ({
  getLinkedArticle: jest.fn(),
  checkIsPsychometric: jest.fn(),
}))

import { detectUserComplaint } from '@/lib/chat/domains/verification/VerificationService'

describe('detectUserComplaint', () => {
  const shouldDetect = [
    'la pregunta está mal',
    'la respuesta está mal',
    'creo que la pregunta está mal',
    'Creo q la pregunta está mal',
    'la pregunta es incorrecta',
    'la respuesta es incorrecta',
    'estás equivocada',
    'estas equivocado',
    'no está en el artículo',
    'no esta textualmente en el articulo 27',
    'no me pongas preguntas que no estan en texto de la ley',
    'la respuesta de la app está mal',
    'pienso que estás equivocada',
    'Yo pienso q estás equivocada y es la X',
    'la app dice mal',
    'creo que estas equivocada',
    'la respuesta es errónea',
    'la pregunta es erronea',
  ]

  const shouldNotDetect = [
    'explícame la respuesta',
    'por qué es correcta',
    'no entiendo',
    'vale gracias',
    'ok',
    'y del tribunal constitucional?',
    'qué artículo regula esto',
    'cuáles son los plazos',
    'me puedes hacer un resumen',
    'Explícame por qué la respuesta correcta es "B"',
    'no se pq tendria que ser 9',
    'seguro?',
  ]

  it.each(shouldDetect)('detecta queja: "%s"', (msg) => {
    expect(detectUserComplaint(msg)).toBe(true)
  })

  it.each(shouldNotDetect)('NO detecta como queja: "%s"', (msg) => {
    expect(detectUserComplaint(msg)).toBe(false)
  })
})
