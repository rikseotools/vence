// Simulación end-to-end Conv A msg 1 contra el código nuevo
import 'dotenv/config'
import { getSearchDomain } from '../lib/chat/domains/search/SearchDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function main() {
  await loadLawsCache()
  const sd = getSearchDomain()

  const message = 'pero entonces esa persona ostenta a la vez la presidencia del del consejo de desarrollo sostenible y del foro de gobierno abierto no?'

  const ctx: ChatContext = {
    request: {
      messages: [{ role: 'user', content: message }],
      isPremium: false,
    },
    userId: '6b7c401c-af0c-4d88-bbc8-6284826b0b88',
    userDomain: 'auxiliar_administrativo_estado',
    isPremium: false,
    questionContext: {
      questionId: '7326a1ab-2ab9-437a-acc4-faca9c25fb4a',
      lawName: 'Orden DSA/819/2020',
      articleNumber: null,
      correctAnswer: null,
      questionText: null,
      options: null,
      selectedAnswer: null,
      explanation: null,
    },
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  console.log('='.repeat(70))
  console.log('Conv A msg 1 (cf5d0672) — SearchDomain.handle end-to-end')
  console.log('='.repeat(70))
  console.log('MSG:', message)
  console.log('\n--- RESPUESTA ANTES (real, del log original) ---')
  console.log(
    'No tengo acceso a información específica sobre la presidencia del\n' +
    'Foro de Gobierno Abierto, ya que no se menciona en los artículos\n' +
    'proporcionados de la Orden DSA/819/2020. En estos artículos solo se\n' +
    'detalla la composición y funcionamiento del Consejo de Desarrollo\n' +
    'Sostenible...'
  )

  console.log('\n--- RESPUESTA AHORA (LLM real, código nuevo) ---')
  const t0 = Date.now()
  const resp = await sd.handle(ctx)
  console.log(`(latency: ${Date.now() - t0}ms)\n`)
  console.log(resp?.content || resp)
}

main().catch(e => {
  console.error('ERR:', e?.stack || e)
  process.exit(1)
})
