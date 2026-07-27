#!/usr/bin/env npx tsx
/**
 * aplicar-explicacion.ts — escribe una explicación NUEVA en el formato estructurado y deja
 * coherentes las dos columnas. **Dry-run por defecto.**
 *
 * ## Por qué esto y no "escribe el texto y luego derívalo"
 *
 * Durante la Fase 2 de T-080 el flujo era: escribir el texto de siempre y **parsearlo** después
 * para obtener la estructura. Manuel señaló el defecto y tenía razón: **parsear es heurístico y
 * falla** (medido el 27/07: solo el 43,7% del formato de generación y el 15,3% del de
 * impugnaciones se transcriben), y encima depende de que alguien se acuerde de correr el comando.
 *
 * La dirección correcta es la contraria:
 *   · histórico:  texto → estructura  = PARSE   (heurístico, con guarda de no-regresión)
 *   · nuevo:      estructura → texto  = RENDER  (determinista: no puede fallar)
 *
 * Así que aquí se escribe la ESTRUCTURA y el texto se genera desde ella con el mismo render que
 * usa el serve. Resultado: las dos columnas coherentes por construcción, la pregunta nace
 * barajable, y producción —donde el render nuevo aún no está desplegado— sigue sirviendo
 * `explanation` sin enterarse de nada.
 *
 * ## Formato de entrada (JSON)
 *
 *   {
 *     "cita":   { "ref": "Art. 103 CE", "texto": "…literal…" },   // opcional
 *     "intro":  "Párrafo de contexto.",                            // opcional
 *     "options": {                                                 // OBLIGATORIO: una por opción
 *       "0": "Razón de la opción A, referida a SU CONTENIDO, nunca a su letra.",
 *       "1": "…", "2": "…", "3": "…"
 *     },
 *     "outro":  "**Clave:** …",                                    // opcional
 *     "estilo": "boletin" | "impugnacion"                          // opcional (default boletin)
 *   }
 *
 * ⚠️ Las razones se escriben referidas al CONTENIDO de la opción («No corresponde al órgano de
 * administración electrónica»), NUNCA a su letra ni a su posición («la primera», «la anterior»):
 * esas no sobreviven al barajado ni con estructura.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json>
 *   npx tsx --env-file=.env.local scripts/aplicar-explicacion.ts <question_id> <fichero.json> --apply
 *
 * Relacionado: `lib/shuffle/structuredExplanation.ts`, T-080 Fase 2,
 * `docs/maintenance/impugnaciones-claude-code.md`, `scripts/backfill-explanation-data.ts` (el
 * camino inverso, para el histórico).
 */
import { readFileSync } from 'fs'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  isStructuredExplanation,
  renderStructuredExplanation,
  type StructuredExplanation,
} from '@/lib/shuffle/structuredExplanation'
import { optionsReferenceOtherOptions } from '@/lib/shuffle/classifyShuffleMode'

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const [qid, fichero] = argv.filter((a) => !a.startsWith('--'))

