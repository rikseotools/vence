#!/usr/bin/env node
// scripts/reparar-vinetas-correctas-invertidas.cjs — T-219, defecto C
//
// Capa de I/O del núcleo puro `lib/health/vinetasCorrectasInvertidas.cjs` (ver ahí el porqué
// completo). El TERCER marco contradictorio de T-219, inverso de los otros dos: la cabecera
// «las demás son correctas» está bien, pero cada viñeta debajo dice «no es correcta».
//
// DRY-RUN por defecto. Escribe solo con --commit.

require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')
const { reparar, RE_HEAD } = require('../lib/health/vinetasCorrectasInvertidas.cjs')
const COMMIT = process.argv.includes('--commit')

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 3 })
  try {
    const filas = await sql`
      select id, explanation from questions
      where is_active = true
        and explanation ~* 'Por qué las demás( opciones)?( son)? correctas'`

    const reparables = [], sinPatron = []
    for (const q of filas) {
      const out = reparar(q.explanation)
      if (out && out !== q.explanation) reparables.push({ id: q.id, out })
      else sinPatron.push(q.id)
    }

    console.log(`${COMMIT ? '🚀 APLICANDO' : '🔍 DRY-RUN'} — ${filas.length} con cabecera «las demás son correctas»\n`)
    console.log(`  ✅ TODAS las viñetas invertidas (patrón sistemático de plantilla): ${reparables.length}`)
    console.log(`  ⏭️  sin patrón limpio (ya coherentes, o mezcla que exige lectura humana): ${sinPatron.length}`)

    if (reparables.length) {
      console.log('\n─── candidatas ───')
      reparables.forEach((r) => console.log('  ' + r.id.slice(0, 8)))
      const antes = filas.find((f) => f.id === reparables[0].id).explanation
      console.log(`\n─── ejemplo (${reparables[0].id.slice(0, 8)}) ───`)
      const bloqueAntes = antes.slice(antes.search(RE_HEAD)).split(/\n\n\*\*/)[0]
      const bloqueDespues = reparables[0].out.slice(reparables[0].out.search(RE_HEAD)).split(/\n\n\*\*/)[0]
      console.log('ANTES:\n' + bloqueAntes.trim())
      console.log('DESPUÉS:\n' + bloqueDespues.trim())
    }

    if (!COMMIT) { console.log('\n(dry-run: no se ha escrito nada)'); return }
    let n = 0
    for (const r of reparables) {
      await sql`update questions set explanation = ${r.out} where id = ${r.id}`
      n++
    }
    console.log(`\n✅ ${n} explicación(es) reparada(s).`)
  } finally { await sql.end() }
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
