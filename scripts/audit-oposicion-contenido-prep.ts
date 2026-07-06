// scripts/audit-oposicion-contenido-prep.ts
//
// CAPA 3 (corrección de contenido, prep determinista). Vuelca a JSON, por tema:
// epígrafe oficial + programa_url + scope (leyes/artículos) + muestra de preguntas
// con el contenido LITERAL de su artículo. Ese JSON lo consumen agentes (LLM) que
// juzgan lo que un script NO puede: fidelidad scope↔epígrafe y corrección de las
// preguntas vs su artículo. Complementa audit:oposicion (completitud) y audit:epigrafe.
//
//   npm run audit:oposicion-contenido <slug> [muestra_por_tema=4]
//   → escribe /tmp/<slug>_contenido_audit.json + imprime el prompt de agente
//
// Reusable: cualquier oposición. Determinista (solo lee BD). La pasada de agentes
// se lanza aparte (Workflow / Agent en paralelo) leyendo el JSON.

import postgres from 'postgres'
import * as fs from 'fs'

const slug = process.argv[2]
const SAMPLE = parseInt(process.argv[3] || '4', 10)
if (!slug) { console.error('Uso: ... <slug> [muestra_por_tema]'); process.exit(2) }
const PT = slug.replace(/-/g, '_')
// Agnóstico a la BD: postgres-js sobre DATABASE_URL (RDS/Neon/…), NO Supabase.
const DB_URL = process.env.DATABASE_URL
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado (agnóstico: RDS/Neon; NO Supabase). Ver db/client.ts'); process.exit(2) }
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} })
async function rows(q: any): Promise<any[]> { return await q }
const LETTER = ['A', 'B', 'C', 'D']

async function main() {
  const opo = (await rows(sql`SELECT programa_url, diario_referencia FROM oposiciones WHERE slug = ${slug}`))[0]
  const topics = await rows(sql`SELECT id, topic_number, title, epigrafe, disponible FROM topics WHERE position_type = ${PT} AND disponible = true ORDER BY topic_number`)
  if (!topics?.length) { console.error('Sin topics disponibles'); process.exit(2) }

  const out: any = { slug, position_type: PT, programa_url: opo?.programa_url, diario: opo?.diario_referencia, topics: [] }

  for (const t of topics) {
    const sc = await rows(sql`
      SELECT ts.law_id, ts.article_numbers, ts.include_full_title, l.short_name AS law_short_name
      FROM topic_scope ts LEFT JOIN laws l ON l.id = ts.law_id
      WHERE ts.topic_id = ${t.id}`)
    const scopeDesc = sc.map((x: any) => `${x.law_short_name}${x.include_full_title ? ' (ley completa)' : ': arts ' + (x.article_numbers || []).join(',')}`)

    // resolver artículos del scope → muestrear preguntas
    let artIds: string[] = []
    for (const e of sc) {
      const a = (!e.include_full_title && e.article_numbers)
        ? await rows(sql`SELECT id FROM articles WHERE law_id = ${e.law_id} AND article_number = ANY(${e.article_numbers}::text[])`)
        : await rows(sql`SELECT id FROM articles WHERE law_id = ${e.law_id}`)
      artIds.push(...a.map((x: any) => x.id))
    }
    // muestra de preguntas (las primeras SAMPLE activas del scope)
    const sample: any[] = []
    if (artIds.length) {
      const qs = await rows(sql`
        SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.explanation,
               a.article_number AS art_number, a.content AS art_content, l.short_name AS law_short_name
        FROM questions q
        JOIN articles a ON a.id = q.primary_article_id
        LEFT JOIN laws l ON l.id = a.law_id
        WHERE q.primary_article_id = ANY(${artIds.slice(0, 500)}::uuid[]) AND q.is_active = true
        LIMIT ${SAMPLE}`)
      for (const q of qs) {
        sample.push({
          id: q.id,
          enunciado: q.question_text,
          opciones: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
          correcta: LETTER[q.correct_option],
          explicacion: q.explanation,
          ley: q.law_short_name,
          articulo: q.art_number,
          articulo_contenido: (q.art_content || '').slice(0, 1800),
        })
      }
    }
    out.topics.push({ tema: t.topic_number, titulo: t.title, epigrafe: t.epigrafe, scope: scopeDesc, muestra_preguntas: sample })
  }

  const file = `/tmp/${slug}_contenido_audit.json`
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(`✅ Volcado ${out.topics.length} temas (muestra ${SAMPLE}/tema) → ${file}`)
  console.log(`\n📋 PROMPT para cada agente (asignar un subconjunto de temas a cada uno):`)
  console.log(`---
Eres auditor de contenido de oposiciones. Lee ${file}. Para los temas {RANGO}, evalúa:
1) FIDELIDAD scope↔epígrafe: ¿las leyes/artículos del 'scope' cubren la materia del 'epigrafe' oficial? ¿sobra o falta alguna ley clave? (NO marques como error un proxy: una ley estatal/local que regula la materia descrita aunque el epígrafe no la cite por número es correcto.)
2) CORRECCIÓN de cada pregunta de 'muestra_preguntas': ¿la opción 'correcta' es realmente correcta según 'articulo_contenido'? ¿la 'explicacion' es coherente? Marca SOLO errores reales (respuesta incorrecta, opción correcta que contradice el artículo).
Devuelve por tema: veredicto OK | REVISAR + motivo conciso. Sé estricto pero no inventes problemas.
---`)
}
main().then(() => process.exit(0)).catch(e => { console.error(e?.message || e); process.exit(2) })