async function main() {
  if (!qid || !fichero) {
    console.error('Uso: aplicar-explicacion.ts <question_id> <fichero.json> [--apply]')
    process.exit(2)
  }
  const db = getDb()
  const [q]: any = await db.execute(sql`
    SELECT id, correct_option, option_a, option_b, option_c, option_d, option_e,
           explanation, explanation_data
      FROM questions WHERE id = ${qid}::uuid`)
  if (!q) { console.error(`Pregunta no encontrada: ${qid}`); process.exit(2) }

  const opciones = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(
    (v: string | null) => v != null && v !== '',
  )
  // `unknown` a propósito: es entrada externa y quien la valida es el type guard de abajo. Si se
  // declara ya como StructuredExplanation, TypeScript estrecha la rama de error a `never` y no
  // deja ni leer el objeto para explicar qué falta.
  const data: unknown = JSON.parse(readFileSync(fichero, 'utf8'))
  if (data && typeof data === 'object' && !(data as { v?: number }).v) (data as { v: number }).v = 1

  // 1) La estructura tiene que cubrir TODAS las opciones presentes. Sin esto, al barajar habría
  //    una opción sin razón y la explicación quedaría coja justo donde el opositor mira.
  if (!isStructuredExplanation(data, opciones.length)) {
    const recibidas = Object.keys((data as { options?: Record<string, string> })?.options ?? {})
    console.error(`❌ Estructura inválida: hacen falta ${opciones.length} razones (una por opción presente), keadas "0".."${opciones.length - 1}".`)
    console.error(`   Recibidas: ${recibidas.join(', ') || '(ninguna)'}`)
    process.exit(1)
  }
  const estructura: StructuredExplanation = data

  // 2) Guarda anti-letra: una razón que nombre la letra o la posición vuelve a clavar el orden,
  //    que es justo lo que este formato viene a eliminar.
  const sospechosas = Object.entries(estructura.options).filter(([, r]) =>
    /\b(la|opci[óo]n|respuesta|letra)\s+[A-E]\b|\b(primera|segunda|tercera|cuarta|[úu]ltima|anterior|siguiente)\s+(opci[óo]n|respuesta)/i.test(r),
  )
  if (sospechosas.length) {
    console.error('❌ Hay razones que se refieren a la LETRA o a la POSICIÓN de una opción:')
    for (const [k, r] of sospechosas) console.error(`   · opción ${k}: "${r.slice(0, 90)}…"`)
    console.error('   Reescríbelas referidas al CONTENIDO: al barajar, esas frases dejan de ser ciertas.')
    process.exit(1)
  }

  // 2-bis) La apertura la pone el RENDER, no quien escribe: si viniera en el `intro` con su letra,
  //         esa letra quedaría clavada y al barajar diría una mentira — justo lo que este formato
  //         viene a evitar. (En el histórico transcrito sí vive en el intro, y el render la respeta
  //         para no duplicarla; pero eso es herencia, no el modo de escribir.)
  if (/^la respuesta correcta es/i.test((estructura.intro ?? '').trim())) {
    console.error('❌ El `intro` no debe empezar con "La respuesta correcta es …": esa frase la genera')
    console.error('   el render con la letra que corresponda tras barajar. Quítala del intro.')
    process.exit(1)
  }

  // 3) El texto legacy se GENERA desde la estructura (render determinista, el mismo del serve).
  const texto = renderStructuredExplanation(estructura, {
    correctOption: q.correct_option,
    optionOrder: null,
    nOptions: opciones.length,
  })

  console.log(`\n── ${qid}`)
  console.log(`  estilo   : ${estructura.estilo ?? 'boletin'} · ${opciones.length} opciones`)
  console.log(`  explicación que se servirá (render en orden natural):\n`)
  console.log(texto.split('\n').map((l) => `    ${l}`).join('\n'))
  if (q.explanation) {
    console.log(`\n  (sustituye a un texto de ${String(q.explanation).length} caracteres)`)
  }

  if (!APPLY) { console.log('\n(dry-run — repite con --apply)\n'); return }

  // Las dos columnas en la MISMA transacción y en este orden: primero el contenido y después el
  // veredicto, porque `record_shuffle_safety` recalcula el hash leyendo la fila.
  await db.execute(sql`
    UPDATE questions
       SET explanation = ${texto},
           explanation_data = ${JSON.stringify(estructura)}::jsonb,
           updated_at = NOW()
     WHERE id = ${qid}::uuid`)
  // La explicación estructurada hace la EXPLICACIÓN barajable, pero no arregla unas OPCIONES que
  // se citen entre sí («La respuesta b) es correcta y además…»): esa pregunta sigue sin poder
  // barajarse. Marcar `safe` a ciegas dejaba que el sweep fuese detrás recogiendo lo que este
  // script acababa de romper (T-204), y con 47k pendientes de backfill eso no escala.
  const cruzadas = optionsReferenceOtherOptions(opciones)
  const estado = cruzadas ? 'unsafe' : 'safe'
  const razon = cruzadas ? 'options_crossref' : 'structured_explanation'
  await db.execute(sql`
    SELECT record_shuffle_safety(${qid}::uuid, ${estado}, ${razon}, 'aplicar-explicacion')`)
  if (cruzadas) {
    console.log('\n⚠️  Alguna OPCIÓN cita a otra por su letra → la pregunta queda `unsafe`:')
    console.log('   la explicación ya es barajable, pero las opciones no lo permiten.')
  }

  try {
    await db.execute(sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:aplicar-explicacion', 'info', 'explicacion_estructurada_aplicada',
              ${JSON.stringify({ question_id: qid, estilo: estructura.estilo ?? 'boletin', opciones: opciones.length })}::jsonb, NOW())`)
  } catch (e) {
    console.error(`⚠️  no se pudo registrar el evento: ${(e as Error).message}`)
  }
  console.log('\n✅ aplicada: estructura + texto coherentes, y la pregunta nace BARAJABLE.\n')
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
