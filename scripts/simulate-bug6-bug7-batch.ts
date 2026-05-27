// Validación end-to-end LLM real de TODOS los casos de Bug 6 y Bug 7.
// Itera los 14 mensajes que faltaban verificar y enseña la respuesta real.
import 'dotenv/config'
import { getSearchDomain } from '../lib/chat/domains/search/SearchDomain'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

async function runMessage(label: string, message: string) {
  const sd = getSearchDomain()
  const ctx: ChatContext = {
    request: { messages: [{ role: 'user', content: message }], isPremium: false },
    userId: 'sim-user',
    userDomain: 'auxiliar_administrativo_estado',
    isPremium: false,
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }
  console.log('\n' + '='.repeat(72))
  console.log(`[${label}]`)
  console.log('MSG:', message)
  const captured = await sd.canHandle(ctx)
  if (!captured) {
    console.log('❌ NO capturado por SearchDomain')
    return
  }
  const t0 = Date.now()
  try {
    const resp = await sd.handle(ctx)
    console.log(`(${Date.now() - t0}ms)`)
    console.log('--- RESPUESTA LLM ---')
    console.log(resp?.content || JSON.stringify(resp))
  } catch (e: any) {
    console.log('❌ ERROR:', e?.message || e)
  }
}

async function main() {
  await loadLawsCache()

  console.log('\n████████ BUG 7 — Funciones Excel (8 casos restantes) ████████')
  const excelCases = [
    ['C-1', '=SUSTITUIR(A1;CARACTER(13);"") que hace?'],
    ['C-2', 'existe la funcion LIMPIAR?'],
    ['C-3', 'y JERARQUIA.EQV?'],
    ['C-4', 'que haría =CONCATENAR(IZQUIERDA(A9;2)?'],
    ['C-5', 'entonces SUSTITUIR (B2;DERECHA(B2;1);"")'],
    ['C-6', 'diferencia entre =SUSTITUIR y =REEMPLAZAR'],
    ['C-7', 'y LARGO?'],
    ['C-8', 'que hace la funcion IZQUIERDA'],
  ]
  for (const [label, msg] of excelCases) await runMessage(label, msg)

  console.log('\n\n████████ BUG 6 — Preguntas legales conversacionales (6 casos restantes) ████████')
  const legalCases = [
    ['B-1', 'qué salas o secciones componen el tribunal central de instancia?'],
    ['B-2', 'Quienes integran las conferencias sectoriales?'],
    ['B-3', 'La audiencia Nacional de que se encarga realmente?'],
    ['B-4', 'El permiso por neonato hospitalizado es lo mismo que por hijo prematuro?'],
    ['B-5', 'Sobre la regencia, puede ser regente alguien no español?'],
    ['B-6', 'Órganos legislativos de la UE?'],
  ]
  for (const [label, msg] of legalCases) await runMessage(label, msg)
}

main().catch(e => { console.error('FATAL:', e?.stack || e); process.exit(1) })
