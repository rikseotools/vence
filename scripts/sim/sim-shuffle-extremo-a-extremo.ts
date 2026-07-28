#!/usr/bin/env npx tsx
/**
 * ¿Sale `option_order` por la puerta del servidor? Simulación EXTREMO A EXTREMO del serve.
 *
 * Por qué existe (28/07/2026): con el piloto encendido para `auxiliar_administrativo_valencia`,
 * `test_questions.option_order` está en 0 filas en TODA la historia. Hay dos explicaciones y son
 * muy distintas:
 *   (a) el servidor NO baraja → el piloto es inerte, molesto pero inofensivo;
 *   (b) el servidor SÍ baraja y el orden se pierde de vuelta → el servidor corrige la letra
 *       MOSTRADA contra la clave ORIGINAL y apunta FALLOS FALSOS a usuarios reales.
 *
 * Esto llama a la MISMA función que sirve el endpoint (`getFilteredQuestions`) con la configuración
 * de producción, y mira si las preguntas salen con `option_order`. No razona sobre el código: lo
 * ejecuta.
 *
 * Uso:  npx tsx scripts/sim/sim-shuffle-extremo-a-extremo.ts [positionType] [tema]
 */
import { getFilteredQuestions } from '../../lib/api/filtered-questions/queries'
import { isShuffleEnabledFor } from '../../lib/shuffle/flag'

const POSITION = process.argv[2] || 'auxiliar_administrativo_valencia'
const TEMA = Number(process.argv[3] || 21)

async function main() {
  // Configuración REAL de producción (leída de SSM al invocar; ver README del script).
  console.log(`flag FEATURE_SHUFFLE_OPTIONS=${process.env.FEATURE_SHUFFLE_OPTIONS ?? '(sin definir)'}`)
  console.log(`flag ..._SCOPE=${process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE ?? '(sin definir)'}`)
  console.log(`¿el barajado aplica a "${POSITION}"? ${isShuffleEnabledFor(POSITION) ? 'SÍ' : 'NO'}\n`)

  const res = await getFilteredQuestions({
    shuffleOptions: true, // lo que piden los fetchers del flujo de test estándar
    topicNumber: TEMA,
    positionType: POSITION,
    numQuestions: 20,
    selectedLaws: [],
    selectedArticlesByLaw: {},
    selectedSectionFilters: [],
    difficultyMode: 'random',
  } as never)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const qs: any[] = (res as any)?.questions ?? []
  const conOrden = qs.filter((q) => Array.isArray(q.option_order))
  const movidas = conOrden.filter((q) => {
    const o = q.option_order as number[]
    return o.some((orig, pos) => orig !== pos)
  })

  console.log(`preguntas servidas: ${qs.length}`)
  console.log(`   con option_order: ${conOrden.length}`)
  console.log(`   con las opciones REALMENTE movidas: ${movidas.length}`)
  for (const q of conOrden.slice(0, 3)) {
    console.log(`   · ${String(q.id).slice(0, 8)} orden=${JSON.stringify(q.option_order)} clave_mostrada=${'ABCD'[q.correct_option]}`)
  }

  console.log(
    conOrden.length === 0
      ? '\n▶ El servidor NO baraja: el piloto es INERTE. El desajuste cliente↔servidor tiene otra causa.'
      : '\n▶ El servidor SÍ baraja y devuelve el orden. Entonces, que `test_questions.option_order` esté a NULL\n' +
        '  significa que el orden NO vuelve al guardar → el servidor corrige la letra MOSTRADA contra la\n' +
        '  clave ORIGINAL y está registrando FALLOS FALSOS. Apagar el flag antes de seguir.',
  )
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
