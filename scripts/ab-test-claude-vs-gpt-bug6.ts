// Prueba A/B: mismas 6 preguntas legales del Bug 6 contra Claude Sonnet
// (Anthropic) en vez de GPT-4o (OpenAI). Mismo SearchDomain.searchArticles
// para obtener los mismos artículos en contexto — solo cambia el LLM final.
import 'dotenv/config'
import { searchArticles, formatArticlesForContext } from '../lib/chat/domains/search/ArticleSearchService'
import { getAnthropic, ANTHROPIC_MODEL } from '../lib/chat/shared/anthropic'
import { loadLawsCache } from '../lib/chat/shared/lawsCache'
import type { ChatContext } from '../lib/chat/core/types'

// System prompt minimalista equivalente al de SearchDomain.buildSystemPrompt
// para preguntas sin questionContext (los 6 casos del Bug 6).
const SYSTEM_PROMPT = `Eres un asistente experto en derecho administrativo español, especializado en oposiciones, desarrollado por Vence.

Tu objetivo: responder al usuario usando los ARTÍCULOS RELEVANTES proporcionados.

REGLAS:
1. Si el artículo proporcionado responde a la pregunta, CÍTALO literalmente con su referencia (ej: "Según el Art. 14 del TUE...").
2. Si los artículos NO contienen la respuesta exacta, di claramente "los artículos proporcionados no cubren esto" y, si es seguro, ofrece tu conocimiento general sobre la materia citando la norma habitual donde se regula.
3. Usa formato markdown con negritas y emojis para que sea fácil de leer.
4. Responde en español de España, con tono didáctico de oposiciones.
5. NUNCA inventes números de artículo. Si no estás seguro de un número, no lo cites.`

async function runOneClaude(label: string, message: string) {
  console.log('\n' + '='.repeat(72))
  console.log(`[${label}] [CLAUDE Sonnet]`)
  console.log('MSG:', message)

  const ctx: ChatContext = {
    request: { messages: [{ role: 'user', content: message }], isPremium: false },
    userId: 'sim-user',
    userDomain: 'auxiliar_administrativo_estado',
    isPremium: false,
    messages: [{ role: 'user', content: message }],
    currentMessage: message,
    startTime: Date.now(),
  }

  // Mismas búsquedas que SearchDomain hace
  const result = await searchArticles(ctx, { limit: 10 })
  console.log(`(arts encontrados: ${result.articles.length} via ${result.searchMethod})`)

  const articlesContext = formatArticlesForContext(result.articles, { fullContent: true })
  const userPrompt = `${message}\n\n---\nARTÍCULOS RELEVANTES:\n${articlesContext}`

  const anthropic = await getAnthropic()
  const t0 = Date.now()
  try {
    const completion = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const ms = Date.now() - t0
    const text = completion.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('\n')
    console.log(`(${ms}ms, ${completion.usage.input_tokens} in / ${completion.usage.output_tokens} out)`)
    console.log('--- RESPUESTA CLAUDE ---')
    console.log(text)
  } catch (e: any) {
    console.log('❌ ERROR:', e?.message || e)
  }
}

async function main() {
  await loadLawsCache()
  console.log('\n████████ A/B Bug 6 — Claude Sonnet contra los mismos 6 mensajes ████████')
  const cases = [
    ['B-1', 'qué salas o secciones componen el tribunal central de instancia?'],
    ['B-2', 'Quienes integran las conferencias sectoriales?'],
    ['B-3', 'La audiencia Nacional de que se encarga realmente?'],
    ['B-4', 'El permiso por neonato hospitalizado es lo mismo que por hijo prematuro?'],
    ['B-5', 'Sobre la regencia, puede ser regente alguien no español?'],
    ['B-6', 'Órganos legislativos de la UE?'],
  ]
  for (const [label, msg] of cases) await runOneClaude(label, msg)
}

main().catch(e => { console.error('FATAL:', e?.stack || e); process.exit(1) })
