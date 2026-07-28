/**
 * sim-chat-had-error.mts — ¿`esRespuestaDeError` reconoce los errores REALES que el chat ya
 * sirvió, sin marcar respuestas buenas? (T-247bis, 28/07/2026)
 *
 * Uso:  npx tsx scripts/sim/sim-chat-had-error.mts
 *
 * Los tests unitarios fijan el criterio con ejemplos escritos por mí; esto lo contrasta con
 * los 15.000+ mensajes REALES de `ai_chat_logs`, que es donde aparecen las variantes que uno
 * no se inventa. Mide las dos direcciones: cuántos errores reconoce (recall) y cuántas
 * respuestas normales marcaría por error (falsos positivos), porque un detector ruidoso
 * acaba ignorándose y sería peor que no tenerlo.
 */
import 'dotenv/config'
import fs from 'fs'
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
const url = fs.readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.*)$/m)![1].trim()
process.env.DATABASE_URL = url
const { esRespuestaDeError } = await import('../../lib/chat/shared/errorResponses.ts')
const postgres = (await import('postgres')).default
const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30, onnotice: () => {} })

const filas = await sql<{ id: string; full_response: string | null; had_error: boolean }[]>`
  SELECT id, full_response, had_error FROM ai_chat_logs WHERE full_response IS NOT NULL`

// Verdad de referencia: la traza del LLM dice si el proveedor falló. Es independiente del
// texto, así que sirve para juzgar al detector sin razonar en círculo.
const fallidos = new Set(
  (await sql<{ log_id: string }[]>`
    SELECT DISTINCT log_id FROM ai_chat_traces
    WHERE trace_type = 'llm_call' AND (NOT success OR output_data ? 'errorStatus')`).map((r) => r.log_id),
)

let tp = 0, fn = 0, fp = 0, tn = 0
const ejemplosFP: string[] = []
const ejemplosFN: string[] = []
for (const f of filas) {
  const detectado = esRespuestaDeError(f.full_response)
  const realmenteFallo = fallidos.has(f.id)
  if (realmenteFallo && detectado) tp++
  else if (realmenteFallo && !detectado) { fn++; if (ejemplosFN.length < 3) ejemplosFN.push((f.full_response || '').slice(0, 90)) }
  else if (!realmenteFallo && detectado) { fp++; if (ejemplosFP.length < 3) ejemplosFP.push((f.full_response || '').slice(0, 90)) }
  else tn++
}

console.log(`mensajes analizados: ${filas.length}`)
console.log(`el proveedor falló en: ${fallidos.size}`)
console.log(`  ✅ detectados (recall):     ${tp}/${tp + fn}`)
console.log(`  ⚠️ NO detectados:          ${fn}${ejemplosFN.length ? ' → ' + ejemplosFN.join(' | ') : ''}`)
console.log(`  ⚠️ marcados sin fallo (FP): ${fp}${ejemplosFP.length ? ' → ' + ejemplosFP.join(' | ') : ''}`)
console.log(`  respuestas buenas no marcadas: ${tn}`)

const yaMarcados = filas.filter((f) => f.had_error).length
const marcariaAhora = filas.filter((f) => esRespuestaDeError(f.full_response)).length
console.log(`\nhad_error en BD hoy: ${yaMarcados}  →  con el arreglo se marcarían: ${marcariaAhora}`)
await sql.end({ timeout: 5 })
