// Self-test del shim agnóstico contra RDS. `node scripts/lib/pg-agnostic-client.selftest.cjs`
// Lecturas contra tablas reales (solo SELECT) + escrituras sobre una tabla scratch
// que se crea y se elimina. Exit 1 si algo falla.
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { createClient } = require('./pg-agnostic-client.cjs')

let fails = 0
const ok = (cond, msg) => { console.log((cond ? '  ✅ ' : '  ❌ ') + msg); if (!cond) fails++ }

;(async () => {
  const c = createClient()
  const raw = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: 'require', onnotice: () => {} })
  const T = '_shim_selftest'

  try {
    // ---------- LECTURAS contra oposiciones (solo SELECT) ----------
    const r1 = await c.from('oposiciones').select('slug, estado_proceso, is_active').eq('is_active', true).limit(3)
    ok(!r1.error && Array.isArray(r1.data) && r1.data.length > 0 && 'slug' in r1.data[0], 'select + eq + limit → filas')

    const r2 = await c.from('oposiciones').select('*', { count: 'exact', head: true }).eq('is_active', true)
    ok(!r2.error && r2.data === null && typeof r2.count === 'number' && r2.count > 0, `count+head → count=${r2.count}, data=null`)

    const known = r1.data[0].slug
    const r3 = await c.from('oposiciones').select('slug, nombre').eq('slug', known).single()
    ok(!r3.error && r3.data && r3.data.slug === known && !Array.isArray(r3.data), 'single → objeto único')

    const r4 = await c.from('oposiciones').select('slug').single()
    ok(r4.error && r4.data === null, 'single con >1 fila → error (no lanza)')

    const r5 = await c.from('oposiciones').select('slug').eq('slug', '__no_existe__').maybeSingle()
    ok(!r5.error && r5.data === null, 'maybeSingle sin filas → data=null, sin error')

    const r6 = await c.from('oposiciones').select('slug, estado_proceso').in('estado_proceso', ['inscripcion_abierta', 'lista_admitidos']).limit(2)
    ok(!r6.error && Array.isArray(r6.data), 'in(array) → filas')

    const r7 = await c.from('oposiciones').select('slug').ilike('nombre', '%administrativo%').limit(2)
    ok(!r7.error && r7.data.length > 0, 'ilike → filas')

    const r8 = await c.from('oposiciones').select('slug').is('exam_date', null).limit(1)
    ok(!r8.error, 'is null → ok')
    const r9 = await c.from('oposiciones').select('slug').not('exam_date', 'is', null).limit(1)
    ok(!r9.error, 'not is null → ok')

    const r10 = await c.from('oposiciones').select('slug').eq('is_active', true).order('slug', { ascending: false }).limit(2)
    ok(!r10.error && r10.data.length === 2, 'order desc + limit → ok')

    // ---------- ESCRITURAS sobre tabla scratch ----------
    await raw`DROP TABLE IF EXISTS ${raw(T)}`
    await raw`CREATE TABLE ${raw(T)} (id int PRIMARY KEY, name text, n int)`

    const w1 = await c.from(T).insert([{ id: 1, name: 'a', n: 10 }, { id: 2, name: 'b', n: 20 }])
    ok(!w1.error && w1.data.length === 2, 'insert (bulk) → 2 filas devueltas')

    const w2 = await c.from(T).upsert({ id: 1, name: 'a2', n: 11 }, { onConflict: 'id' })
    ok(!w2.error && w2.data[0].name === 'a2', 'upsert onConflict → actualiza existente')

    const w3 = await c.from(T).upsert({ id: 3, name: 'c', n: 30 }, { onConflict: 'id' })
    ok(!w3.error && w3.data[0].id === 3, 'upsert onConflict → inserta nuevo')

    const w4 = await c.from(T).update({ n: 99 }).eq('id', 2)
    ok(!w4.error && w4.data[0].n === 99, 'update + eq → cambia fila')

    const cnt = await c.from(T).select('*', { count: 'exact', head: true })
    ok(!cnt.error && cnt.count === 3, `count sobre scratch = ${cnt.count} (esperado 3)`)

    const w5 = await c.from(T).delete().eq('id', 1)
    ok(!w5.error && w5.data.length === 1, 'delete + eq → borra 1')

    const cnt2 = await c.from(T).select('*', { count: 'exact', head: true })
    ok(!cnt2.error && cnt2.count === 2, `count tras delete = ${cnt2.count} (esperado 2)`)

    // ---------- NO soportado falla ruidosamente ----------
    let threw = false
    try { c.from('x').or('a.eq.1') } catch { threw = true }
    ok(threw, '.or() lanza error claro (no soporte silencioso)')

    await raw`DROP TABLE IF EXISTS ${raw(T)}`
  } catch (e) {
    console.error('  ❌ EXCEPCIÓN:', e.message)
    fails++
    try { await raw`DROP TABLE IF EXISTS ${raw(T)}` } catch {}
  } finally {
    await c.end()
    await raw.end({ timeout: 5 })
  }

  console.log(`\n━━━ ${fails === 0 ? '✅ TODO OK' : '❌ ' + fails + ' FALLOS'} ━━━`)
  process.exit(fails ? 1 : 0)
})()
