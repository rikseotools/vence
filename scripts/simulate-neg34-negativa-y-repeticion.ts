// Simulación de los negativos #3/#4 del chat IA:
//  - #4 (80496a64): pregunta NEGATIVA (CE art 10.2 "...no se interpretarán de
//    conformidad: A) La ley"). La explicación debe enmarcar el "NO".
//  - #3/#4: "Explícame" repetido daba explicación idéntica. Con la detección
//    server-side (context.isRepeatExplanation), el tutor debe VARIAR.
import 'dotenv/config'
import { getVerificationDomain } from '../lib/chat/domains/verification/VerificationDomain'
import type { ChatContext } from '../lib/chat/core/types'

const Q = {
  id: '41d8d789-4e6e-44d2-981f-40d96170fa7f',
  text: 'Según lo que dispone el artículo 10.2 de la Constitución Española, normas relativas a los derechos fundamentales y a las libertades que la Constitución reconoce, no se interpretarán de conformidad:',
  options: [
    'La ley.',
    'La Declaración Universal de Derechos Humanos.',
    'Los tratados internacionales sobre las mismas materias ratificadas por España.',
    'Los acuerdos internacionales sobre las mismas materias ratificados por España.',
  ],
  correct: 0, // A
}

function ctx(message: string, isRepeat: boolean): ChatContext {
  return {
    request: { messages: [{ role: 'user', content: message }], isPremium: false },
    userId: 'c0f3ad42-c7fc-4e19-b869-70374d99ad50',
    userDomain: 'auxiliar_administrativo_estado',
    isPremium: false,
    questionContext: {
      id: Q.id, questionId: Q.id, questionText: Q.text, options: Q.options,
      correctAnswer: Q.correct, selectedAnswer: null, lawName: 'CE', articleNumber: '10',
    },
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
    isRepeatExplanation: isRepeat,
  }
}

async function main() {
  const vd = getVerificationDomain()
  const msg = `Explícame por qué la respuesta correcta es "A" en la pregunta: "${Q.text.slice(0, 100)}..."`

  console.log('='.repeat(72))
  console.log('[A] PREGUNTA NEGATIVA (#4) — primera explicación (isRepeat=false)')
  console.log('='.repeat(72))
  const r1 = await vd.handle(ctx(msg, false))
  const t1 = (r1 as any)?.content || ''
  console.log(t1.slice(0, 1400))
  const flagsNegation = /\bno\b/i.test(t1) && /(negativ|pide la opci[oó]n que no|cuál no|única que no|no figura|no se menciona|no aparece)/i.test(t1)
  const confirmsA = /correcta es.*\bA\b|\bA\).*correcta|opci[oó]n A/i.test(t1)
  console.log('\n  ✓ enmarca la negación:', flagsNegation ? '✅' : '⚠️')
  console.log('  ✓ confirma A:', confirmsA ? '✅' : '⚠️')

  console.log('\n' + '='.repeat(72))
  console.log('[B] RE-EXPLICACIÓN (#3/#4) — mismo "Explícame" con isRepeat=true')
  console.log('='.repeat(72))
  const r2 = await vd.handle(ctx(msg, true))
  const t2 = (r2 as any)?.content || ''
  console.log(t2.slice(0, 1400))
  const acknowledges = /(otra forma|otra manera|de nuevo|distinto|veamos|vamos a verlo|más sencill|analog[ií]a|ejemplo|mnemot)/i.test(t2)
  // distintas: comparar contra la primera
  const jacc = (() => {
    const norm = (s: string) => new Set(s.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3))
    const A = norm(t1), B = norm(t2)
    const inter = [...A].filter(w => B.has(w)).length
    return inter / new Set([...A, ...B]).size
  })()
  console.log('\n  ✓ cambia de enfoque (acknowledge):', acknowledges ? '✅' : '⚠️')
  console.log('  ✓ Jaccard vs 1ª explicación:', jacc.toFixed(2), jacc < 0.7 ? '✅ (distinta)' : '⚠️ (parecida)')
}

main().catch(e => { console.error('ERR:', e?.stack || e); process.exit(1) })
