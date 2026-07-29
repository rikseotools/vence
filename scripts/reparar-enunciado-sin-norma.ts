#!/usr/bin/env npx tsx
/**
 * reparar-enunciado-sin-norma.ts — nombra la norma en los enunciados que la citan a ciegas
 * («Según el artículo 75 **de la ley**, …»). **Dry-run por defecto y por LEY.**
 *
 * ## Qué arregla (29/07/2026)
 *
 * §2.2-quater del manual de generación: cada pregunta debe ser AUTOCONTENIDA. Los tests salen
 * barajados y sueltos, así que un enunciado que dice «de la ley» sin decir cuál es irresoluble
 * fuera de su contexto. Detector: `lib/health/autocontenida.cjs` (kind `enunciado_norma_sin_nombrar`).
 * Lo destapó la impugnación `6ed11712` de Esther Lázaro: *«Porque no indica a qué normativa se
 * refiere»*.
 *
 * ## Por qué se puede automatizar (y qué NO se automatiza)
 *
 * El dato ya está en casa: la pregunta cuelga de un artículo y ese artículo tiene su ley. Así que
 * la sustitución es determinista —«de la ley» → «de la Ley 9/2017, de Contratos del Sector
 * Público»— y **no inventa nada**: el nombre sale de `laws`, no de un modelo.
 *
 * Aun así:
 *   · Se va **POR LEY** (`--ley`), no en bloque: el nombre que se inserta hay que leerlo una vez
 *     por ley, y dentro de una ley el arreglo es idéntico (el defecto viene de remesas enteras).
 *   · Las de examen **OFICIAL se saltan siempre**: ahí el enunciado es el que salió publicado.
 *   · Solo se toca el ENUNCIADO. Ni opciones, ni clave, ni explicación.
 *
 * ## Uso
 *
 *   npm run enunciados:sin-norma                          # informe por ley (no toca nada)
 *   npm run enunciados:sin-norma -- --ley "Ley 9/2017"    # ver el antes/después de esa ley
 *   npm run enunciados:sin-norma -- --ley "Ley 9/2017" --apply
 */
import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'
const { AC_DESNUDA, AC_IDENTIFICA, AC_SIGLA, classifyAutocontenida } = require('@/lib/health/autocontenida.cjs')

const argv = process.argv.slice(2)
const arg = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}
const APPLY = argv.includes('--apply')
const LEY = arg('--ley')

/**
 * Sustituye la referencia desnuda por el nombre de la norma. PURA y exportada: es la única línea
 * que decide qué lee el opositor, así que tiene test.
 *
 * Conserva el artículo y el resto de la frase intactos; solo cambia el sintagma que nombra (o
 * deja de nombrar) la norma. Devuelve `null` si no encuentra qué sustituir — nunca "aproxima".
 */
export function nombrarNorma(enunciado: string, nombreLey: string): string | null {
  // El mismo sintagma que detecta el núcleo, pero capturando las piezas para recomponer.
  //
  // El lookahead final NO es opcional: sin él, «de la **Ley** 13/2015» casaba en la palabra «Ley»
  // y la sustitución escribía «de la Ley 13/2015 13/2015». Es la misma condición de cierre que
  // exige el detector (`AC_DESNUDA`), y por eso reparar y detectar disparan exactamente donde
  // mismo. Lo cazó el test de esta función, no la revisión a ojo.
  const RE = /(art[íi]culo\s+[0-9]+(?:\.[0-9]+)*\s*(?:bis|ter|qu[áa]ter)?\s*(?:,\s*(?:p[áa]rrafo|apartado)[^,]{0,20},?\s*)?)(de|seg[úu]n)\s+(?:la|dicha|esta|citada|presente|mencionada|referida)\s+(?:normativa|norma|ley|reglamento|disposici[óo]n)\b(?=[,.:;?)]|\s+(?:en|se|que|si|no|para|cuando)\b|$)/i
  if (!RE.test(enunciado)) return null
  return enunciado.replace(RE, (_m, cabeza, nexo) => `${cabeza}${conector(nexo, nombreLey)} ${nombreLey}`)
}

/**
 * El conector con su artículo, concordando con el GÉNERO de la norma. Sin esto salía «de Ley
 * 13/2015» —sin artículo— y, en cuanto la norma es un decreto, «de la Decreto 225/2014». Lo
 * enseñó el piloto sobre la Ley 13/2015 antes de tocar una sola fila.
 */
