#!/usr/bin/env node
/**
 * TRIAJE tras reimportar el texto de una ley: ¿a qué preguntas les ha cambiado el suelo?
 *
 * Uso:  node scripts/triar-preguntas-tras-reimportar.cjs <law_slug> [--detalle] [--clase rota]
 *
 * POR QUÉ EXISTE (T-192, 28/07/2026). Reimportar el RGPD cambió el texto de 72 de sus 99
 * artículos y dejó **207 preguntas** apuntando a una redacción que ya no está. Revisarlas todas
 * por igual es gastar el esfuerzo donde no hace falta: a la mayoría el cambio ni las roza.
 *
 * La pregunta útil no es «¿está la clave en el texto?» sino **«¿lo estaba ANTES y ha dejado de
 * estarlo?»**, y solo se puede responder porque `scripts/actualizar-articulo-oficial.cjs` guarda
 * el texto anterior en `article_versions.previous_content`. Sin eso, esto no se podría escribir.
 *
 * Reutiliza `analizarLiteralidad` (el mismo que usa `verificar-batch-generado.cjs`, para que el
 * criterio de «anclada» sea UNO y no dos que se separan con el tiempo) y lo corre DOS veces, con
 * el texto de antes y el de ahora. La clasificación vive aparte y probada en
 * `lib/generacion/anclajeTrasReimportar.js`.
 *
 * NO escribe nada. NO decide si la pregunta es correcta: dice dónde mirar primero. Que la clave
 * sea subcadena literal no la hace verdadera. **Nunca auto-flip de clave.**
 */
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const { analizarLiteralidad, resolverMarco } = require(path.join(__dirname, '..', 'lib', 'generacion', 'literalidad'))
const { clasificarAnclaje, resumirAnclajes } = require(path.join(__dirname, '..', 'lib', 'generacion', 'anclajeTrasReimportar'))

const argv = process.argv.slice(2)
const DETALLE = argv.includes('--detalle')
const CLASE = argv.indexOf('--clase') >= 0 ? argv[argv.indexOf('--clase') + 1] : null
const SLUG = argv.filter((a) => !a.startsWith('--'))[0]

if (!SLUG) {
  console.error('uso: node scripts/triar-preguntas-tras-reimportar.cjs <law_slug> [--detalle] [--clase rota]')
  process.exit(1)
}

const envPath = path.join(__dirname, '..', '.env.local')
const raw = (process.env.DATABASE_URL || fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1]).trim()
// GOTCHA `pg` + RDS: `sslmode=require` en la cadena gana sobre la opción `ssl` y revienta con
// "self-signed certificate in chain" (RDS presenta su propia CA).
const url = raw.replace(/([?&])sslmode=[^&]*(&|$)/, (_m, pre, post) => (post === '&' ? pre : ''))

;(async () => {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()

  // La versión anterior es la MÁS RECIENTE de cada artículo. Si un artículo no tiene versión
  // guardada, su texto no se tocó: `previous_content` NULL y la clasificación lo tratará sin
  // inventarse que la clave estaba anclada.
  const { rows } = await c.query(
    `SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option,
            a.article_number AS art, a.content AS ahora,
            (SELECT av.previous_content FROM article_versions av
              WHERE av.article_id = a.id ORDER BY av.created_at DESC LIMIT 1) AS antes
       FROM questions q
       JOIN articles a ON a.id = q.primary_article_id
       JOIN laws l ON l.id = a.law_id
      WHERE l.slug = $1 AND q.is_active
      ORDER BY NULLIF(regexp_replace(a.article_number, '\\D', '', 'g'), '')::int NULLS LAST, q.id`,
    [SLUG],
  )
  if (!rows.length) { console.error(`❌ sin preguntas activas para "${SLUG}"`); await c.end(); process.exit(2) }

  const opcion = (r) => [r.option_a, r.option_b, r.option_c, r.option_d][r.correct_option]
  const fichas = rows.map((r) => {
    const clave = opcion(r) || ''
    const ops = [r.option_a, r.option_b, r.option_c, r.option_d]
    // Marco INTRUSO («señale la FALSA»): ahí la correcta NO está en el artículo por diseño, así
    // que su literalidad no dice nada. Se resuelve contra el texto ACTUAL (el oficial).
    const marco = resolverMarco(r.ahora, ops, r.correct_option, r.question_text)
    const eAntes = r.antes ? analizarLiteralidad(r.antes, clave).estado : undefined
    const eDespues = analizarLiteralidad(r.ahora, clave).estado
    return { ...r, clave, eAntes, eDespues, marco: marco.marco, ...clasificarAnclaje(eAntes, eDespues, { marcoIntruso: marco.marco === 'INTRUSO' }) }
  })

  const conVersion = fichas.filter((f) => f.antes).length
  console.log(`\n━━━ ${SLUG} — ${fichas.length} preguntas activas (${conVersion} sobre artículos reescritos)\n`)
  console.log('  ' + JSON.stringify(resumirAnclajes(fichas.map((f) => f.clase))))
  console.log('\n  intacta  = la clave seguía y sigue en el texto        → sin trabajo')
  console.log('  reparada = no estaba en el viejo y sí en el oficial   → el texto era el malo, no la pregunta')
  console.log('  rota     = estaba y ha DEJADO de estar                → MÍRALA LA PRIMERA')
  console.log('  ya_rota  = no estaba ni antes ni ahora                → revisar, pero no lo causó la reimportación')
  console.log('  no_aplica= enunciado «señale la FALSA»                → la correcta NO va en el texto por diseño')

  const porClase = {}
  for (const f of fichas) (porClase[f.clase] ||= []).push(f)
  for (const clase of ['rota', 'ya_rota', 'reparada', 'intacta', 'no_aplica']) {
    const ls = porClase[clase] || []
    if (!ls.length) continue
    const arts = [...new Set(ls.map((f) => f.art))]
    console.log(`\n  ${clase.toUpperCase()} (${ls.length}) · artículos: ${arts.slice(0, 20).join(', ')}${arts.length > 20 ? ` … (${arts.length})` : ''}`)
  }

  const aVer = CLASE ? (porClase[CLASE] || []) : (porClase.rota || [])
  if (DETALLE && aVer.length) {
    console.log(`\n${'═'.repeat(78)}\n  DETALLE — ${CLASE || 'rota'} (${aVer.length})`)
    for (const f of aVer) {
      console.log(`\n  ── art. ${f.art} · ${f.id}`)
      console.log(`     enunciado: ${String(f.question_text).replace(/\s+/g, ' ').slice(0, 150)}`)
      console.log(`     clave (${'ABCD'[f.correct_option]}): ${String(f.clave).replace(/\s+/g, ' ').slice(0, 220)}`)
      console.log(`     literalidad: antes ${f.eAntes || '(sin versión previa)'} → ahora ${f.eDespues}`)
    }
  } else if (aVer.length) {
    console.log(`\n  (añade --detalle para leer las ${aVer.length} de clase "${CLASE || 'rota'}")`)
  }

  console.log('\n⚠️ Esto dice DÓNDE MIRAR, no si la pregunta es correcta. Una clave literal puede ser falsa')
  console.log('   y una parafraseada legítima. Lo que no cuadre va a needs_human: NUNCA auto-flip de clave.\n')
  await c.end()
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
