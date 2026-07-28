#!/usr/bin/env node
/**
 * Reescribe el `content` de artículos ACTIVOS con el texto de su fuente oficial, en tanda y
 * **solo cuando la comparación no deja dudas**.
 *
 * Uso:  node scripts/actualizar-articulo-oficial.cjs <law_slug> <CELEX:0…> [<art>…]      # DRY-RUN
 *       node scripts/actualizar-articulo-oficial.cjs <law_slug> <CELEX:0…> --apply
 *       … [--incluir-reordenado]
 *
 * Ejemplo (T-184):
 *   node scripts/actualizar-articulo-oficial.cjs rgpd-ue-2016-679 CELEX:02016R0679-20160504 --apply
 *
 * POR QUÉ EXISTE (27/07/2026, T-184). El RGPD servía 41.381 caracteres de menos: el art. 28 daba
 * 12 párrafos de menos y el 40 se comía 21. Hasta ahora la única puerta que escribía `content` era
 * `reactivar-articulo-boe.cjs`, pensada para reactivar UN artículo apagado y atada al BOE. Faltaba
 * la operación "pon al día el texto contra su fuente", que es otra cosa.
 *
 * LO QUE ESTE SCRIPT NO HACE, a propósito:
 *  · No inventa la fuente: `CELEX:0…` → EUR-Lex CONSOLIDADO (el que trae las correcciones de
 *    errores). El espejo del BOE de una norma UE es el texto ORIGINAL CON erratas — comparar
 *    contra él decía que 80 de los 99 artículos del RGPD "divergían" y "arreglarlos" habría metido
 *    «las orientación sexuales» en el temario de 49 oposiciones.
 *  · No decide él: la política vive en `lib/laws/actualizarArticuloGuardas.js` (9 tests). Solo
 *    reescribe `incompleto` y `erratas`; BLOQUEA `contaminado` y `sin_oficial`.
 *  · No aplana el texto: usa `parrafosDeEurLex`, que reconstruye el `\n` por apartado y por letra
 *    que usa la BD. Volcar plano arreglaría la literalidad y ROMPERÍA la teoría.
 *  · No se fía de haber escrito: re-compara DENTRO de la transacción y hace ROLLBACK si el
 *    resultado no queda `identico`.
 *
 * EFECTO COLATERAL QUERIDO: escribir `content` dispara `reset_questions_on_article_update`, que
 * resetea la verificación de las preguntas de ese artículo. Es correcto — se verificaron contra el
 * texto anterior — y es justamente lo que hay que revisar después.
 */
require('dotenv').config({ path: '.env.local' })
const path = require('path')
const { Client } = require('pg')
const { compararArticuloOficial } = require(path.join(__dirname, '..', 'lib', 'laws', 'compararArticuloOficial'))
const { parrafosDeEurLex, esIdEurLex, esCelexNoConsolidado } = require(path.join(__dirname, '..', 'lib', 'laws', 'eurlexConsolidado'))
const { descargarDocumentoOficial } = require(path.join(__dirname, '..', 'lib', 'laws', 'descargarEurlex.cjs'))
const { decidirReescritura, resumirPlan } = require(path.join(__dirname, '..', 'lib', 'laws', 'actualizarArticuloGuardas'))

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const INCLUIR_REORDENADO = argv.includes('--incluir-reordenado')
const [SLUG, FUENTE, ...RESTO] = argv.filter((a) => !a.startsWith('--'))
const ARTS = RESTO

if (!SLUG || !FUENTE) {
  console.error('uso: node scripts/actualizar-articulo-oficial.cjs <law_slug> <CELEX:0…> [<art>…] [--apply]')
  process.exit(1)
}
if (!esIdEurLex(FUENTE)) {
  console.error(`❌ fuente no soportada: "${FUENTE}". Hoy solo EUR-Lex (id CELEX). Para leyes del BOE`)
  console.error('   usa scripts/reactivar-articulo-boe.cjs o amplía este script reutilizando `bloqueVigente`.')
  process.exit(1)
}
if (esCelexNoConsolidado(FUENTE)) {
  console.error(`❌ ese CELEX empieza por 3 = el acto tal como se PUBLICÓ, CON erratas.`)
  console.error('   Usa el CONSOLIDADO (empieza por 0), p. ej. CELEX:02016R0679-20160504.')
  process.exit(1)
}

