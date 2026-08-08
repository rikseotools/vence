#!/usr/bin/env node
// regenerar-lista.cjs — T-356, corrección tras revisión (08/08, w2)
//
// La lista original (articulos-protegidos-priorizados.json, 200 filas) se generó
// transcribiendo A MANO la query de scripts/calidad/duplicados-exactos.cjs contra
// VENCE_LECTOR_URL, porque ese script usa DATABASE_URL de escritura por defecto y
// el worker no probó a sobreescribirlo. La transcripción perdió 3 artículos
// genuinamente protegidos (hallazgo de la revisión, w4).
//
// Este script NO transcribe nada: EXTRAE el texto literal de SQL_GRUPOS del propio
// fichero fuente (scripts/calidad/duplicados-exactos.cjs) y usa
// decidirSuperviviente de lib/calidad/duplicados.js — el mismo módulo de decisión
// que usa la herramienta canónica. Si la query o el criterio cambian allí, este
// script lo hereda automáticamente en vez de quedarse con una copia que rota.
//
// ⚠️ GOTCHA que costó una vuelta entera de depuración, dejado documentado porque es
// sutil y se puede repetir: extraer el texto de un template literal por REGEX sobre
// el FICHERO FUENTE da la representación SIN PROCESAR (p.ej. `\\s+` con DOS
// backslashes, tal como está escrito en el .cjs), no el valor real de la constante
// en tiempo de ejecución (`\s+`, UNO — JS colapsa `\\` a `\` al parsear el template
// literal). Esa única diferencia de un carácter cambiaba la normalización de
// `question_text` en Postgres lo suficiente como para agrupar 3 grupos MENOS
// (214 vs 217, medido). Arreglo: volver a envolver el texto extraído en backticks y
// pasarlo por `eval()` para que el parser de JS lo procese igual que al cargar el
// fichero original — verificado byte a byte contra `SQL_GRUPOS.length` real (1132).
//
// Uso:  DATABASE_URL="$VENCE_LECTOR_URL" npx tsx data/pilotos/t356-articulos-pobres-06ago/regenerar-lista.cjs

require('dotenv').config({ path: '.env.local' })
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const { pgConfig } = require('../../../lib/db/pgSsl.cjs')
const { decidirSuperviviente } = require('../../../lib/calidad/duplicados.js')

const CANONICO = path.join(__dirname, '..', '..', '..', 'scripts', 'calidad', 'duplicados-exactos.cjs')
const MINIMO = 4

function extraerSqlGrupos() {
  const src = fs.readFileSync(CANONICO, 'utf-8')
  const m = src.match(/const SQL_GRUPOS = `([\s\S]*?)`\n\n/)
  if (!m) throw new Error('No se pudo extraer SQL_GRUPOS de ' + CANONICO + ' — el fichero cambió de forma, revisar a mano.')
  if (m[1].includes('`') || m[1].includes('${')) {
    throw new Error('SQL_GRUPOS ahora contiene backtick o ${} — el eval de abajo ya no es seguro sin escaparlos, revisar a mano.')
  }
  // eslint-disable-next-line no-eval -- reprocesa el texto crudo como JS de verdad (ver gotcha arriba)
  return eval('`' + m[1] + '`')
}

async function main() {
  const SQL_GRUPOS = extraerSqlGrupos()
  const c = new Client(pgConfig())
  await c.connect()
  try {
    const { rows } = await c.query(SQL_GRUPOS)

    let jubilar = []
    const porArticulo = new Map()
    for (const g of rows) {
      const [, fuera] = decidirSuperviviente(g.miembros)
      jubilar.push(...fuera.map((f) => ({ ...f, articulo: g.primary_article_id })))
      porArticulo.set(g.primary_article_id, (porArticulo.get(g.primary_article_id) || 0) + fuera.length)
    }

    const { rows: totales } = await c.query(
      `select primary_article_id aid, count(*)::int total from questions
        where is_active and primary_article_id = any($1) group by 1`,
      [[...porArticulo.keys()]])
    const totalPorArt = new Map(totales.map((r) => [r.aid, r.total]))

    const protegidos = [...porArticulo.entries()]
      .filter(([aid, quita]) => (totalPorArt.get(aid) || 0) - quita < MINIMO)
      .map(([aid]) => aid)

    if (!protegidos.length) { console.error('❌ 0 protegidos — algo falló, no se escribe nada.'); process.exit(1) }

    const { rows: meta } = await c.query(
      `select a.id, a.article_number, coalesce(l.short_name, l.name) as ley,
              (select count(*)::int from topic_scope ts where ts.law_id = a.law_id
                and a.article_number = any(ts.article_numbers)) as n_topic_scope
         from articles a join laws l on l.id = a.law_id
        where a.id = any($1)`,
      [protegidos])

    const lista = meta
      .map((r) => ({ id: r.id, article_number: r.article_number, ley: r.ley, n_topic_scope: String(r.n_topic_scope) }))
      .sort((a, b) => Number(b.n_topic_scope) - Number(a.n_topic_scope))

    const destino = path.join(__dirname, 'articulos-protegidos-priorizados.json')
    fs.writeFileSync(destino, JSON.stringify(lista, null, 2) + '\n')
    console.log(`✅ ${lista.length} artículos protegidos escritos en ${destino}`)
    console.log(`   (medido hoy contra VENCE_LECTOR_URL con la query real de duplicados-exactos.cjs, sin transcripción)`)
  } finally {
    await c.end()
  }
}

main().catch((e) => { console.error(e.message); process.exit(1) })
