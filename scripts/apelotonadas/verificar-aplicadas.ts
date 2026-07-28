#!/usr/bin/env npx tsx
/**
 * verificar-aplicadas.ts — re-verificación de la campaña «explicaciones apelotonadas» SOBRE LA
 * BD VIVA, después de aplicar (paso 7 del procedimiento v2.1 de `revisar-preguntas-con-agente.md`).
 *
 * No se fía de lo que el aplicador dijo que hizo: vuelve a leer cada pregunta de la base de datos
 * y comprueba, con el render y las guardas REALES (no una copia), que:
 *
 *   1. la clave (`correct_option`) sigue teniendo su razón en la estructura — esta campaña
 *      reescribe explicaciones y **jamás** toca la respuesta;
 *   2. `explanation_data` existe y es válida para el número de opciones presentes;
 *   3. el texto servido es EXACTAMENTE el render de esa estructura: si divergen, el opositor lee
 *      una cosa y el barajado compone otra;
 *   4. la pregunta ha salido del cubo de /admin/calidad (su explicación ya tiene saltos de línea);
 *   5. sigue activa y su `shuffle_safety` es coherente: `safe`, salvo que alguna OPCIÓN cite a
 *      otra por su letra, en cuyo caso debe quedar `unsafe`;
 *   6. ninguna razón cita una letra o una posición de opción (no sobrevivirían al barajado);
 *   7. la estructura en BD es la que se aplicó — si no, otra sesión la ha reescrito por detrás.
 *
 * Uso: npx tsx --env-file=.env.local scripts/apelotonadas/verificar-aplicadas.ts <dir> [<dir> …]
 *      (cada dir contiene un fichero `<question_id>.json` por pregunta)
 */
import { readdirSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
import {
  isStructuredExplanation,
  renderStructuredExplanation,
  type StructuredExplanation,
} from '@/lib/shuffle/structuredExplanation'
import { optionsReferenceOtherOptions } from '@/lib/shuffle/classifyShuffleMode'

// Mismas expresiones que la guarda de escritura (`aplicar-explicacion.ts`): una razón que nombre
// la letra o la posición vuelve a clavar el orden que este formato viene a eliminar.
const CITA_DE_LA_NORMA = /\b(letra|apartado|p[áa]rrafo|inciso|ep[íi]grafe|regla)\s+[a-e]\)?\s*(?:de[l]?\s+)?(?:art|ap|n[úu]m|\d)/gi
const REFERENCIA_A_OPCION_LETRA = /\b(?:[Ll]a|[Oo]pci[óo]n|[Rr]espuesta|[Ll]etra)\s+[A-E]\b/
const REFERENCIA_A_OPCION =
  /\b(primera|segunda|tercera|cuarta|[úu]ltima|anterior|siguiente)\s+(opci[óo]n|respuesta)\b|\b(opci[óo]n|respuesta|alternativa)\s+(anterior|previa|siguiente)\b/i

async function main() {
  const dirs = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  if (!dirs.length) {
    console.error('Uso: verificar-aplicadas.ts <dir con <question_id>.json> [<dir> …]')
    process.exit(2)
  }

  const aplicadas = new Map<string, StructuredExplanation>()
  for (const d of dirs) {
    for (const f of readdirSync(d).filter((x) => x.endsWith('.json'))) {
      aplicadas.set(basename(f, '.json'), JSON.parse(readFileSync(join(d, f), 'utf8')))
    }
  }

  const db = getDb()
  const ids = [...aplicadas.keys()]
  // `= ANY(${ids}::uuid[])` NO vale aquí: la plantilla de Drizzle expande el array en un parámetro
  // por elemento, así que Postgres recibe `ANY(($1, $2, …))` y revienta. Hay que construir la lista.
  const listaIds = sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)
  const filas: any[] = await db.execute(sql`
    SELECT id, correct_option, option_a, option_b, option_c, option_d, option_e,
           explanation, explanation_data, is_active, shuffle_safety, shuffle_safety_reason
      FROM questions WHERE id IN (${listaIds})`)

  const problemas: string[] = []
  const anota = (id: string, msg: string) => problemas.push(`${id}: ${msg}`)
  const vistos = new Set<string>()

  for (const q of filas) {
    vistos.add(q.id)
    const opciones = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e]
      .filter((v: string | null) => v != null && v !== '')

    if (!q.is_active) anota(q.id, 'ha dejado de estar activa')
    if (!q.explanation_data) { anota(q.id, 'sin explanation_data en BD'); continue }
    if (!isStructuredExplanation(q.explanation_data, opciones.length)) {
      anota(q.id, `explanation_data inválida para ${opciones.length} opciones`); continue
    }
    if (!(String(q.correct_option) in q.explanation_data.options)) {
      anota(q.id, `la clave (${q.correct_option}) no tiene razón en la estructura`)
    }
    const esperado = renderStructuredExplanation(q.explanation_data, {
      correctOption: q.correct_option, optionOrder: null, nOptions: opciones.length,
    })
    if (esperado !== q.explanation) anota(q.id, 'el texto servido NO es el render de la estructura')
    if (!String(q.explanation).includes('\n')) anota(q.id, 'sigue sin saltos de línea (dentro del cubo)')

    const esperadoEstado = optionsReferenceOtherOptions(opciones) ? 'unsafe' : 'safe'
    if (q.shuffle_safety !== esperadoEstado) {
      anota(q.id, `shuffle_safety='${q.shuffle_safety}', se esperaba '${esperadoEstado}'`)
    }
    for (const [k, r] of Object.entries(q.explanation_data.options as Record<string, string>)) {
      const limpia = String(r).replace(CITA_DE_LA_NORMA, ' ')
      if (REFERENCIA_A_OPCION_LETRA.test(limpia) || REFERENCIA_A_OPCION.test(limpia)) {
        anota(q.id, `la razón de la opción ${k} cita una letra o una posición`)
      }
    }
    const quiso = aplicadas.get(q.id)
    if (quiso && JSON.stringify(quiso.options) !== JSON.stringify(q.explanation_data.options)) {
      anota(q.id, 'la estructura en BD no es la aplicada (¿reescrita por otra sesión?)')
    }
  }
  for (const id of ids) if (!vistos.has(id)) anota(id, 'no encontrada en BD')

  console.log(`Revisadas ${filas.length} de ${ids.length} preguntas.`)
  if (problemas.length) {
    console.log(`\n❌ ${problemas.length} problema(s):`)
    for (const p of problemas) console.log('  · ' + p)
    process.exit(1)
  }
  console.log('✅ Pasada limpia: clave intacta, estructura válida, texto = render, fuera del cubo y barajado coherente.')
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
