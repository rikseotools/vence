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
const { parrafosDeEurLex, articuloDeEurLex, esIdEurLex, esCelexNoConsolidado } = require(path.join(__dirname, '..', 'lib', 'laws', 'eurlexConsolidado'))
const { descargarDocumentoOficial } = require(path.join(__dirname, '..', 'lib', 'laws', 'descargarEurlex.cjs'))
const { decidirReescritura, revisarTextoOficial, resumirPlan } = require(path.join(__dirname, '..', 'lib', 'laws', 'actualizarArticuloGuardas'))

const argv = process.argv.slice(2)
const APPLY = argv.includes('--apply')
const INCLUIR_REORDENADO = argv.includes('--incluir-reordenado')
// Puerta EXPLÍCITA para la clase `contaminado` (T-193): solo cuando el origen ya se ha investigado
// y se sabe que lo que servimos es una redacción NO oficial del mismo artículo. Nunca por defecto.
const INCLUIR_PARAFRASIS = argv.includes('--reimportar-parafrasis')
// Previsualización: imprime el texto viejo contra el nuevo. Existe porque los contadores NO bastan
// —el 27/07 el dry-run daba 10 candidatos y cuatro llevaban pegado un encabezado de sección que
// había metido nuestro propio extractor, y ningún número lo dijo.
const VER = argv.includes('--ver')
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
    const rubricaOficial = of_ ? (articuloDeEurLex(html, a.n, a.title) || {}).rubrica : null
    const cmp = compararArticuloOficial(a.content, of_ ? of_.texto : '')
    const d = decidirReescritura(cmp.clase, { incluirReordenado: INCLUIR_REORDENADO, incluirParafrasis: INCLUIR_PARAFRASIS })
    plan.push({ ...a, oficial: of_ ? of_.texto : '', rubricaOficial, clase: cmp.clase, resumen: cmp.resumen, ...d })
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
      console.log(`       ↳ ${decidirReescritura(clase, { incluirReordenado: INCLUIR_REORDENADO, incluirParafrasis: INCLUIR_PARAFRASIS }).motivo}`)
    }
  }
  console.log('\n  ' + JSON.stringify(resumirPlan(plan)))

  const aEscribir = plan.filter((x) => x.accion === 'reescribir')

  // Mirar el TEXTO, no el contador. Los números no cazan un encabezado de sección pegado por
  // nuestro propio extractor; leerlo, sí.
  if (VER) {
    for (const p of aEscribir) {
      console.log(`\n${'─'.repeat(78)}\n  ART. ${p.n} — ${p.title || '(sin rúbrica)'} · ${p.clase}`)
      console.log(`\n  ── AHORA (${p.content.length} ch) ──\n${p.content.split('\n').map((l) => '  │ ' + l).join('\n')}`)
      console.log(`\n  ── QUEDARÍA (${p.oficial.length} ch) ──\n${p.oficial.split('\n').map((l) => '  ▶ ' + l).join('\n')}`)
    }
    console.log(`\n${'─'.repeat(78)}`)
  }

  if (!APPLY) {
    console.log(`\n🔍 DRY-RUN: no se ha escrito nada. Añade --apply para reescribir ${aEscribir.length}.`)
    if (!VER && aEscribir.length) console.log('   (añade --ver para LEER el texto que se guardaría: los contadores no cazan un encabezado colado)')
    await c.end(); return
  }
  if (!aEscribir.length) { console.log('\nnada que escribir.'); await c.end(); return }

  // La extracción se revisa ANTES de tocar nada: la re-comparación de dentro de la transacción
  // NO caza un defecto de extracción (compararía basura contra la misma basura). Si uno falla, no
  // se escribe NINGUNO — si el extractor falla en un artículo, no hay razón para fiarse del resto.
  const malos = aEscribir.map((p) => ({ p, v: revisarTextoOficial(p.oficial, p.rubricaOficial) })).filter((x) => !x.v.ok)
  if (malos.length) {
    console.error(`\n❌ NO se escribe nada: la extracción falla en ${malos.length} artículo(s).`)
    for (const m of malos) console.error(`   · art. ${m.p.n}: ${m.v.motivo}`)
    await c.end(); process.exit(3)
  }

  await c.query('BEGIN')
  try {
    for (const p of aEscribir) {
      // El texto anterior se CONSERVA antes de pisarlo. `article_versions` existía desde el diseño
      // con la columna `previous_content` y estaba a cero filas: sin esto, la objeción de la guarda
      // («sobrescribir borra la prueba») sería cierta y no habría forma de auditar qué servíamos.
      await c.query(
        // `version_number` es TEXT (la tabla estaba a cero filas, así que la convención se fija
        // aquí: entero en texto, correlativo por artículo). El `regexp_replace` es defensivo por si
        // alguna vez entra un valor no numérico: preferible empezar de nuevo que reventar la tanda.
        `INSERT INTO article_versions (article_id, version_number, content_hash, previous_content, change_description)
         VALUES ($1,
                 (COALESCE((SELECT MAX(NULLIF(regexp_replace(version_number, '\\D', '', 'g'), '')::int)
                              FROM article_versions WHERE article_id = $1), 0) + 1)::text,
                 $2, $3, $4)`,
        [
          p.id,
          require('crypto').createHash('sha256').update(p.oficial).digest('hex'),
          p.content,
          `${p.clase}: reescrito con el texto oficial de ${FUENTE}${INCLUIR_PARAFRASIS ? ' (--reimportar-parafrasis)' : ''}`,
        ],
      )
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
