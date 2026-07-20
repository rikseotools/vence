#!/usr/bin/env node
/**
 * T-058 — Reglamento de las Cortes de Castilla y León: el art. 171 (último) se
 * "tragó" las Disposiciones Finales (1ª-5ª) + Transitoria Única + Derogatoria
 * (patrón "el último artículo absorbe el pie de la página" al importar).
 *
 * Este script DES-fusiona: recorta el art. 171 a su texto real y crea filas
 * separadas para cada disposición, reusando el texto YA presente en BD (verbatim,
 * sin retipear). Convención de article_number canónica (lib/utils/articleOrder.ts):
 * DF1..DF5 (Finales), DT (Transitoria única), DD (Derogatoria) → el ordenador de
 * teoría las pinta al final y en orden BOE (Transitoria → Derogatoria → Finales).
 *
 * Como getTopicContent filtra por topic_scope.article_numbers, además AÑADE las
 * 7 nuevas claves al scope de los 2 temas que sirven esta ley (aux_administrativo_cyl
 * y administrativo_castilla_leon) para PRESERVAR el contenido que ya se mostraba
 * (fundido dentro del 171), ahora estructurado. No añade ni quita contenido: reubica.
 *
 * Idempotente: si DF1 ya existe, no hace nada. Transaccional. Verbatim garantizado
 * por slicing por índices (la concatenación cruda de los trozos == original).
 *
 * Uso: node scripts/fix-t058-cortes-cyl-171-disposiciones.cjs [--apply]
 *   sin --apply = DRY-RUN (imprime el plan, no escribe).
 */
require('dotenv').config({ path: '.env.local' })
const postgres = require('postgres')

const LAW = '44021532-cf07-46f4-9a8e-e9cd7f65170b' // Reglamento de las Cortes de Castilla y León
const ART171_NUM = '171'
const APPLY = process.argv.includes('--apply')

// Marcadores literales que delimitan los bloques dentro del contenido del art. 171.
const M_FINALES = 'Disposiciones Finales'
const M_TRANS = 'Disposición Transitoria Única'
const M_DEROG = 'Disposición Derogatoria'
// Ordinales que separan cada Disposición Final dentro del bloque de Finales.
const FINAL_ORDINALS = ['Primera.-', 'Segunda.-', 'Tercera.-', 'Cuarta.-', 'Quinta.-']
const FINAL_TITLES = [
  'Disposición Final Primera', 'Disposición Final Segunda', 'Disposición Final Tercera',
  'Disposición Final Cuarta', 'Disposición Final Quinta',
]

function fail(msg) { console.error('❌ ' + msg); process.exit(1) }

