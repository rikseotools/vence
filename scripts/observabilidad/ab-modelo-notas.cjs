#!/usr/bin/env node
// scripts/observabilidad/ab-modelo-notas.cjs
//
// A/B de MODELOS para `detect_notas`: mismo prompt, mismos documentos reales, varios modelos.
// Compara campo a campo lo que extrae cada uno, con su coste y su latencia. **No escribe en BD.**
//
//   npm run llm:ab-notas -- --docs 6                      # Haiku (actual) vs Kimi vs gpt-4o-mini
//   npm run llm:ab-notas -- --docs 6 --recorte            # además, con el texto ya recortado
//   npm run llm:ab-notas -- --modelos anthropic/claude-haiku-4-5,moonshotai/kimi-k2-thinking
//
// ## Por qué existe (26/07/2026)
//
// `detect_notas` se lleva el 56% del saldo y corre con Haiku 4.5 ($1/$5 por millón). Hay modelos
// por debajo —Kimi K2 en OpenRouter está a $0,60/$2,50— pero **cambiar de modelo a ciegas en algo
// que escribe en la BD es como se meten datos malos sin que nadie se entere**. El proyecto ya
// aprendió esto en T-013: los baratos sirven para volumen y pre-filtro, y hay que MEDIR antes,
// caso por caso, porque fallan en bloque en los casos-borde.
//
// Esto no cambia nada: mide. La decisión, con los números delante, es de Manuel.
//
// Todo va por OpenRouter (una sola clave, `OPENROUTER_API_KEY`), que además da el coste real de
// cada llamada en su respuesta — así el número no es una estimación nuestra.

require('dotenv').config({ path: '.env.local' })
const path = require('path')
const postgres = require('postgres')
const { recortarParaNotas } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'notasRecorte.cjs'))

const argv = process.argv.slice(2)
const val = (f, d) => {
  const i = argv.indexOf(f)
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d
}
const N_DOCS = parseInt(val('--docs', '6'), 10)
const CON_RECORTE = argv.includes('--recorte')
const MODELOS = val('--modelos', 'anthropic/claude-haiku-4.5,moonshotai/kimi-k2-thinking,openai/gpt-4o-mini').split(',')

// Mismo prompt que produce el backend (`buildNotasPrompt`), reducido a lo esencial para el A/B.
function prompt(texto) {
  return `Eres analista de oposiciones. Lee el texto de una convocatoria española y extrae SOLO lo que afecte al contenido de las preguntas de examen.
Devuelve EXCLUSIVAMENTE un JSON válido: {"software_versions":{"windows":null,"word":null,"excel":null,"office_o_365":null,"otros":null},"fecha_examen":null,"criterio_version":null,"material_permitido":null,"penalizacion":null,"confianza":"alta|media|baja"}
Si un dato no aparece, null. NO inventes. Texto:\n\n${texto}`
}

function parseJson(raw) {
  const limpio = String(raw || '').trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(limpio)
  } catch {
    const a = limpio.indexOf('{')
    const b = limpio.lastIndexOf('}')
    if (a >= 0 && b > a) { try { return JSON.parse(limpio.slice(a, b + 1)) } catch { return null } }
    return null
  }
}

/**
 * Registra la llamada en el MISMO stream que el resto del gasto (`observable_events`,
 * `llm_call`). Lo pide el guardarraíl de cobertura y es de justicia: una herramienta que existe
 * para medir el gasto no puede ser ella misma gasto invisible. Usa el coste REAL de OpenRouter.
 */
