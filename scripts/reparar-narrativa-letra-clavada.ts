#!/usr/bin/env npx tsx
/**
 * reparar-narrativa-letra-clavada.ts — poda la letra de opción CLAVADA en el `intro`/`outro` de
 * una explicación ESTRUCTURADA. **Dry-run por defecto.**
 *
 * ## Qué arregla (T-262, 29/07/2026)
 *
 * Las RAZONES de una explicación estructurada van keadas al índice de su opción y la letra la
 * pone el render, así que barajar mueve cada razón con su opción. El `intro` y el `outro`, en
 * cambio, son texto libre que el render emite **verbatim en cualquier orden**. Si ahí dentro hay
 * una letra, queda clavada:
 *
 *     La respuesta correcta es la **C**.        ← intro, fijo
 *     …
 *     **Por qué A es correcta:** …              ← cabecera, la calcula el render
 *
 * Medido el 29/07: 1.211 activas marcadas `safe` así (887 se podan solas; 337 llevan además el
 * texto de la opción en la apertura y necesitan criterio humano). Ninguna llegó a servirse
 * barajada —`option_order` está a NULL en toda la historia de `test_questions`—, así que es una
 * mina sin detonar: estallaría el día que se reencienda el barajado.
 *
 * ## Por qué podar y no reescribir
 *
 * La línea es REDUNDANTE en los dos estilos:
 *   · `impugnacion` → el render REGENERA la apertura con la letra que toque. Podarla deja el
 *     texto en orden natural IDÉNTICO y el barajado correcto. Ganancia sin coste.
 *   · `boletin`     → la cabecera «Por qué C es correcta» ya anuncia la letra. El texto pierde
 *     esa línea duplicada; se marca en el informe porque cambia lo que lee el opositor.
 *
 * Lo que NO hace: tocar las razones, la cita, la clave ni el `shuffle_safety` a mano. Reescribe
 * las dos columnas con el mismo render determinista que usa el serve (igual que
 * `aplicar-explicacion.ts`) y deja que `record_shuffle_safety` recalcule el veredicto.
 *
 * ## Uso
 *
 *   npx tsx --env-file=.env.local scripts/reparar-narrativa-letra-clavada.ts            # informe
 *   npm run shuffle:narrativa -- --pregunta <uuid>                                       # una
 *   npm run shuffle:narrativa -- --pregunta <uuid> --apply
 *   npm run shuffle:narrativa -- --limite 200 --apply                                    # lote
 *
 * Relacionado: `lib/shuffle/structuredExplanation.ts` (núcleo puro), el gate de serve en
 * `lib/shuffle/classifyShuffleMode.ts`, el detector nocturno `sweep-shuffle-safety-drift.ts`
 * (kind `shuffle_narrativa_letra_clavada`) y `docs/roadmap/barajar-opciones-verificacion-robusta.md`.
 */
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  isStructuredExplanation,
  mismoContenidoExplicacion,
  podarAperturaConLetra,
  renderStructuredExplanation,
  structuredNarrativeStaleLetters,
  type StructuredExplanation,
} from '@/lib/shuffle/structuredExplanation'

const argv = process.argv.slice(2)
const arg = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}
const APPLY = argv.includes('--apply')
const PREGUNTA = arg('--pregunta')
const LIMITE = arg('--limite') ? parseInt(arg('--limite')!, 10) : undefined

/** Qué se puede hacer con una pregunta, decidido SIN tocar la BD (función pura, testeable). */
export type Veredicto =
  | { tipo: 'limpia' }
  | { tipo: 'podable'; estructura: StructuredExplanation }
  /** La letra no está en la apertura canónica: hay que reescribir a mano, con criterio. */
  | { tipo: 'requiere_criterio'; campos: Array<'intro' | 'outro'> }

export function evaluar(data: unknown, nOptions: number): Veredicto {
  if (!isStructuredExplanation(data, nOptions)) return { tipo: 'limpia' }
  const sucios = structuredNarrativeStaleLetters(data)
  if (!sucios.length) return { tipo: 'limpia' }

  // Solo se automatiza la apertura canónica del `intro`. Cualquier otra letra (un outro tipo
  // "**Clave:** la C es la única que…", una referencia en medio del párrafo) es contenido que
  // hay que rehacer entendiéndolo — podarlo a ciegas dejaría la frase coja.
  const podado = podarAperturaConLetra(data.intro)
  const candidata: StructuredExplanation = { ...data, intro: podado }
  if (structuredNarrativeStaleLetters(candidata).length === 0) {
    return { tipo: 'podable', estructura: candidata }
  }
  return { tipo: 'requiere_criterio', campos: sucios }
}