;(async () => {
  // Validar el CONTENIDO y no el código de estado: EUR-Lex responde 202 con cuerpo VACÍO
  // cuando nos raciona, y `202` pasa el filtro `r.ok` → los 99 artículos salían «sin oficial»
  // y el script informaba de que no había nada que reescribir. Cae a Cellar y lanza si no hay
  // ninguna fuente utilizable.
  const { html } = await descargarDocumentoOficial(FUENTE, { log: (m) => console.log(`   ${m}`) })

  // GOTCHA `pg` + RDS: si la URL trae `sslmode=require`, ESE parámetro gana sobre la opción `ssl`
  // y revienta con "self-signed certificate in certificate chain" (RDS presenta su propia CA).
  // Hay que quitarlo de la cadena; el cliente `postgres` de los otros scripts no lo sufre.
  const url = String(process.env.DATABASE_URL || '').replace(/([?&])sslmode=[^&]*(&|$)/, (_m, pre, post) => (post === '&' ? pre : ''))
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const { rows: arts } = await c.query(
    `SELECT a.id, a.article_number AS n, a.title, a.content
       FROM articles a JOIN laws l ON l.id = a.law_id
      WHERE l.slug = $1 AND a.is_active = true
        AND ($2::text[] IS NULL OR a.article_number = ANY($2))
      ORDER BY NULLIF(regexp_replace(a.article_number, '\\D', '', 'g'), '')::int NULLS LAST`,
    [SLUG, ARTS.length ? ARTS : null],
  )
  if (!arts.length) { console.error(`❌ sin artículos activos para "${SLUG}"`); await c.end(); process.exit(2) }

  console.log(`\n━━━ ${SLUG} contra ${FUENTE} — ${arts.length} artículos — ${APPLY ? 'APLICANDO' : 'DRY-RUN'}\n`)

  const plan = []
  for (const a of arts) {
    const of_ = parrafosDeEurLex(html, a.n, a.title)
    const cmp = compararArticuloOficial(a.content, of_ ? of_.texto : '')
    const d = decidirReescritura(cmp.clase, { incluirReordenado: INCLUIR_REORDENADO })
    plan.push({ ...a, oficial: of_ ? of_.texto : '', clase: cmp.clase, resumen: cmp.resumen, ...d })
  }

  for (const p of plan.filter((x) => x.accion === 'reescribir')) {
    console.log(`  ✏️  art. ${String(p.n).padStart(3)} ${p.clase.toUpperCase().padEnd(11)} ${String(p.content.length).padStart(5)} → ${String(p.oficial.length).padStart(5)} ch · ${p.resumen}`)
  }
  const bloqueados = plan.filter((x) => x.accion === 'bloquear')
  if (bloqueados.length) {
    console.log(`\n  ⛔ BLOQUEADOS (${bloqueados.length}) — no se tocan:`)
    const porClase = {}
    for (const b of bloqueados) (porClase[b.clase] ||= []).push(b.n)
    for (const [clase, ns] of Object.entries(porClase)) {
      console.log(`     ${clase}: ${ns.slice(0, 25).join(', ')}${ns.length > 25 ? ` … (${ns.length})` : ''}`)
      console.log(`       ↳ ${decidirReescritura(clase, { incluirReordenado: INCLUIR_REORDENADO }).motivo}`)
    }
  }
  console.log('\n  ' + JSON.stringify(resumirPlan(plan)))

  const aEscribir = plan.filter((x) => x.accion === 'reescribir')
  if (!APPLY) {
    console.log(`\n🔍 DRY-RUN: no se ha escrito nada. Añade --apply para reescribir ${aEscribir.length}.`)
    await c.end(); return
  }
  if (!aEscribir.length) { console.log('\nnada que escribir.'); await c.end(); return }

  await c.query('BEGIN')
  try {
    for (const p of aEscribir) {
      await c.query('UPDATE articles SET content = $1 WHERE id = $2', [p.oficial, p.id])
      // No se da por buena la escritura: se relee y se re-compara DENTRO de la transacción.
      const { rows: [post] } = await c.query('SELECT content FROM articles WHERE id = $1', [p.id])
      const ver = compararArticuloOficial(post.content, p.oficial)
      if (ver.clase !== 'identico') throw new Error(`art. ${p.n}: tras escribir sigue sin cuadrar (${ver.clase}: ${ver.resumen})`)
    }
    await c.query('COMMIT')
  } catch (e) {
    await c.query('ROLLBACK')
    console.error(`\n❌ ROLLBACK — no se ha escrito nada: ${e.message}`)
    await c.end(); process.exit(2)
  }

  console.log(`\n✅ ${aEscribir.length} artículos reescritos con el texto oficial y verificados en la misma transacción.`)
  console.log('   ⚠️ Sus preguntas quedan con la verificación reseteada (trigger `reset_questions_on_article_update`):')
  console.log('      hay que revisarlas, porque su clave se validó contra el texto anterior.')
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
