// Simulación del negativo #1 (40cc425e, 04/06/2026)
//
// CASO ORIGINAL: usuario en pregunta "NO constituye objeto de la Ley 39/2015"
// (correcta = D). Pulsó "Explícame" 3 veces y luego escribió "no". El sistema
// repitió la MISMA explicación → 👎.
//
// Dos fallos: (A) el historial llegaba al LLM con los turnos assistant VACÍOS
// (race de streaming en AIChatWidget) y (B) el prompt legal no tenía regla para
// follow-ups de duda/desacuerdo ("no") → reexplicaba igual.
//
// Este script simula el flujo CON el historial correcto (Fix A) y el prompt
// nuevo (Fix B). Verifica:
//   1. ROUTING: "no" sigue capturado por VerificationDomain.
//   2. END-TO-END: la respuesta al "no" NO es un calco de la anterior y cambia
//      de enfoque (idealmente distinguiendo B vs D / 39 vs 40).
import 'dotenv/config'
import { getVerificationDomain } from '../lib/chat/domains/verification/VerificationDomain'
import type { ChatContext, ChatMessage } from '../lib/chat/core/types'

const QUESTION_TEXT = 'NO constituye objeto de la Ley 39/2015, de 1 de octubre, del Procedimiento Administrativo Común:'
const OPTIONS = [
  'Los requisitos de validez y eficacia de los actos administrativos.',
  'El procedimiento administrativo común a todas las Administraciones Públicas, incluyendo el sancionador y el de reclamación de responsabilidad de las Administraciones Públicas.',
  'Los principios a los que se ha de ajustar el ejercicio de la iniciativa legislativa y la potestad reglamentaria.',
  'Los principios del sistema de responsabilidad de las Administraciones Públicas.',
]
const CORRECT = 3 // D

// Respuesta real que la IA dio (resumida) en los 3 "Explícame" previos.
const PRIOR_ASSISTANT = `✅ La respuesta correcta es la D) Los principios del sistema de responsabilidad de las Administraciones Públicas.

📖 Según el artículo 1 de la Ley 39/2015, el objeto de esta ley es regular los requisitos de validez y eficacia de los actos administrativos, el procedimiento administrativo común (incluido el sancionador y el de reclamación de responsabilidad), y los principios de la iniciativa legislativa y la potestad reglamentaria.

💡 Sin embargo, NO regula los principios del sistema de responsabilidad de las AAPP: eso está en la Ley 40/2015.`

function buildContext(message: string, history: ChatMessage[]): ChatContext {
  return {
    request: { messages: [{ role: 'user', content: message }], isPremium: false },
    userId: '4b735f8b-6948-46b6-a492-b03a50b8814c',
    userDomain: 'auxiliar_administrativo_valencia',
    isPremium: false,
    questionContext: {
      id: '01e74455-07c2-458b-aa73-52c83b44a0eb',
      questionId: '01e74455-07c2-458b-aa73-52c83b44a0eb',
      questionText: QUESTION_TEXT,
      options: OPTIONS,
      correctAnswer: CORRECT,
      selectedAnswer: null,
      lawName: 'Ley 39/2015',
      articleNumber: '1',
    },
    messages: history,
    currentMessage: message,
    startTime: Date.now(),
  }
}

function jaccard(a: string, b: string): number {
  const norm = (s: string) => new Set(s.toLowerCase().replace(/[^a-záéíóúñü0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3))
  const A = norm(a), B = norm(b)
  const inter = [...A].filter(w => B.has(w)).length
  const union = new Set([...A, ...B]).size
  return union ? inter / union : 0
}

async function main() {
  const vd = getVerificationDomain()

  // Historial CON contenido del assistant (lo que Fix A garantiza). El último
  // turno es el "no" del usuario.
  const history: ChatMessage[] = [
    { role: 'user', content: `Explícame por qué la respuesta correcta es "D" en la pregunta: "${QUESTION_TEXT}"` },
    { role: 'assistant', content: PRIOR_ASSISTANT },
    { role: 'user', content: 'no' },
  ]

  const ctx = buildContext('no', history)

  console.log('='.repeat(72))
  console.log('SIMULACIÓN negativo #1 — follow-up "no" tras explicación')
  console.log('='.repeat(72))

  // 1. ROUTING
  const canHandle = await vd.canHandle(ctx)
  console.log('\n[1] ROUTING → VerificationDomain.canHandle("no") =', canHandle, canHandle ? '✅' : '❌ (debería ser true)')

  // 2. END-TO-END
  console.log('\n[2] END-TO-END (LLM real)…')
  const resp = await vd.handle(ctx)
  const text = (resp && (resp as any).content) || ''
  console.log('\n--- RESPUESTA AL "no" ---\n' + text)

  // 3. CHEQUEOS
  const sim = jaccard(text, PRIOR_ASSISTANT)
  const mentions40 = /40\/2015/.test(text)
  const distinguishes = /reclamaci[oó]n/i.test(text) && /principios/i.test(text)
  console.log('\n' + '='.repeat(72))
  console.log('CHEQUEOS')
  console.log('='.repeat(72))
  console.log('Jaccard vs explicación anterior:', sim.toFixed(2), sim < 0.6 ? '✅ (cambió de enfoque)' : '❌ (demasiado parecida — repite)')
  console.log('Menciona Ley 40/2015 (clave B vs D):', mentions40 ? '✅' : '⚠️')
  console.log('Distingue reclamación vs principios:', distinguishes ? '✅' : '⚠️')
}

main().catch(e => { console.error('ERR:', e?.stack || e); process.exit(1) })
