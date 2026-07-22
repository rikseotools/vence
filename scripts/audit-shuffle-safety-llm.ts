// Auditoría LLM de shuffle_safety (barajar-opciones verificación robusta, Paso 2).
// Segunda capa sobre el detector determinista: un ENSEMBLE de modelos baratos (OpenRouter,
// compatible OpenAI) revisa las 'safe' con "smell" y baja a 'unsafe' las que referencian
// una opción por LETRA/NÚMERO/POSICIÓN que el regex dejó pasar → 0-FN práctico.
//
// Sesgo 0-FN (union conservadora): se marca UNSAFE si CUALQUIER modelo detecta referencia
// posicional; solo se CONFIRMA safe si TODOS coinciden en que la explicación es por contenido.
// El modelo MARCA, no decide la clave (regla del manual). Escribe vía record_shuffle_safety.
//
// Manual: docs/maintenance/verificacion-modelos-gratis-openrouter.md.
// Diseño:  docs/roadmap/barajar-opciones-verificacion-robusta.md.
// Uso:
//   DATABASE_URL=... OPENROUTER_API_KEY=... NODE_TLS_REJECT_UNAUTHORIZED=0 \
//     npx tsx scripts/audit-shuffle-safety-llm.ts [--sample N] [--apply] [--concurrency K]
//   Sin --apply = DRY (mide, no escribe). --sample N = solo N aleatorias (para medir).
import { Client } from 'pg'

const APPLY = process.argv.includes('--apply')
const SAMPLE = Number((process.argv.find((a) => a.startsWith('--sample=')) || '').split('=')[1] || 0)
const CONCURRENCY = Number((process.argv.find((a) => a.startsWith('--concurrency=')) || '').split('=')[1] || 4)
// Umbral de votos para marcar UNSAFE. 2 = mayoría (medido: los FN reales sacan ≥2 votos;
// los FP suelen ser de 1 solo modelo). 1 = unión (más conservador, más coverage-loss).
const THRESHOLD = Number((process.argv.find((a) => a.startsWith('--threshold=')) || '').split('=')[1] || 2)
const VERIFIED_BY = 'llm_audit_v1'

