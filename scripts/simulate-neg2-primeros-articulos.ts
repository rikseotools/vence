// Simulación del negativo #2 (cbe5313b, 05/06/2026)
//
// CASO ORIGINAL: "test de 20 preguntas sobre la ley 39/2015 los tres primeros
// artículos". La búsqueda NO extraía los arts 1-3 (sin dígitos) → traía
// artículos arbitrarios (22, 41, 42, 125, 133...) y el LLM punteaba pidiendo el
// texto. Fix: extractArticleNumbers parsea "los N primeros artículos" / rangos.
//
// Verifica que SearchDomain ahora trae los arts 1, 2 y 3 en el contexto y que
// la respuesta es un test (no un punt pidiendo el texto).
import 'dotenv/config'
import { getSearchDomain } from '../lib/chat/domains/search/SearchDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function main() {
  await loadLawsCache()
  const sd = getSearchDomain()

  const message = 'test de 20 preguntas sobre la ley 39/2015 los tres primeros artículos'
  const ctx: ChatContext = {
    request: { messages: [{ role: 'user', content: message }], isPremium: false },
    userId: '4b735f8b-6948-46b6-a492-b03a50b8814c',
    userDomain: 'auxiliar_administrativo_valencia',
    isPremium: false,
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  console.log('='.repeat(72))
  console.log('SIMULACIÓN negativo #2 — "los tres primeros artículos"')
  console.log('='.repeat(72))
  console.log('MSG:', message)

  const canHandle = await sd.canHandle(ctx)
  console.log('\n[1] canHandle =', canHandle)

  console.log('\n[2] END-TO-END (LLM real)…\n')
  const resp = await sd.handle(ctx)
  const text = (resp && (resp as any).content) || ''
  console.log('--- RESPUESTA ---\n' + text.slice(0, 1800))

  console.log('\n' + '='.repeat(72))
  console.log('CHEQUEOS')
  console.log('='.repeat(72))
  // Antes punteaba: "no encuentro el texto literal de los tres primeros artículos"
  const punts = /no\s+(encuentro|tengo|aparece).{0,40}(texto|art[ií]culo)/i.test(text) ||
                /(facilit|proporcion|necesitar[ií]a).{0,30}(texto|art[ií]culo)/i.test(text)
  const looksLikeTest = /(1[\.\)]|pregunta\s*1|art[ií]culo\s*1)/i.test(text) && text.length > 400
  console.log('NO puntea pidiendo el texto:', punts ? '❌ (sigue punteando)' : '✅')
  console.log('Parece un test/contenido sustantivo:', looksLikeTest ? '✅' : '⚠️')
}

main().catch(e => { console.error('ERR:', e?.stack || e); process.exit(1) })
