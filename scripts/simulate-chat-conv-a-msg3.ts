// Conv A msg 3: el user perdió el contexto de pregunta y volvió a preguntar.
// Antes: 10 arts genéricos via pattern matching, IA responde "no encuentro".
import 'dotenv/config'
import { getSearchDomain } from '../lib/chat/domains/search/SearchDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function main() {
  await loadLawsCache()
  const sd = getSearchDomain()

  const message = 'consejo de desarrollo sostenible y foro de gobierno abierto, comparten misma persona para ambas presidencias??'

  const ctx: ChatContext = {
    request: {
      messages: [{ role: 'user', content: message }],
      isPremium: false,
    },
    userId: '6b7c401c-af0c-4d88-bbc8-6284826b0b88',
    userDomain: 'auxiliar_administrativo_estado',
    isPremium: false,
    // SIN questionContext (igual que el log original)
    questionContext: undefined,
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  console.log('='.repeat(70))
  console.log('Conv A msg 3 (bdd586ed) — sin qctx, end-to-end')
  console.log('='.repeat(70))
  console.log('MSG:', message)
  console.log('\n--- RESPUESTA ANTES (real, del log) ---')
  console.log('No he encontrado artículos que aborden específicamente si el')
  console.log('Consejo de Desarrollo Sostenible y el Foro de Gobierno Abierto')
  console.log('comparten la misma persona para ambas presidencias.')

  console.log('\n--- RESPUESTA AHORA (LLM real) ---')
  const t0 = Date.now()
  const resp = await sd.handle(ctx)
  console.log(`(latency: ${Date.now() - t0}ms)\n`)
  console.log(resp?.content || resp)
}

main().catch(e => {
  console.error('ERR:', e?.stack || e)
  process.exit(1)
})