// Modelos de pago baratos y fiables (manual §6: 12/12 JSON, sin 429, ~1s). Ensemble diverso.
const MODELS = ['openai/gpt-4o-mini', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat']

// Smell de alto recall: solo auditamos las 'safe' con algún token de letra/número/ordinal
// (las limpias no pueden referenciar posición). Reduce ~70k → ~9,5k.
const SMELL: RegExp[] = [
  /\b[ABCDE]\b/,
  /\b\d\b[^.]{0,40}(correct|incorrect|ciert|fals|verdader|v[áa]lid|anul|err[óo]ne)/i,
  /(correct|incorrect|ciert|fals|verdader|v[áa]lid)[^.]{0,40}\b\d\b/i,
  /\b(primer|segund|tercer|cuart|quint|[úu]ltim)\w*\b[^.]{0,40}(correct|incorrect|ciert|fals|verdader|opci|respuesta|alternativa|afirmaci)/i,
  /\b(opci[óo]n|respuesta|apartado|alternativa|afirmaci[óo]n|premisa)\w*\s+\d/i,
]
const smells = (e: string) => {
  const n = e.replace(/[*_`~]+/g, '').replace(/\s+/g, ' ')
  return SMELL.some((r) => r.test(n))
}

type Q = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string | null; option_e: string | null; explanation: string }

const SYSTEM =
  'Determinas si la EXPLICACIÓN de una pregunta tipo test identifica UNA OPCIÓN DE RESPUESTA concreta por su ETIQUETA (letra A/B/C/D/E o "opción/respuesta número N") o por su POSICIÓN en la lista (primera, última, anterior, la de arriba…), de modo que REORDENAR las opciones rompería la explicación. Responde SOLO con un objeto JSON válido.'

// Few-shot que separa ETIQUETA-de-opción (rompe al barajar) de letra/número de CONTENIDO
// (sobrevive). El error típico del modelo es marcar cualquier letra/número; hay que
// distinguir "cuál opción marcar" de un dato del enunciado.
const FEWSHOT = `Ejemplos:
- "La respuesta correcta es la B." -> {"references_position": true, "reason":"etiqueta de opción B"}
- "Las opciones 1 y 3 son correctas." -> {"references_position": true, "reason":"opciones por número"}
- "La primera opción es la válida." -> {"references_position": true, "reason":"posición"}
- "La temperatura del proceso es de 50-55 ºC." -> {"references_position": false, "reason":"50 es contenido (temperatura), no una opción"}
- "El Artículo 17 del Código Civil regula la filiación." -> {"references_position": false, "reason":"17 es un artículo de ley, no una opción"}
- "El Virus A (VHA) se transmite por vía fecal-oral." -> {"references_position": false, "reason":"A es parte del nombre, no una opción"}
- "SUCH A/AN va seguido de adjetivo + sustantivo." -> {"references_position": false, "reason":"gramática inglesa, no una opción"}
- "Madrid es la capital, por eso es la correcta." -> {"references_position": false, "reason":"identifica por contenido"}
- "Pasos del SVB: 1. Valorar consciencia. 2. Pedir ayuda. 3. Abrir vía aérea." -> {"references_position": false, "reason":"1/2/3 son pasos del procedimiento, no opciones"}
- "La respuesta correcta es Alt+H (pestaña Inicio de Excel)." -> {"references_position": false, "reason":"Alt+H es el CONTENIDO de la respuesta, no una etiqueta de opción"}
- "La correcta es 'Mi Oficina', la oficina virtual de Correos." -> {"references_position": false, "reason":"identifica por el nombre/contenido de la respuesta"}`

function userPrompt(q: Q): string {
  const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter((v) => v != null && v !== '')
  const letters = ['A', 'B', 'C', 'D', 'E']
  const listed = opts.map((o, i) => `${letters[i]}) ${o}`).join('\n')
  return `${FEWSHOT}

Ahora clasifica ESTA. Marca references_position=true SOLO si la explicación señala CUÁL opción es la respuesta por su letra/número-de-opción/posición (y por tanto reordenar las opciones la rompería). Si las letras/números que aparecen son CONTENIDO del tema (temperaturas, artículos de ley, años, cantidades, nombres, gramática), es false. Ante duda RAZONABLE de que sea etiqueta de opción, true.

Pregunta: ${q.question_text}
Opciones:
${listed}
Explicación: ${q.explanation}

Responde SOLO en json: {"references_position": true|false, "reason": "<breve>"}`
}

function parseJson(content: string): { references_position: boolean; reason?: string } | null {
  const m = content.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    const o = JSON.parse(m[0])
    if (typeof o.references_position === 'boolean') return o
  } catch {}
  return null
}

async function callModel(model: string, q: Q): Promise<{ ok: boolean; references_position?: boolean; reason?: string }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 30000)
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: userPrompt(q) },
          ],
          temperature: 0,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1))
        continue
      }
      if (!res.ok) {
        await sleep(1000)
        continue
      }
      const data = await res.json()
      const content = data.choices?.[0]?.message?.content
      const parsed = content ? parseJson(content) : null
      if (parsed) return { ok: true, references_position: parsed.references_position, reason: parsed.reason }
      await sleep(500)
    } catch {
      await sleep(1000)
    }
  }
  return { ok: false }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Ensemble por VOTOS. unsafe si nº de modelos que marcan referencia >= THRESHOLD; safe si no.
// Si ninguno respondió → indeterminado (no tocar). Devuelve también el reparto de votos.
async function classify(q: Q): Promise<{
  verdict: 'safe' | 'unsafe' | 'indeterminate'
  reason: string
  flaggers: number
  answered: number
}> {
  const results = await Promise.all(MODELS.map((m) => callModel(m, q).then((r) => ({ m, ...r }))))
  const answered = results.filter((r) => r.ok)
  if (answered.length === 0) return { verdict: 'indeterminate', reason: 'no_json_from_any_model', flaggers: 0, answered: 0 }
  const flags = answered.filter((r) => r.references_position === true)
  const verdict = flags.length >= THRESHOLD ? 'unsafe' : 'safe'
  const reason =
    verdict === 'unsafe'
      ? `llm_position_ref:${flags.length}/${answered.length}:${(flags[0]?.reason || '').slice(0, 70)}`
      : `llm_confirmed:${flags.length}/${answered.length}flag`
  return { verdict, reason, flaggers: flags.length, answered: answered.length }
}

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL!.replace(/[?&]sslmode=require/, ''),
    ssl: { rejectUnauthorized: false },
  })
  await c.connect()

  // Candidatas: safe con explicación, con smell, aún no auditadas por esta versión.
  const order = SAMPLE ? 'ORDER BY random()' : ''
  const rows = (
    await c.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d, option_e, explanation
         FROM questions
        WHERE is_active = true AND shuffle_safety = 'safe'
          AND explanation IS NOT NULL AND length(explanation) > 0
          AND shuffle_safety_verified_by IS DISTINCT FROM $1
        ${order}`,
      [VERIFIED_BY],
    )
  ).rows as Q[]

  const candidates = rows.filter((r) => smells(r.explanation))
  const work = SAMPLE ? candidates.slice(0, SAMPLE) : candidates
  console.log(`safe sin auditar: ${rows.length} | con smell (candidatas): ${candidates.length} | a procesar: ${work.length}${APPLY ? '' : ' (DRY)'}`)

  const tally = { safe: 0, unsafe: 0, indeterminate: 0 }
  const votes = { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number> // reparto de flaggers
  const unsafeSamples: string[] = []
  let done = 0

  // Concurrencia acotada.
  const queue = [...work]
  async function worker() {
    while (queue.length) {
      const q = queue.shift()!
      const r = await classify(q)
      tally[r.verdict]++
      if (r.answered > 0) votes[r.flaggers] = (votes[r.flaggers] || 0) + 1
      if (r.verdict === 'unsafe' && unsafeSamples.length < 15)
        unsafeSamples.push(`${r.reason} :: ${q.explanation.replace(/\s+/g, ' ').slice(0, 110)}`)
      if (APPLY && r.verdict !== 'indeterminate') {
        await c.query('SELECT record_shuffle_safety($1,$2,$3,$4)', [q.id, r.verdict, r.reason.slice(0, 200), VERIFIED_BY])
      }
      if (++done % 50 === 0) console.log(`  ${done}/${work.length} — safe ${tally.safe} unsafe ${tally.unsafe} indet ${tally.indeterminate}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, work.length) }, worker))

  const totalVoted = votes[0] + votes[1] + votes[2] + votes[3]
  console.log('\n=== RESULTADO ===')
  console.log(`umbral aplicado: ${THRESHOLD} voto(s) → UNSAFE`)
  console.log(`safe confirmadas: ${tally.safe} | UNSAFE (bajadas): ${tally.unsafe} | indeterminadas: ${tally.indeterminate}`)
  console.log('\nReparto de votos (nº de modelos que marcaron referencia):')
  console.log(`  0 votos (safe claro): ${votes[0]}`)
  console.log(`  1 voto  (unión→unsafe / mayoría→safe): ${votes[1]}`)
  console.log(`  2 votos (mayoría→unsafe): ${votes[2]}`)
  console.log(`  3 votos (unánime→unsafe): ${votes[3]}`)
  console.log(`\nUnsafe por umbral: unión(≥1)=${votes[1] + votes[2] + votes[3]} | mayoría(≥2)=${votes[2] + votes[3]} | unánime(3)=${votes[3]} (de ${totalVoted})`)
  console.log('\nMuestras UNSAFE detectadas (umbral actual):')
  for (const s of unsafeSamples) console.log('  -', s)
  if (!APPLY) console.log('\n(DRY RUN — nada escrito. Añade --apply para persistir con record_shuffle_safety.)')
  await c.end()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
