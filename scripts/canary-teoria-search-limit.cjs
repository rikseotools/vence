#!/usr/bin/env node
// scripts/canary-teoria-search-limit.cjs
//
// CANARY del gate de búsquedas de /teoria (contra prod, anónimo por device-id).
// Vigila lo que unit/typecheck no ven: que el límite REALMENTE bloquea en prod
// (Redis vivo + identidad + endpoint desplegado). Un fallo = pagos-adjacent:
// o no limita (fuga de valor) o bloquea de más (fricción/soporte).
//
// Regla: con un device-id nuevo, las primeras 5 búsquedas → 200, la 6ª → 429.
// (freeLimit=5). Premium no se prueba aquí (requiere token); lo cubre el unit.
//
// Uso:  node scripts/canary-teoria-search-limit.cjs [https://www.vence.es]

const BASE = process.argv[2] || 'https://www.vence.es'
const FREE_LIMIT = 5

async function main() {
  // device-id único → cubo aislado, no colisiona con usuarios reales; resetea a medianoche UTC.
  const dev = `canary-teoria-${Math.floor(process.hrtime()[1]).toString(36)}-${process.pid.toString(36)}`
  const fails = []
  let last = null

  for (let i = 1; i <= FREE_LIMIT + 1; i++) {
    const res = await fetch(`${BASE}/api/teoria/search?q=constitucion`, {
      headers: { 'X-Device-Id': dev },
    })
    const body = await res.json().catch(() => ({}))
    last = { i, status: res.status, body }
    const expectAllowed = i <= FREE_LIMIT
    const ok = expectAllowed ? res.status === 200 : res.status === 429
    console.log(`  búsqueda #${i} → HTTP ${res.status} ${ok ? '✅' : '❌'}` +
      (body.remaining != null ? ` (remaining=${body.remaining})` : ''))
    if (!ok) fails.push(`búsqueda #${i}: esperaba ${expectAllowed ? 200 : 429}, obtuvo ${res.status}`)
  }

  if (fails.length) {
    console.error(`\n❌ CANARY teoria-search-limit FALLA (${fails.length}):`)
    fails.forEach((f) => console.error(`   - ${f}`))
    console.error('   último:', JSON.stringify(last))
    process.exit(1)
  }
  console.log(`\n✅ CANARY teoria-search-limit OK (5 permitidas, 6ª bloqueada) contra ${BASE}`)
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1) })
