// Conv D msg 1: user pide comparativa con otros opositores
// Antes: stats personales weekly comparison (ignoraba "en comparación con otros")
// Ahora: prefijo honesto avisando que no tenemos comparativa global + stats personal
import 'dotenv/config'
import { getStatsDomain } from '../lib/chat/domains/stats/StatsDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function main() {
  await loadLawsCache()
  const sd = getStatsDomain()

  const message = 'Como voy en comparación con los que se presentan a mí mismo examen?'

  const ctx: ChatContext = {
    request: {
      messages: [{ role: 'user', content: message }],
      isPremium: false,
    },
    userId: '6aef7a02-4a37-44a6-93d4-d48ab4fb601e',
    userDomain: 'auxiliar_administrativo_canarias',
    isPremium: false,
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  console.log('='.repeat(70))
  console.log('Conv D msg 1 (30a58409) — StatsDomain end-to-end')
  console.log('='.repeat(70))
  console.log('MSG:', message)
  console.log('\n--- RESPUESTA ANTES (log original) ---')
  console.log('📊 Tu Progreso: Esta Semana vs Semana Pasada\n📅 Esta Semana: 67 preguntas, 58% acierto\n📅 Semana Pasada: 198 preguntas, 58% acierto\n[stats personales, NO compara con otros opositores]')

  console.log('\n--- RESPUESTA AHORA ---')
  const resp = await sd.handle(ctx)
  console.log(resp?.content || resp)
}

main().catch(e => { console.error('ERR:', e?.stack || e); process.exit(1) })
