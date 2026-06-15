// E2E del negativo TCAE Galicia (log 7f9dfc55, pregunta d6cbfcd7):
// el usuario pulsó "Explícame" 4× y recibió 3 veces la MISMA analogía de cocina
// ("imagina que eres ayudante en una cocina, el chef…") → 👎.
// Regla Manuel (15/06): el chat NUNCA usa analogías (infantil / no profesional).
// Tras reescribir buildRepeatExplanationPrompt, la re-explicación debe ser
// SUSTANTIVA (distingue dependiente vs autónoma, desglosa opciones) y SIN metáforas.
import 'dotenv/config'
import { getVerificationDomain } from '../lib/chat/domains/verification/VerificationDomain'
import type { ChatContext } from '../lib/chat/core/types'

const Q = {
  id: 'd6cbfcd7-a789-4040-9be6-04f73d3fd288',
  text: '¿Qué función cumple el TCAE al colaborar en tareas indicadas por enfermería?',
  options: ['Función docente.', 'Función dependiente.', 'Función administrativa.', 'Función autónoma.'],
  correct: 1, // B
}

function ctx(message: string, isRepeat: boolean): ChatContext {
  return {
    request: { messages: [{ role: 'user', content: message }], isPremium: false },
    userId: '2c9e3411-0000-0000-0000-000000000000',
    userDomain: 'tcae_galicia',
    isPremium: false,
    questionContext: {
      id: Q.id, questionId: Q.id, questionText: Q.text, options: Q.options,
      correctAnswer: Q.correct, selectedAnswer: null,
      lawName: 'Trabajo en equipo sanitario', articleNumber: '3',
    },
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
    isRepeatExplanation: isRepeat,
  } as ChatContext
}

// Detector de analogías / metáforas / lenguaje infantil
const ANALOGY = /\bimagina(te)?\b|haz de cuenta|piensa que eres|como si fueras?|es como (un|una|si|cuando)|al igual que|cocina|chef|restaurante|sous-?chef|equipo de f[uú]tbol|conducir un coche|ponte en el lugar/i

async function main() {
  const vd = getVerificationDomain()
  const msg = `Explícame por qué la respuesta correcta es "B" en la pregunta: "${Q.text}"`

  console.log('='.repeat(72))
  console.log('[B] RE-EXPLICACIÓN (isRepeat=true) — nuevo prompt sin analogías')
  console.log('='.repeat(72))
  const r = await vd.handle(ctx(msg, true))
  const t = (r as any)?.content || ''
  console.log(t)

  const hasAnalogy = ANALOGY.test(t)
  const substantive = /(dependiente|aut[oó]noma|supervisi[oó]n|delegad|propia|enfermer[ií]a)/i.test(t)
  const distinguishes = /(aut[oó]noma|docente|administrativa)/i.test(t) // contrasta con las incorrectas
  const confirmsB = /\bB\b|dependiente/i.test(t)

  console.log('\n' + '-'.repeat(40))
  console.log('  ❌ contiene analogía/metáfora:', hasAnalogy ? '🔴 SÍ (FALLO)' : '✅ NO')
  console.log('  ✓ sustantiva (conceptos reales):', substantive ? '✅' : '⚠️')
  console.log('  ✓ contrasta opciones incorrectas:', distinguishes ? '✅' : '⚠️')
  console.log('  ✓ confirma B:', confirmsB ? '✅' : '⚠️')
  console.log('\n  VEREDICTO:', !hasAnalogy && substantive && confirmsB ? '✅ PASA' : '🔴 REVISAR')
}

main().catch(e => { console.error(e); process.exit(1) })