async function main() {
  const db = getDb()
  const filas: any = await db.execute(sql`
    SELECT id, correct_option, option_a, option_b, option_c, option_d, option_e,
           explanation, explanation_data, shuffle_safety
      FROM questions
     WHERE is_active = true AND explanation_data IS NOT NULL
       ${PREGUNTA ? sql`AND id = ${PREGUNTA}::uuid` : sql``}
     ORDER BY id
     ${LIMITE ? sql`LIMIT ${LIMITE}` : sql``}`)

  let limpias = 0
  const podables: Array<{ id: string; antes: string; despues: string; estructura: StructuredExplanation; cambiaTexto: boolean; estilo: string }> = []
  const aMano: Array<{ id: string; campos: string[] }> = []

  for (const f of filas) {
    const opciones = [f.option_a, f.option_b, f.option_c, f.option_d, f.option_e].filter(
      (v: string | null) => v != null && v !== '',
    )
    const v = evaluar(f.explanation_data, opciones.length)
    if (v.tipo === 'limpia') { limpias++; continue }
    if (v.tipo === 'requiere_criterio') { aMano.push({ id: f.id, campos: v.campos }); continue }

    const texto = renderStructuredExplanation(v.estructura, {
      correctOption: f.correct_option,
      optionOrder: null,
      nOptions: opciones.length,
    })
    podables.push({
      id: f.id,
      antes: String(f.explanation ?? ''),
      despues: texto,
      estructura: v.estructura,
      // El estilo `impugnacion` regenera la apertura ⇒ el opositor lee lo mismo. El `boletin`
      // pierde la línea redundante ⇒ SÍ cambia lo que lee: se reporta aparte porque esa parte
      // necesita decisión, no automatismo. El juicio lo pone `mismoContenidoExplicacion`, el
      // mismo comparador que vigila el canary del backfill — no una comparación propia.
      cambiaTexto: !mismoContenidoExplicacion(String(f.explanation ?? ''), texto),
      estilo: (v.estructura.estilo ?? 'boletin') as string,
    })
  }

  const sinCambioVisible = podables.filter((p) => !p.cambiaTexto).length
  console.log(`\nrevisadas            : ${filas.length}`)
  console.log(`  ya limpias         : ${limpias}`)
  const porEstilo = podables.reduce<Record<string, number>>((a, p) => ({ ...a, [p.estilo]: (a[p.estilo] ?? 0) + 1 }), {})
  console.log(`  PODABLES           : ${podables.length}  (${sinCambioVisible} sin cambio visible · ${podables.length - sinCambioVisible} pierden la línea redundante)`)
  console.log(`     por estilo      : ${JSON.stringify(porEstilo)}`)
  console.log(`  requieren criterio : ${aMano.length}   ← reescritura humana, este script no las toca`)
  for (const m of aMano.slice(0, 10)) console.log(`     · ${m.id} (${m.campos.join(', ')})`)

  if (podables.length && !APPLY) {
    const ej = podables.find((p) => p.cambiaTexto) ?? podables[0]
    console.log(`\nEjemplo (${ej.id}):`)
    console.log('  ANTES  :', ej.antes.split('\n')[0])
    console.log('  DESPUÉS:', ej.despues.split('\n')[0])
    console.log('\n(dry-run — repite con --apply)\n')
    return
  }

  for (const p of podables) {
    // Las dos columnas en el mismo UPDATE y luego el veredicto, en ese orden: `record_shuffle_safety`
    // recalcula el hash leyendo la fila (mismo contrato que `aplicar-explicacion.ts`).
    await db.execute(sql`
      UPDATE questions
         SET explanation = ${p.despues},
             explanation_data = ${JSON.stringify(p.estructura)}::jsonb,
             updated_at = NOW()
       WHERE id = ${p.id}::uuid`)
    await db.execute(sql`
      SELECT record_shuffle_safety(${p.id}::uuid, 'safe', 'structured_explanation', 'reparar-narrativa')`)
  }
  if (podables.length) {
    try {
      await db.execute(sql`
        INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
        VALUES (gen_random_uuid(), NOW(), 'script:reparar-narrativa-letra-clavada', 'info',
                'shuffle_narrativa_podada',
                ${JSON.stringify({ podadas: podables.length, sin_cambio_visible: sinCambioVisible, requieren_criterio: aMano.length })}::jsonb,
                NOW())`)
    } catch (e) {
      console.error(`⚠️  no se pudo registrar el evento: ${(e as Error).message}`)
    }
    console.log(`\n✅ ${podables.length} podada(s). El gate de serve ya las acepta para barajar.\n`)
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
}
