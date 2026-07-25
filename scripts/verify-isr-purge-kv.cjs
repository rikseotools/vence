#!/usr/bin/env node
/**
 * verify-isr-purge-kv.cjs — CAPA DE INTEGRACIÓN del registro de purgas ISR.
 *
 * Verifica contra el KV REAL (el que diga `CACHE_PROVIDER`: Upstash hoy,
 * ElastiCache en VPC mañana) que la semántica en la que se apoya el mecanismo se
 * cumple de verdad: HINCRBY acumula por campo, HGETALL devuelve todos los campos,
 * y los contadores vuelven como NÚMEROS.
 *
 * POR QUÉ NO ES UN TEST DE JEST (medido 26/07/2026): `jest.setup.js` hace
 * `global.fetch = jest.fn()` para toda la suite y el sink de Upstash habla por
 * REST. Dentro de jest, hasta el cliente de Upstash devuelve vacío sin error —
 * un test allí habría pasado en verde contra un KV fantasma, que es peor que no
 * tenerlo. Los demás tests de integración del repo no lo sufren porque van por
 * TCP con `pg`. Así que esta capa vive fuera de jest, como los canary.
 *
 * POR QUÉ IMPORTA EL TIPO NUMÉRICO: el diff compara con `>`. Si un proveedor
 * devolviese los contadores como texto, la comparación sería lexicográfica
 * ("10" < "9") y se perderían purgas en silencio. Es el punto exacto por donde
 * un cambio de proveedor rompería el mecanismo sin avisar.
 *
 * Uso:  node scripts/verify-isr-purge-kv.cjs
 * Exit 1 si el KV no cumple el contrato; 2 si no hay KV configurado.
 */
require('dotenv').config({ path: '.env.local' })

const CLAVE = `isr_purge_log_verify:${process.pid}`
let fallos = 0

function comprobar(descripcion, condicion, detalle) {
  if (condicion) {
    console.log(`   ✅ ${descripcion}`)
  } else {
    console.error(`   ❌ ${descripcion}${detalle ? ` — ${detalle}` : ''}`)
    fallos++
  }
}

;(async () => {
  // El sink (lib/cache/sink.ts) es TypeScript; desde CJS se habla con el mismo
  // proveedor y las mismas env que él usa por dentro, para no arrastrar un
  // transpilador solo para esto. Lo que se verifica es el CONTRATO del KV, que es
  // justo lo que el sink da por supuesto.
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if ((process.env.CACHE_PROVIDER || 'upstash').toLowerCase() === 'upstash' && (!url || !token)) {
    console.error('⚠️  sin credenciales de KV (UPSTASH_REDIS_REST_*) — no se puede verificar')
    process.exit(2)
  }

  const { Redis } = require('@upstash/redis')
  const kv = new Redis({ url, token })
  console.log(`🔌 verificando contrato del KV para el registro de purgas ISR (${CLAVE})`)

  try {
    // 1) HINCRBY crea el campo y acumula
    const p1 = await kv.hincrby(CLAVE, '/ruta-a', 1)
    comprobar('HINCRBY crea el campo devolviendo 1', p1 === 1, `devolvió ${p1}`)
    const p2 = await kv.hincrby(CLAVE, '/ruta-a', 1)
    comprobar('HINCRBY acumula sobre el valor previo', p2 === 2, `devolvió ${p2}`)

    // 2) Varios campos conviven (una entrada por ruta)
    await kv.hincrby(CLAVE, '/ruta-b', 1)
    await kv.hincrby(CLAVE, '/ruta-c', 1)
    const snap = await kv.hgetall(CLAVE)
    const claves = Object.keys(snap || {}).sort()
    comprobar(
      'HGETALL devuelve TODOS los campos escritos',
      ['/ruta-a', '/ruta-b', '/ruta-c'].every((k) => claves.includes(k)),
      `devolvió [${claves.join(', ')}]`
    )

    // 3) Los contadores son NÚMEROS (si no, el diff compararía como texto)
    const tipos = Object.values(snap || {}).map((v) => typeof v)
    comprobar(
      'los contadores vuelven como number (no string)',
      tipos.every((t) => t === 'number'),
      `tipos: ${[...new Set(tipos)].join(', ')}`
    )

    // 4) EXPIRE deja el hash vivo (el TTL acota el crecimiento sin borrarlo ya)
    await kv.expire(CLAVE, 300)
    const ttl = await kv.ttl(CLAVE)
    comprobar('EXPIRE fija un TTL positivo', typeof ttl === 'number' && ttl > 0, `ttl=${ttl}`)

    // 5) Un hash inexistente se lee vacío, no como error
    const vacio = await kv.hgetall(`${CLAVE}:no-existe`)
    comprobar(
      'un hash inexistente se lee como vacío/null, sin lanzar',
      vacio === null || Object.keys(vacio).length === 0,
      JSON.stringify(vacio)
    )
  } finally {
    await kv.del(CLAVE).catch(() => {})
  }

  if (fallos) {
    console.error(`\n❌ ${fallos} comprobación(es) fallaron — el KV NO cumple lo que el mecanismo asume.`)
    process.exit(1)
  }
  console.log('\n✅ el KV cumple el contrato del registro de purgas ISR.')
})().catch((e) => {
  console.error('❌ verificación reventó:', e.message)
  process.exit(1)
})
