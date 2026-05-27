// Conv B: explicar_respuesta Ley 19/2013 art 18 — la IA antes alucinaba en
// la justificación de D ("carácter general" vs "publicación general").
// Ahora el prompt incluye "EXPLICACIÓN DE OPCIONES INCORRECTAS" con reglas
// estrictas. Vemos si el LLM cumple.
import 'dotenv/config'
import { getVerificationDomain } from '../lib/chat/domains/verification/VerificationDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function main() {
  await loadLawsCache()
  const vd = getVerificationDomain()

  const message = 'Explícame por qué la respuesta correcta es "B" en la pregunta: "Señale cuál de las siguientes causas determina la inadmisión de una solicitud para el ejercicio del derecho de acceso a la información pública"'

  const ctx: ChatContext = {
    request: {
      messages: [{ role: 'user', content: message }],
      isPremium: false,
    },
    userId: '6b7c401c-af0c-4d88-bbc8-6284826b0b88',
    userDomain: 'auxiliar_administrativo_estado',
    isPremium: false,
    questionContext: {
      questionId: '3b52381e-3e00-4d69-9248-dbaa0f89f869',
      lawName: 'Ley 19/2013',
      articleNumber: '18',
      correctAnswer: 1, // B
      questionText: 'Señale cuál de las siguientes causas determina la inadmisión de una solicitud para el ejercicio del derecho de acceso a la información pública:',
      options: [
        'Solicitudes relativas a información para cuya interposición sea necesaria una acción previa de reelaboración.',
        'Solicitudes que sean manifiestamente repetitivas o tengan un carácter abusivo no justificado con la finalidad de transparencia de esta Ley.',
        'Solicitudes dirigidas a un órgano en cuyo poder obre la información cuando se desconozca el competente.',
        'Solicitudes referidas a una información que tenga carácter general.',
      ],
      selectedAnswer: 1,
      explanation: 'El artículo 18.1.e) establece que se inadmitirán a trámite las solicitudes que sean manifiestamente repetitivas o tengan un carácter abusivo no justificado con la finalidad de transparencia de esta Ley.',
    },
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  console.log('='.repeat(70))
  console.log('Conv B (942f9bdb) — VerificationDomain end-to-end con prompt nuevo')
  console.log('='.repeat(70))
  console.log('\n--- RESPUESTA ANTES (log original — alucinación en D) ---')
  console.log('- Opción D: "Aunque el artículo menciona que las solicitudes referidas a')
  console.log('  información de carácter general pueden ser inadmitidas si están en curso de')
  console.log('  elaboración o publicación, no es la opción seleccionada como correcta..."')
  console.log('  ❌ LLM confundió "carácter general" con "publicación general"')

  console.log('\n--- RESPUESTA AHORA (prompt nuevo) ---')
  const t0 = Date.now()
  const resp = await vd.handle(ctx)
  console.log(`(latency: ${Date.now() - t0}ms)\n`)
  console.log(resp?.content || resp)
}

main().catch(e => { console.error('ERR:', e?.stack || e); process.exit(1) })
