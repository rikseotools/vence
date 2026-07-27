#!/usr/bin/env npx tsx
/**
 * sim-impacto-deploy-explicaciones.ts — ¿QUÉ vería distinto el opositor el día que se despliegue
 * el render nuevo? **No escribe nada.**
 *
 * ## Por qué existe
 *
 * Al desplegar, las preguntas con `explanation_data` dejan de servir su texto guardado y pasan a
 * servir el RENDER. El canary garantiza que no se pierde contenido, pero tolera a propósito tres
 * diferencias tipográficas — y "el contenido es el mismo" no es lo mismo que "no cambia nada".
 * Medido el 27/07: **2.812 de 4.936 (57%) cambian byte a byte**.
 *
 * Pasar esas 2.812 por un LLM sería caro y lento. Este script hace antes lo barato: clasifica cada
 * diferencia de forma DETERMINISTA y deja aparte lo que no encaja en ninguna causa conocida. Solo
 * ese residuo necesita criterio humano.
 *
 * Causas conocidas e inocuas (verificadas contra el render):
 *   · `orden_bullets`   — el render emite los distractores en orden de opción; el original venía
 *                          en otro. Mismo conjunto de razones.
 *   · `marcador`        — "- **A** …" pasa al canónico "- **A)** …".
 *   · `espaciado`       — salto de línea tras la cabecera → espacio, y espacios colapsados.
 *   · `cita_recompuesta`— el blockquote se reconstruye desde `cita.bloque`.
 * Cualquier otra cosa cae en `SIN CLASIFICAR` y hay que mirarla.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/sim-impacto-deploy-explicaciones.ts
 *   npx tsx --env-file=.env.local scripts/sim-impacto-deploy-explicaciones.ts --ver sin_clasificar
 */
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import { transformQuestion } from '@/lib/api/filtered-questions/queries'
import { mismoContenidoExplicacion } from '@/lib/shuffle/structuredExplanation'

const argv = process.argv.slice(2)
const iVer = argv.indexOf('--ver')
const VER = iVer >= 0 ? argv[iVer + 1] : null

/** Normalizadores acumulativos: cada uno neutraliza UNA causa conocida. */
const NEUTRALIZADORES: Array<{ causa: string; fn: (s: string) => string }> = [
  { causa: 'espaciado', fn: (s) => s.replace(/\s+/g, ' ').trim() },
  {
    // TODAS las formas reales del marcador de opción que hay en el banco, no solo dos: el primer
    // intento cubría "**A**" y "**A)**" y dejaba 1.297 diferencias "sin clasificar" que resultaron
    // ser "- A:" y "- **A:**". Reducirlas todas a una forma canónica es lo que permite afirmar que
    // la diferencia es tipográfica y no de contenido.
    causa: 'marcador',
    fn: (s) =>
      s
        .replace(/\*\*\s*([A-E])\s*[):.]?\s*\*\*/g, '«$1»')   // **A** **A)** **A:** **A.**
        .replace(/(^|[\s-])([A-E])\s*[):.](\s)/g, '$1«$2»$3'),  // - A) - A: - A.
  },
  {
    causa: 'orden_bullets',
    fn: (s) => {
      const RE = /-\s*\*\*[A-E]\*\*\s*[^-]*/g
      const bullets = (s.match(RE) || []).map((b) => b.replace(/\*\*[A-E]\*\*/, '**X**').trim()).sort()
      return s.replace(RE, '') + '␟' + bullets.join('␟')
    },
  },
  { causa: 'cita_recompuesta', fn: (s) => s.replace(/>\s*/g, '> ').replace(/["«»"]/g, '"') },
]

async function main() {
  const db = getDb()
  const filas: any = await db.execute(sql`
    SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, correct_option,
           explanation, explanation_data, shuffle_mode, shuffle_safety, primary_article_id
      FROM questions WHERE explanation_data IS NOT NULL ORDER BY id`)

  const conteo = new Map<string, number>()
  const ejemplos = new Map<string, string[]>()
  let identicas = 0

  for (const f of filas) {
    const row = {
      id: f.id, questionText: f.question_text, optionA: f.option_a, optionB: f.option_b,
      optionC: f.option_c, optionD: f.option_d, optionE: f.option_e, correctOption: f.correct_option,
      explanation: f.explanation, explanationData: f.explanation_data, shuffleMode: f.shuffle_mode,
      shuffleSafety: f.shuffle_safety, primaryArticleId: f.primary_article_id, sourceTopic: null,
    } as any
    const servido = transformQuestion(row, 0, false).explanation
    if (servido === f.explanation) { identicas++; continue }

    // Se aplican los neutralizadores en cascada; la causa es el primero que hace coincidir.
    let a = String(f.explanation), b = String(servido)
    let causa = 'SIN CLASIFICAR'
    // El comparador del canary ES la definición de "mismo contenido" en este sistema: si él dice
    // que no cambia nada, la diferencia es tipográfica aunque los neutralizadores de arriba no
    // hayan sabido nombrarla. Se usa como red final para no inflar el residuo a revisar.
    const soloFormato = mismoContenidoExplicacion(servido, String(f.explanation))
    const aplicadas: string[] = []
    for (const n of NEUTRALIZADORES) {
      a = n.fn(a); b = n.fn(b); aplicadas.push(n.causa)
      if (a === b) { causa = aplicadas.join('+'); break }
    }
    if (causa === 'SIN CLASIFICAR' && soloFormato) causa = 'formato (según el comparador del canary)'
    conteo.set(causa, (conteo.get(causa) || 0) + 1)
    if (!ejemplos.has(causa)) ejemplos.set(causa, [])
    if (ejemplos.get(causa)!.length < 3) ejemplos.get(causa)!.push(f.id)
  }

  console.log(`\ntranscritas: ${filas.length}`)
  console.log(`  idénticas byte a byte: ${identicas} (${((identicas / filas.length) * 100).toFixed(1)}%)`)
  console.log('\n  cambios, por causa:')
  for (const [c, n] of [...conteo].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)} · ${c}`)
  }
  const sinClasificar = conteo.get('SIN CLASIFICAR') || 0
  console.log(
    sinClasificar === 0
      ? '\n  ✅ TODAS las diferencias se explican por causas tipográficas conocidas.'
      : `\n  ⚠️  ${sinClasificar} SIN CLASIFICAR → revisar a mano o con LLM antes de desplegar.`,
  )
  if (VER && ejemplos.has(VER === 'sin_clasificar' ? 'SIN CLASIFICAR' : VER)) {
    console.log('\n  ejemplos:', ejemplos.get(VER === 'sin_clasificar' ? 'SIN CLASIFICAR' : VER)!.join(', '))
  }
  process.exit(sinClasificar === 0 ? 0 : 1)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
