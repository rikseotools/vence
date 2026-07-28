/**
 * sim-app-help-dificultad.mts — ¿los patrones de DIFICULTAD capturan lo que deben sin robarle
 * mensajes a los demás dominios? (28/07/2026)
 *
 * Uso:  npx tsx scripts/sim/sim-app-help-dificultad.mts
 *
 * `app-help` tiene prioridad 1.7, por encima de `search` y `verification`: todo lo que capture
 * de más se lo QUITA a quien hoy lo responde bien. Por eso esto se simula ANTES de encender:
 * se reproyecta la decisión sobre los mensajes REALES de `ai_chat_logs` y se mira, uno por uno,
 * a quién se lo quitaría.
 *
 * Se usan las funciones REALES (los patrones y `findBestFeatureMatch`), no copias.
 */
import 'dotenv/config'
import fs from 'fs'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const url = fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)![1].trim()
process.env.DATABASE_URL = url
const { DIFICULTAD_PATTERNS } = await import('../../lib/chat/domains/app-help/AppHelpDomain.ts')
const { findBestFeatureMatch } = await import('../../lib/chat/domains/app-help/catalog.ts')
const postgres = (await import('postgres')).default
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30, onnotice: () => {} })

// Solo chat libre: app-help se inhibe si hay questionContext (ver canHandle).
const filas = await sql<{ id: string; message: string; feedback: string | null; dom: string | null; ctx: string | null }[]>`
  SELECT l.id, l.message, l.feedback, l.question_context_id::text ctx,
         (SELECT t.output_data->>'selectedDomain' FROM ai_chat_traces t
           WHERE t.log_id = l.id AND t.trace_type='routing' LIMIT 1) dom
  FROM ai_chat_logs l
  WHERE l.message IS NOT NULL AND l.suggestion_used IS NULL`

const capturados: { msg: string; antes: string; feedback: string | null }[] = []
for (const f of filas) {
  if (f.ctx) continue                                   // con pregunta abierta, app-help no entra
  if (!DIFICULTAD_PATTERNS.some((p) => p.test(f.message))) continue
  if (!findBestFeatureMatch(f.message)) continue        // 2ª condición: sin feature, no captura
  capturados.push({ msg: f.message.replace(/\s+/g, ' ').slice(0, 100), antes: f.dom ?? '(sin traza)', feedback: f.feedback })
}

console.log(`mensajes de chat libre analizados: ${filas.length}`)
console.log(`capturaría ahora app-help: ${capturados.length}`)
const porDominio = capturados.reduce<Record<string, number>>((a, c) => ((a[c.antes] = (a[c.antes] || 0) + 1), a), {})
console.log('\na quién se lo quita:')
for (const [d, n] of Object.entries(porDominio).sort((a, b) => b[1] - a[1])) console.log(`  ${d.padEnd(18)} ${n}`)

const conValoracion = capturados.filter((c) => c.feedback)
console.log(`\nde los capturados, valorados por el usuario: ${conValoracion.length}`)
console.log(`  👎 negativos (los que HOY van mal → mejorarían): ${conValoracion.filter((c) => c.feedback === 'negative').length}`)
console.log(`  👍 positivos (RIESGO: hoy van bien y se los quitamos): ${conValoracion.filter((c) => c.feedback === 'positive').length}`)
for (const c of conValoracion.filter((x) => x.feedback === 'positive')) console.log(`      ⚠️ ${c.antes}: ${c.msg}`)

console.log('\nmuestra de lo que capturaría:')
capturados.slice(0, 12).forEach((c) => console.log(`  [${c.antes}${c.feedback ? '/' + c.feedback : ''}] ${c.msg}`))
await sql.end({ timeout: 5 })