async function recordLlmCall(sql, r) {
  try {
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:ab-modelo-notas', ${r.ok ? 'info' : 'warn'}, 'llm_call',
              ${sql.json({
                ok: r.ok,
                provider: 'openrouter',
                model: r.modelo,
                feature: 'ab_notas',
                billing: 'api',
                inputTokens: r.inTok || 0,
                outputTokens: r.outTok || 0,
                totalTokens: (r.inTok || 0) + (r.outTok || 0),
                estimatedCostUsd: r.usd || 0,
              })}, NOW())`
  } catch {
    /* la observabilidad nunca rompe la medición */
  }
}

async function llamar(modelo, texto) {
  const t0 = Date.now()
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://www.vence.es',
      'X-Title': 'vence-ab-notas',
    },
    body: JSON.stringify({ model: modelo, max_tokens: 900, messages: [{ role: 'user', content: prompt(texto) }], usage: { include: true } }),
    signal: AbortSignal.timeout(120000),
  })
  const j = await r.json().catch(() => ({}))
  const ms = Date.now() - t0
  if (!r.ok) return { ok: false, ms, error: `${r.status} ${JSON.stringify(j).slice(0, 120)}` }
  const contenido = j.choices?.[0]?.message?.content ?? ''
  return {
    ok: true,
    ms,
    json: parseJson(contenido),
    // OpenRouter devuelve el coste REAL de la llamada; no hay que estimarlo.
    usd: j.usage?.cost ?? null,
    inTok: j.usage?.prompt_tokens ?? null,
    outTok: j.usage?.completion_tokens ?? null,
  }
}

/** Compara dos extracciones campo a campo. Devuelve los campos en los que difieren. */
function diferencias(a, b) {
  if (!a || !b) return ['(alguna respuesta no es JSON)']
  const campos = ['fecha_examen', 'criterio_version', 'material_permitido', 'penalizacion']
  const out = []
  for (const c of campos) if (JSON.stringify(a[c] ?? null) !== JSON.stringify(b[c] ?? null)) out.push(c)
  const sa = a.software_versions || {}
  const sb = b.software_versions || {}
  for (const k of ['windows', 'word', 'excel', 'office_o_365']) {
    if (JSON.stringify(sa[k] ?? null) !== JSON.stringify(sb[k] ?? null)) out.push(`software.${k}`)
  }
  return out
}

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ falta OPENROUTER_API_KEY en .env.local')
    process.exit(2)
  }
  const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 2, ssl: { rejectUnauthorized: false }, onnotice: () => {} })
  const sqlObs = sql
  // Documentos con señal de software/fechas: son los que de verdad ejercitan la extracción.
  const docs = await sql`
    SELECT titulo, extracted_text t FROM convocatoria_documentos
    WHERE extracted_text IS NOT NULL AND length(extracted_text) BETWEEN 3000 AND 40000
      AND (extracted_text ILIKE '%windows%' OR extracted_text ILIKE '%ofim%' OR extracted_text ILIKE '%penaliza%')
    ORDER BY updated_at DESC NULLS LAST LIMIT ${N_DOCS}`
  if (!docs.length) {
    await sql.end()
    console.error('no hay documentos que cumplan el filtro')
    process.exit(1)
  }

  console.log(`\nA/B de modelos para detect_notas — ${docs.length} documentos reales${CON_RECORTE ? ' (texto RECORTADO)' : ''}`)
  console.log(`modelos: ${MODELOS.join(' · ')}\n`)

  const acumulado = new Map(MODELOS.map((m) => [m, { usd: 0, ms: 0, ok: 0, jsonOk: 0, inTok: 0 }]))
  const referencia = MODELOS[0]

  for (const [i, d] of docs.entries()) {
    const crudo = String(d.t).slice(0, 8000)
    const texto = CON_RECORTE ? recortarParaNotas(crudo).texto : crudo
    console.log(`── doc ${i + 1}/${docs.length} · ${String(d.titulo || '').slice(0, 60)} · ${texto.length} chars`)
    const res = {}
    for (const m of MODELOS) {
      const r = await llamar(m, texto)
      await recordLlmCall(sqlObs, { ...r, modelo: m })
      res[m] = r
      const a = acumulado.get(m)
      a.ms += r.ms
      if (r.ok) {
        a.ok++
        a.usd += r.usd || 0
        a.inTok += r.inTok || 0
        if (r.json) a.jsonOk++
      }
      console.log(`   ${m.padEnd(38)} ${r.ok ? `${String(r.ms).padStart(6)}ms · ${r.usd != null ? `$${r.usd.toFixed(5)}` : 's/coste'} · ${r.json ? 'JSON ok' : '❌ JSON inválido'}` : `❌ ${r.error}`}`)
    }
    for (const m of MODELOS.slice(1)) {
      const dif = diferencias(res[referencia]?.json, res[m]?.json)
      console.log(`      vs ${referencia.split('/')[1]}: ${dif.length ? `difiere en ${dif.join(', ')}` : '✅ misma extracción'}`)
    }
  }

  console.log('\n── TOTALES ──')
  for (const [m, a] of acumulado) {
    console.log(
      `   ${m.padEnd(38)} ${a.ok}/${docs.length} ok · ${a.jsonOk}/${docs.length} JSON válido · ` +
      `$${a.usd.toFixed(4)} · ${Math.round(a.ms / docs.length)}ms medio · ${a.inTok} tok in`,
    )
  }
  await sql.end()
  console.log('\nEsto NO cambia nada: es una medición (registrada en llm_call). La decisión, con los números delante.\n')
}

main().catch((e) => { console.error('❌', e.message); process.exit(1) })
