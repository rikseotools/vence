// Conv C: LO 3/2018 art 16, opción C correcta.
// Antes: el LLM solo decía "no está en el artículo" para A y B,
// sin identificar la trampa (A imita art 23.4 cambiando "fines de" por "fines distintos de").
import 'dotenv/config'
import { getVerificationDomain } from '../lib/chat/domains/verification/VerificationDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function main() {
  await loadLawsCache()
  const vd = getVerificationDomain()

  const message = 'Explícame por qué la respuesta correcta es "C" en la pregunta: "Ley Orgánica de Protección de Datos Personales y garantía de los derechos digitales. Derecho a la limitación del tratamiento. Marque la CORRECTA"'

  const ctx: ChatContext = {
    request: { messages: [{ role: 'user', content: message }], isPremium: false },
    userId: '9c2fbcb8-4ec0-4880-be69-52e044ee8b08',
    userDomain: 'administrativo_galicia',
    isPremium: false,
    questionContext: {
      questionId: 'c3a261b7-4970-42cf-9542-854c0ca722fa',
      lawName: 'LO 3/2018',
      articleNumber: '16',
      correctAnswer: 2, // C
      questionText: 'Ley Orgánica de Protección de Datos Personales y garantía de los derechos digitales. Derecho a la limitación del tratamiento. Marque la CORRECTA:',
      options: [
        'El responsable podrá conservar los datos identificativos del afectado necesarios con el fin de limitar tratamientos futuros para fines distintos de la mercadotecnia directa.',
        'El afectado deberá acompañar, cuando sea preciso, la documentación justificativa de la limitación de los datos objeto de tratamiento.',
        'El hecho de que el tratamiento de los datos personales esté limitado debe constar claramente en los sistemas de información del responsable.',
        'Todas son correctas.',
      ],
      selectedAnswer: 2,
      explanation: '**Art. 16.2.** El hecho de que el tratamiento de los datos personales esté limitado debe constar claramente en los sistemas de información del responsable.',
    },
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  console.log('='.repeat(70))
  console.log('Conv C (678e1d01) — VerificationDomain end-to-end con prompt nuevo')
  console.log('='.repeat(70))
  console.log('\n--- RESPUESTA ANTES (log original) ---')
  console.log('Opción A: "No se menciona en el artículo que el responsable pueda...')
  console.log('Esta afirmación no está respaldada por el texto del artículo." [VAGO]')
  console.log('Opción B: similar [VAGO]')
  console.log('Opción D: "No puede ser correcta porque las opciones A y B no están..." [OK]')

  console.log('\n--- RESPUESTA AHORA (prompt nuevo) ---')
  const t0 = Date.now()
  const resp = await vd.handle(ctx)
  console.log(`(latency: ${Date.now() - t0}ms)\n`)
  console.log(resp?.content || resp)
}

main().catch(e => { console.error('ERR:', e?.stack || e); process.exit(1) })
