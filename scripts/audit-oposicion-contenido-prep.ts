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

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'

const slug = process.argv[2]
const SAMPLE = parseInt(process.argv[3] || '4', 10)
if (!slug) { console.error('Uso: ... <slug> [muestra_por_tema]'); process.exit(2) }
const PT = slug.replace(/-/g, '_')
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
const LETTER = ['A', 'B', 'C', 'D']

async function main() {
  const { data: opo } = await s.from('oposiciones').select('programa_url, diario_referencia').eq('slug', slug).single()
  const { data: topics } = await s.from('topics').select('id,topic_number,title,epigrafe,disponible').eq('position_type', PT).eq('disponible', true).order('topic_number')
  if (!topics?.length) { console.error('Sin topics disponibles'); process.exit(2) }

  const out: any = { slug, position_type: PT, programa_url: opo?.programa_url, diario: opo?.diario_referencia, topics: [] }

  for (const t of topics) {
    const { data: sc } = await s.from('topic_scope').select('law_id,article_numbers,include_full_title,laws:law_id(short_name)').eq('topic_id', t.id)
    const scopeDesc = (sc || []).map((x: any) => `${x.laws?.short_name}${x.include_full_title ? ' (ley completa)' : ': arts ' + (x.article_numbers || []).join(',')}`)

    // resolver artículos del scope → muestrear preguntas
    let artIds: string[] = []
    for (const e of sc || []) {
      let q = s.from('articles').select('id').eq('law_id', e.law_id)
      if (!e.include_full_title && e.article_numbers) q = q.in('article_number', e.article_numbers)
      const { data: a } = await q
      artIds.push(...(a || []).map((x: any) => x.id))
    }
    // muestra de preguntas (las primeras SAMPLE activas del scope)
    const sample: any[] = []
    if (artIds.length) {
      const { data: qs } = await s.from('questions')
        .select('id,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,primary_article_id,articles:primary_article_id(article_number,content,laws:law_id(short_name))')
        .in('primary_article_id', artIds.slice(0, 500)).eq('is_active', true).limit(SAMPLE)
      for (const q of qs || []) {
        const art: any = q.articles
        sample.push({
          id: q.id,
          enunciado: q.question_text,
          opciones: { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d },
          correcta: LETTER[q.correct_option],
          explicacion: q.explanation,
          ley: art?.laws?.short_name,
          articulo: art?.article_number,
          articulo_contenido: (art?.content || '').slice(0, 1800),
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
main().catch(e => { console.error(e?.message || e); process.exit(2) })