;(async () => {
  const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 1 })
  try {
    const [art] = await sql`SELECT id, article_number, content FROM articles WHERE law_id=${LAW} AND article_number=${ART171_NUM}`
    if (!art) fail('No encuentro el art. 171 de esta ley')
    const content = art.content || ''

    // Idempotencia
    const [existing] = await sql`SELECT count(*)::int c FROM articles WHERE law_id=${LAW} AND article_number IN (${'DF1'},${'DT'},${'DD'})`
    if (existing.c > 0) {
      console.log('✅ Ya des-fusionado (existen disposiciones DF1/DT/DD). Nada que hacer.')
      await sql.end(); return
    }

    // --- Localizar límites por índice (concatenación cruda == original garantizada) ---
    const iFin = content.indexOf(M_FINALES)
    const iTra = content.indexOf(M_TRANS)
    const iDer = content.indexOf(M_DEROG)
    if (iFin < 0 || iTra < 0 || iDer < 0) fail('No encuentro los 3 marcadores de disposiciones en el art. 171')
    if (!(iFin < iTra && iTra < iDer)) fail(`Orden inesperado de marcadores: Fin=${iFin} Tra=${iTra} Der=${iDer}`)

    const art171Body = content.slice(0, iFin).trim()          // caducidad + nota de reforma (patrón sistémico)
    const rawFinales = content.slice(iFin, iTra)              // "Disposiciones Finales ..."
    const rawTrans = content.slice(iTra, iDer)               // "Disposición Transitoria Única ..."
    const rawDerog = content.slice(iDer)                     // "Disposición Derogatoria ..."

    // Sanity: las 3 rebanadas crudas cubren TODO desde iFin al final sin solaparse.
    if (rawFinales + rawTrans + rawDerog !== content.slice(iFin)) fail("El troceo crudo no reconstruye el original")

    // --- Trocear las 5 Finales ---
    const finalesInner = rawFinales.slice(M_FINALES.length) // texto tras "Disposiciones Finales"
    const ordIdx = FINAL_ORDINALS.map(o => finalesInner.indexOf(o))
    ordIdx.forEach((v, k) => { if (v < 0) fail(`No encuentro la Disposición Final "${FINAL_ORDINALS[k]}"`) })
    for (let k = 1; k < ordIdx.length; k++) if (ordIdx[k] <= ordIdx[k - 1]) fail('Ordinales de Finales fuera de orden')
    const finales = ordIdx.map((start, k) => {
      const end = k + 1 < ordIdx.length ? ordIdx[k + 1] : finalesInner.length
      // Quitar el prefijo "Primera.-" del cuerpo almacenado (el ordinal va en el título)
      return finalesInner.slice(start + FINAL_ORDINALS[k].length, end).trim()
    })
    if (finales.some(f => !f)) fail('Alguna Disposición Final quedó vacía tras el troceo')

    const transBody = rawTrans.slice(M_TRANS.length).trim()
    const derogBody = rawDerog.slice(M_DEROG.length).trim()
    if (!transBody || !derogBody) fail('Transitoria o Derogatoria vacía tras el troceo')

    // --- Plan de filas nuevas (orden BOE lo impone articleOrder.ts en el display) ---
    const rows = [
      { num: 'DT', title: 'Disposición Transitoria Única', body: transBody },
      { num: 'DD', title: 'Disposición Derogatoria', body: derogBody },
      ...finales.map((body, k) => ({ num: `DF${k + 1}`, title: FINAL_TITLES[k], body })),
    ]

    // --- Reporte ---
    console.log(`\n${APPLY ? '⚙️  APPLY' : '🔎 DRY-RUN'} — T-058 des-fusión art. 171 Reglamento Cortes CyL\n`)
    console.log('── art. 171 (recortado, %d chars) ──', art171Body.length)
    console.log('   …' + art171Body.slice(-160))
    console.log('\n── nuevas filas (%d) ──', rows.length)
    for (const r of rows) console.log(`   [${r.num.padEnd(4)}] ${r.title}  (${r.body.length} chars)  → "${r.body.slice(0, 70)}…"`)

    if (!APPLY) {
      console.log('\n(dry-run: no se ha escrito nada. Añade --apply para ejecutar.)')
      await sql.end(); return
    }

    // --- Escritura transaccional ---
    const newNums = rows.map(r => r.num)
    await sql.begin(async (tx) => {
      // 1) Recortar art. 171
      await tx`UPDATE articles SET content=${art171Body}, embedding_stale=true, updated_at=now() WHERE id=${art.id}`
      // 2) Insertar disposiciones
      for (const r of rows) {
        await tx`INSERT INTO articles (law_id, article_number, title, content, is_active, embedding_stale, is_verified, created_at, updated_at)
                 VALUES (${LAW}, ${r.num}, ${r.title}, ${r.body}, true, true, false, now(), now())`
      }
      // 3) Añadir las 7 claves al scope de los temas que sirven esta ley (preserva el contenido mostrado)
      const scopes = await tx`SELECT id, article_numbers FROM topic_scope WHERE law_id=${LAW}`
      for (const s of scopes) {
        const arr = Array.isArray(s.article_numbers) ? s.article_numbers.map(String) : []
        const merged = Array.from(new Set([...arr, ...newNums]))
        await tx`UPDATE topic_scope SET article_numbers=${merged} WHERE id=${s.id}`
      }
      console.log(`\n   ✅ art. 171 recortado, ${rows.length} disposiciones creadas, scope de ${scopes.length} temas ampliado.`)
    })

    // --- Verificación post ---
    const check = await sql`SELECT article_number, length(content) len FROM articles WHERE law_id=${LAW} AND article_number IN (${'171'},${'DT'},${'DD'},${'DF1'},${'DF2'},${'DF3'},${'DF4'},${'DF5'}) ORDER BY article_number`
    console.log('\n── verificación BD ──')
    check.forEach(c => console.log(`   ${c.article_number.padEnd(5)} len=${c.len}`))
    const scopeCheck = await sql`SELECT count(*)::int c FROM topic_scope WHERE law_id=${LAW} AND ${'DF1'} = ANY(article_numbers)`
    console.log(`   temas con DF1 en scope: ${scopeCheck[0].c}/2`)
  } catch (e) {
    fail(e.message)
  } finally {
    await sql.end()
  }
})()
