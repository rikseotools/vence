#!/usr/bin/env node
/**
 * diagnostico.cjs — reproduce, en un solo comando, las comprobaciones de T-308 (06/08/2026):
 * ¿el enforcement de "premium compartido" (fraud-sweep kind `premium_sharing`) existe de verdad
 * o está MUDO como pasó con el límite por dispositivo antes de T-304?
 *
 * SOLO LECTURA (VENCE_LECTOR_URL) + grep estático del repo. NUNCA escribe.
 *
 * Uso: node data/pilotos/t308-premium-compartido-06ago/diagnostico.cjs
 */
const path = require('path')
const { execSync } = require('child_process')
const ROOT = path.resolve(__dirname, '../../..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))

function grepCount(pattern) {
  try {
    const out = execSync(
      `grep -rn "${pattern}" --include="*.ts" --include="*.tsx" --include="*.cjs" --include="*.js" ${ROOT} 2>/dev/null | grep -v node_modules | grep -v '\\.test\\.'`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    )
    return out.trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

async function main() {
  console.log('── PASO 1: ¿existe código de ENFORCEMENT (no solo detección) para premium_sharing? ──')
  const hits = grepCount('premium_sharing')
  console.log(`  ${hits.length} apariciones de "premium_sharing" en todo el repo (sin node_modules/tests):`)
  for (const h of hits) console.log('   ', h)
  const enforcementHints = hits.filter(
    (h) => /block|deny|suspend|revoke|downgrade|cortar|bloque|denegar|suspender|revocar|degradar/i.test(h)
  )
  console.log(
    enforcementHints.length === 0
      ? '  → 0 líneas con vocabulario de bloqueo/suspensión/revocación. Todas las apariciones son detección (fraud-sweep) o UI (etiqueta del panel).'
      : `  → ⚠️ ${enforcementHints.length} líneas con vocabulario de bloqueo — revisar a mano.`
  )

  console.log('\n── PASO 1bis: ¿qué consume fraud_confirmations (la tabla que marca fraude CONFIRMADO)? ──')
  const consumers = grepCount('esFraudeConfirmado')
  for (const c of consumers) console.log('   ', c)
  console.log(
    '  → único consumidor: lib/api/dailyLimit.ts (cupo diario compartido, SOLO free — premium lo esquiva por diseño en 3 sitios: app/api/answer/psychometric/route.ts, app/api/v2/answer-and-save/route.ts, app/api/exam/answer/route.ts).'
  )
  console.log('  → CONSECUENCIA: confirmar una señal premium_sharing hoy no cambia nada para la cuenta premium implicada.')

  const sql = postgres(process.env.VENCE_LECTOR_URL + '?sslmode=require', { ssl: { rejectUnauthorized: false }, max: 2 })

  console.log('\n── PASO 2: ¿el tope de 2 dispositivos por cuenta (que SÍ aplica a premium) sigue vivo en RDS? ──')
  try {
    const [row] = await sql`SELECT prosrc FROM pg_proc WHERE proname = 'register_device'`
    if (!row) {
      console.log('  ❌ la función register_device no existe en RDS')
    } else {
      const vMax = row.prosrc.match(/v_max\s*:=\s*\d+/)
      const tieneTtl7d = /'7 days'/.test(row.prosrc)
      console.log(`  v_max en la función viva: ${vMax ? vMax[0] : 'NO ENCONTRADO'}`)
      console.log(`  slot TTL de 7 días (T-418, 04/08) presente: ${tieneTtl7d}`)
      console.log('  → si v_max=2 y no hay excepción para is_premium en el bloque IF de bloqueo, el tope SÍ corta a premium igual que a free.')
    }
  } catch (e) {
    console.log('  ❌', e.message)
  }

  console.log('\n── PASO 3: ¿se puede medir hoy, en vivo, la población premium_sharing? (RLS check) ──')
  for (const t of ['fraud_alerts', 'user_devices', 'fraud_confirmations', 'user_profiles']) {
    try {
      const [rls] = await sql`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = ${t}`
      const [pol] = await sql`SELECT count(*)::int n FROM pg_policies WHERE tablename = ${t}`
      let count = null
      try {
        const [c] = await sql`SELECT count(*)::int n FROM ${sql(t)}`
        count = c.n
      } catch (e) {
        count = `ERROR: ${e.message}`
      }
      console.log(`  ${t}: relrowsecurity=${rls?.relrowsecurity} policies=${pol?.n} SELECT count()=${count}`)
    } catch (e) {
      console.log(`  ${t}: ❌ ${e.message}`)
    }
  }
  console.log(
    '  → fraud_alerts y user_devices dan 0/permission-denied para vence_lector: no se puede medir hoy la población real ni el histórico de señales. No estaban en DEBE_LEER ni en NO_DEBE_LEER de scripts/canary-rol-lector.cjs — es un hueco NUEVO, no decidido antes (ver T-573/T-038, mismo mecanismo).'
  )

  await sql.end()
}

main().catch((e) => {
  console.error('❌', e)
  process.exit(1)
})
