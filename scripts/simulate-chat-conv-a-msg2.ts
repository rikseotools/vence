// Simulación end-to-end Conv A msg 2: ahora el flujo debe ir a SearchDomain
// (no a VerificationDomain reexplicando la opción B del test).
import 'dotenv/config'
import { getVerificationDomain } from '../lib/chat/domains/verification/VerificationDomain'
import { getSearchDomain } from '../lib/chat/domains/search/SearchDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function main() {
  await loadLawsCache()

  const message = 'el consejo de desarrollo sostenible y el foro de gobierno abierto, comparen misma persona para ambas presidencias?'

  const ctx: ChatContext = {
    request: {
      messages: [{ role: 'user', content: message }],
      isPremium: false,
    },
    userId: '6b7c401c-af0c-4d88-bbc8-6284826b0b88',
    userDomain: 'auxiliar_administrativo_estado',
    isPremium: false,
    // El log original tenía qctx con correctAnswer (la pregunta del test que el
    // user ya había respondido). VerificationDomain antes capturaba por eso.
    questionContext: {
      questionId: '9e4c452d-9eef-480a-a5be-64f5f5379294',
      lawName: 'Orden DSA/819/2020',
      articleNumber: '3',
      correctAnswer: 1,
      questionText: 'No forman parte del Consejo de Desarrollo Sostenible como vocales del sector empresarial y los sindicatos:',
      options: [
        'Una persona en representación de la Red Española del Pacto Mundial.',
        'La persona que ostente la titularidad de la presidencia de la Confederación Española de Mutualidades.',
        'La persona que ostente la titularidad de la Secretaría General de Comisiones Obreras.',
        'La persona que ostente la titularidad de la presidencia de la Unión de Profesionales y Trabajadores Autónomos.',
      ],
      selectedAnswer: 1,
      explanation: 'Art. 3 de la Orden DSA/819/2020 — vocalías sector empresarial.',
    },
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  const vd = getVerificationDomain()
  const captured = await vd.canHandle(ctx)
  console.log('='.repeat(70))
  console.log('Conv A msg 2 (9fe68263) — Quién captura?')
  console.log('='.repeat(70))
  console.log('VerificationDomain.canHandle:', captured, captured ? '❌ captura (mal)' : '✅ NO captura (bien, cede a Search)')

  console.log('\n--- RESPUESTA ANTES (real, del log) ---')
  console.log(
    'La respuesta correcta es la B): Solicitudes manifiestamente repetitivas...\n' +
    '[reexplicaba la pregunta del test ignorando el follow-up del user]'
  )

  if (captured) {
    console.log('\n(VerificationDomain habría capturado — no continúa la simulación)')
    return
  }

  console.log('\n--- RESPUESTA AHORA (SearchDomain con LLM real) ---')
  const sd = getSearchDomain()
  const t0 = Date.now()
  const resp = await sd.handle(ctx)
  console.log(`(latency: ${Date.now() - t0}ms)\n`)
  console.log(resp?.content || resp)
}

main().catch(e => {
  console.error('ERR:', e?.stack || e)
  process.exit(1)
})
