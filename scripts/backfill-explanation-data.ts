#!/usr/bin/env npx tsx
/**
 * backfill-explanation-data.ts — transcribe el histórico §8.1 (letra-anclado) a
 * `explanation_data` (estructurado, sin letras). Fase 2 de T-080. **Dry-run por defecto.**
 *
 * ## Por qué
 *
 * 47.388 preguntas activas son `unsafe` SOLO porque su explicación cita las opciones por letra
 * (medido 27/07/2026: el 72% de todo lo que bloquea el barajado). Con la explicación estructurada
 * —razones keadas al índice de cada opción, letra asignada al renderizar— esas preguntas pasan a
 * ser barajables **sin reescribir una sola explicación a mano**: el parser determinista convierte
 * el 71,2% del histórico (simulado sobre RDS, `scripts/sim-structured-explanation.ts`).
 *
 * ## Los dos sistemas conviven, y eso es el diseño, no una fase transitoria mal resuelta
 *
 * Escribir `explanation_data` NO cambia lo que ve el opositor: el serve renderiza el MISMO
 * markdown §8.1 desde la estructura (drop-in verificado en 18 tests + invariante 100% en 44.155
 * permutaciones). Una pregunta sin estructura se sigue sirviendo exactamente igual que hoy. Por
 * eso se puede transcribir a ritmo y encender el barajado cuando la cobertura convenza.
 *
 * ## Qué NO hace
 *
 * - No inventa: si el parser no reconoce la estructura del texto, **no toca la pregunta** (queda
 *   para la pasada LLM). El 28,7% restante es eso.
 * - No toca `explanation`: el texto original se conserva intacto como red de seguridad.
 * - No enciende ningún flag de barajado.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/backfill-explanation-data.ts             # dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-explanation-data.ts --limite 500
 *   npx tsx --env-file=.env.local scripts/backfill-explanation-data.ts --apply
 *   … --pregunta <uuid> --apply   ← UNA pregunta: para usar tras corregir una impugnación o una
 *                                   revisión, de modo que la explicación nueva nazca barajable
 *   … --solo-activas   (por defecto recorre TODAS; con esto, solo `is_active`)
 *
 * Relacionado: `docs/roadmap/barajar-opciones-fase2-explicaciones-estructuradas.md` §7,
 * `lib/shuffle/structuredExplanation.ts`, tarea T-080.
 */
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  parseLetterFormatExplanation,
  parseImpugnacionFormatExplanation,
  renderStructuredExplanation,
  isStructuredExplanation,
  mismoContenidoExplicacion,
} from '@/lib/shuffle/structuredExplanation'
import { optionsReferenceOtherOptions } from '@/lib/shuffle/classifyShuffleMode'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const SOLO_ACTIVAS = argv.includes('--solo-activas')
const valor = (f: string) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null
}
const LIMITE = parseInt(valor('--limite') || '0', 10)
const PREGUNTA = valor('--pregunta')
const LOTE = 500

type Fila = {
  id: string
  explanation: string | null
  correct_option: number
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  option_e: string | null
}