export function conector(nexo: string, nombreLey: string): string {
  const masculino = /^(real\s+decreto|decreto|reglamento|estatuto|c[óo]digo|texto\s+refundido|convenio|acuerdo|plan)\b/i.test(nombreLey.trim())
  if (/^seg[úu]n$/i.test(nexo)) return `${nexo} ${masculino ? 'el' : 'la'}`
  return masculino ? 'del' : 'de la'
}

async function main() {
  const db = getDb()
  const filas: any = await db.execute(sql`
    SELECT q.id, q.question_text, q.is_official_exam, l.short_name AS ley, l.name AS ley_nombre,
           (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id) AS servidas
      FROM questions q
      LEFT JOIN articles a ON a.id = q.primary_article_id
      LEFT JOIN laws l ON l.id = a.law_id
     WHERE q.is_active = true
       AND q.question_text ~* ${AC_DESNUDA}
       AND NOT (q.question_text ~* ${AC_IDENTIFICA} OR q.question_text ~ ${AC_SIGLA})
     ORDER BY l.short_name, q.id`)

  if (!LEY) {
    const porLey = new Map<string, { n: number; ofi: number; servidas: number }>()
    for (const f of filas) {
      const k = f.ley ?? '(sin ley vinculada)'
      const v = porLey.get(k) ?? { n: 0, ofi: 0, servidas: 0 }
      v.n++; if (f.is_official_exam) v.ofi++; v.servidas += Number(f.servidas)
      porLey.set(k, v)
    }
    console.log(`\nenunciados que citan una norma sin nombrarla: ${filas.length}\n`)
    for (const [ley, v] of [...porLey.entries()].sort((a, b) => b[1].n - a[1].n)) {
      console.log(`  ${String(v.n).padStart(4)}  ${ley.padEnd(30)} oficiales:${v.ofi}  servidas:${v.servidas}`)
    }
    console.log('\n→ elige una:  npm run enunciados:sin-norma -- --ley "<short_name>"\n')
    return
  }

  const objetivo = filas.filter((f: any) => (f.ley ?? '') === LEY)
  if (!objetivo.length) { console.error(`No hay preguntas marcadas para la ley "${LEY}".`); process.exit(2) }

  const oficiales = objetivo.filter((f: any) => f.is_official_exam)
  const editables = objetivo.filter((f: any) => !f.is_official_exam)
  const nombre = objetivo[0].ley_nombre || LEY
  console.log(`\nLEY: ${nombre}`)
  console.log(`  marcadas: ${objetivo.length} · editables: ${editables.length} · OFICIALES que se saltan: ${oficiales.length}\n`)

  const cambios: Array<{ id: string; antes: string; despues: string }> = []
  const sinTocar: string[] = []
  for (const f of editables) {
    const nuevo = nombrarNorma(f.question_text, nombre)
    if (!nuevo || nuevo === f.question_text) { sinTocar.push(f.id); continue }
    // Guarda: tras el arreglo, el detector ya no debe marcarla. Si la marca, algo no encaja
    // y esa pregunta se deja para revisión humana en vez de escribir una reparación a medias.
    if (classifyAutocontenida({ questionText: nuevo }).flagged) { sinTocar.push(f.id); continue }
    cambios.push({ id: f.id, antes: f.question_text, despues: nuevo })
  }

  console.log(`  reparables: ${cambios.length}${sinTocar.length ? ` · a revisión humana: ${sinTocar.length}` : ''}\n`)
  for (const c of cambios.slice(0, APPLY ? 3 : 12)) {
    console.log(`  · ${c.id.slice(0, 8)}`)
    console.log(`      ANTES : ${c.antes.replace(/\s+/g, ' ').slice(0, 120)}`)
    console.log(`      DESPUÉS: ${c.despues.replace(/\s+/g, ' ').slice(0, 120)}`)
  }
  for (const id of sinTocar.slice(0, 5)) console.log(`  ✋ ${id.slice(0, 8)} — el detector la seguiría marcando; revisión humana`)

  if (!APPLY) { console.log('\n(dry-run — repite con --apply)\n'); return }

  for (const c of cambios) {
    await db.execute(sql`UPDATE questions SET question_text = ${c.despues}, updated_at = NOW() WHERE id = ${c.id}::uuid`)
  }
  try {
    await db.execute(sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:reparar-enunciado-sin-norma', 'info',
              'enunciado_norma_nombrada',
              ${JSON.stringify({ ley: LEY, reparadas: cambios.length, sin_tocar: sinTocar.length })}::jsonb, NOW())`)
  } catch (e) {
    console.error(`⚠️  no se pudo registrar el evento: ${(e as Error).message}`)
  }
  console.log(`\n✅ ${cambios.length} enunciado(s) ahora nombran su norma.\n`)
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
}