async function main() {
  const db = getDb()
  const resumen = { candidatas: 0, migradas: 0, no_migrables: 0, render_distinto: 0, errores: 0,
    // Desglose por formato: sin él no se sabe si el problema es el parser de uno o del otro.
    por_formato: { boletin: { total: 0, ok: 0 }, impugnacion: { total: 0, ok: 0 } } }

  const filas = (await db.execute(sql`
    SELECT id, explanation, question_text, correct_option, option_a, option_b, option_c, option_d, option_e
      FROM questions
     WHERE explanation_data IS NULL
       ${PREGUNTA ? sql`AND id = ${PREGUNTA}::uuid` : sql``}
       AND explanation IS NOT NULL AND explanation <> ''
       AND shuffle_mode = 'full'
       -- Universo = el formato §8.1 COMPLETO, el mismo que mide la simulación. Sin este filtro
       -- entran explicaciones en prosa libre que el parser no puede reconocer (y no debe: no
       -- tienen razones por opción que extraer), y la tasa de migración parece un desastre
       -- cuando en realidad se está midiendo otra cosa: 3,8% sobre todo vs 71,2% sobre §8.1.
       -- Los DOS formatos legacy vivos: el §8.1 de generación y el §5.1 de impugnaciones. El
       -- segundo lo produce cada corrección de impugnación (13.559 activas), así que dejarlo
       -- fuera condenaba a ese trabajo a seguir generando explicaciones no barajables.
       AND (
         (explanation LIKE '%Por qué%' AND explanation LIKE '%son incorrectas%')
         OR explanation ILIKE 'La respuesta correcta es%'
       )
       ${SOLO_ACTIVAS ? sql`AND is_active` : sql``}
     ORDER BY id
     ${LIMITE > 0 ? sql`LIMIT ${LIMITE}` : sql``}
  `)) as unknown as Fila[]

  resumen.candidatas = filas.length
  console.log(`\n${'='.repeat(78)}`)
  console.log(`BACKFILL explanation_data — ${filas.length} candidata(s)${SOLO_ACTIVAS ? ' (solo activas)' : ''}`)
  console.log('='.repeat(78))

  const pendientes: Array<{ id: string; data: unknown; cruzadas: boolean }> = []
  for (const f of filas) {
    const opciones = [f.option_a, f.option_b, f.option_c, f.option_d, f.option_e].filter(
      (v): v is string => v != null && v !== '',
    )
    if (opciones.length < 2) { resumen.no_migrables++; continue }

    // Se intenta con los dos parsers; cada uno reconoce su formato y devuelve null ante el otro.
    const esImpugnacion = /^la respuesta correcta es/i.test((f.explanation || '').trim())
    const fam = esImpugnacion ? 'impugnacion' : 'boletin'
    resumen.por_formato[fam].total++
    const data =
      parseLetterFormatExplanation(f.explanation, { correctOption: f.correct_option, nOptions: opciones.length }) ??
      parseImpugnacionFormatExplanation(f.explanation, {
        correctOption: f.correct_option,
        nOptions: opciones.length,
        // El marco (¿se pide la verdadera o la falsa?) lo dicta el ENUNCIADO, no la explicación (T-212).
        questionText: f.question_text,
      })
    if (!data || !isStructuredExplanation(data, opciones.length)) { resumen.no_migrables++; continue }

    // GUARDA de no-regresión, pregunta a pregunta: el render en orden NATURAL tiene que producir
    // un texto equivalente al original. Si no, la transcripción cambiaría lo que lee el opositor
    // y eso no es aceptable ni aunque el parser esté "seguro". Se compara con el ruido tipográfico
    // normalizado (espacios), no byte a byte: el render recompone el markdown canónico.
    const renderizado = renderStructuredExplanation(data, {
      correctOption: f.correct_option,
      optionOrder: null,
      nOptions: opciones.length,
    })
    if (!mismoContenidoExplicacion(renderizado, f.explanation || '')) {
      resumen.render_distinto++
      continue
    }

    resumen.por_formato[fam].ok++
    // Igual que el aplicador: la estructura arregla la explicación, no unas opciones que se citen
    // entre sí. Se transcribe igual (la estructura es buena) pero NO se marca barajable (T-204).
    const cruzadas = optionsReferenceOtherOptions(opciones)
    pendientes.push({ id: f.id, data, cruzadas })
  }

  resumen.migradas = pendientes.length
  const pct = ((resumen.migradas / (resumen.candidatas || 1)) * 100).toFixed(1)
  console.log(`  migrables por el parser        : ${resumen.migradas} (${pct}%)`)
  console.log(`  no migrables (→ pasada LLM)    : ${resumen.no_migrables}`)
  console.log(`  descartadas por render distinto: ${resumen.render_distinto}  ← guarda de no-regresión`)
  for (const [fam, v] of Object.entries(resumen.por_formato)) {
    const p = v.total ? ((v.ok / v.total) * 100).toFixed(1) : '0.0'
    console.log(`     · formato ${fam.padEnd(12)}: ${v.ok}/${v.total} (${p}%)`)
  }

  if (!APPLY) {
    console.log('\n(dry-run — no se ha escrito nada; repite con --apply)\n')
    return
  }

  console.log(`\n✍️  escribiendo en lotes de ${LOTE}…`)
  for (let i = 0; i < pendientes.length; i += LOTE) {
    const lote = pendientes.slice(i, i + LOTE)
    for (const p of lote) {
      try {
        // Primero la estructura y DESPUÉS el veredicto: `record_shuffle_safety` recalcula el hash
        // leyendo la fila, así que si se hiciera al revés el hash guardado sería el de antes de
        // la estructura y el trigger lo degradaría a `stale` en el siguiente UPDATE.
        await db.execute(sql`UPDATE questions SET explanation_data = ${JSON.stringify(p.data)}::jsonb WHERE id = ${p.id}::uuid`)
        await db.execute(sql`SELECT record_shuffle_safety(${p.id}::uuid,
          ${p.cruzadas ? 'unsafe' : 'safe'}, ${p.cruzadas ? 'options_crossref' : 'structured_explanation'},
          'backfill-explanation-data')`)
      } catch (e) {
        resumen.errores++
        console.error(`  ❌ ${p.id}: ${(e as Error).message.slice(0, 120)}`)
      }
    }
    console.log(`  … ${Math.min(i + LOTE, pendientes.length)}/${pendientes.length}`)
  }

  try {
    await db.execute(sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:backfill-explanation-data', 'info', 'shuffle_fase2_backfill',
              ${JSON.stringify(resumen)}::jsonb, NOW())`)
  } catch (e) {
    console.error(`⚠️  no se pudo registrar el evento de observabilidad: ${(e as Error).message}`)
  }
  console.log(`\n✅ ${resumen.migradas - resumen.errores} preguntas con explicación estructurada · ${resumen.errores} errores\n`)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
