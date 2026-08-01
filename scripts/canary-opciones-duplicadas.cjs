#!/usr/bin/env node
/**
 * TRINQUETE de T-406: el número de preguntas activas con dos opciones idénticas NO puede subir.
 *
 * Uso:  npm run canary:opciones-duplicadas          (exit 0 = dentro del techo · 2 = ha subido)
 *
 * ## Por qué un canario y no un guard en el punto de escritura
 *
 * La regla de la casa es impedir en el punto de escritura, y aquí NO se puede: `questions.option_*`
 * lo escriben **28 scripts de importación distintos** más los generadores, sin un camino común. Es
 * el caso que `toolWriters` contempla para los recursos con decenas de escritores legítimos —
 * declarar dónde vive la protección real en vez de fingir un guard por escritor.
 *
 * El camino de GENERACIÓN ya está cubierto aguas arriba: `verificar-batch-generado.cjs` exige las
 * cuatro opciones distintas y aborta el lote. El goteo medido venía del IMPORTADOR, y esa puerta no
 * existe. Mientras no exista, esto es lo que impide que el número suba sin que nadie se entere.
 *
 * ## Por qué el techo es CERO
 *
 * Las 33 medidas el 31/07 se repararon ese mismo día, así que el banco está limpio: **cualquier
 * aparición es una regresión demostrable**, no deuda histórica. Poner el trinquete cuando el número
 * es 0 es lo que lo hace útil — con un techo heredado, nadie sabe si lo que ve es nuevo o de antes.
 *
 * Si algún día hay que subirlo, que sea con la razón escrita al lado y bajando después.
 */
const path = require('path')
const { Client } = require('pg')
const { pgConfig } = require(path.join(__dirname, '..', 'lib', 'db', 'pgSsl.cjs'))
const { clasificarLote, LETRAS } = require(path.join(__dirname, '..', 'lib', 'health', 'opcionesDuplicadas.cjs'))

/** Techo declarado. Solo puede BAJAR. */
const TECHO_ERROR = 0   // clave dentro del par: la pregunta está rota
const TECHO_WARN = 0    // dos distractores clonados

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()
  // La comparación se hace en JS, nunca en SQL: normalizar en la consulta es lo que inventó los
  // fantasmas (un `\s+` que llegó como `s+` borraba las eses e igualaba `wardrobes`/`wardrobess`).
  const { rows } = await c.query(
    `SELECT id, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE is_active`)
  await c.end()

  const { errores, avisos } = clasificarLote(rows)
  const linea = (x) => `   · ${x.id} — ${LETRAS[x.i]} = ${LETRAS[x.j]}: "${String(x.texto).slice(0, 70)}"`

  console.log(`\n🕯️  Opciones duplicadas — ${rows.length} preguntas activas revisadas`)
  console.log(`   clave dentro del par (error): ${errores.length}  · techo ${TECHO_ERROR}`)
  console.log(`   dos distractores    (warn) : ${avisos.length}  · techo ${TECHO_WARN}`)

  if (errores.length) {
    console.error('\n❌ Hay preguntas con la CLAVE duplicada: se acierta y se falla a la vez.')
    errores.slice(0, 20).forEach((x) => console.error(linea(x)))
  }
  if (avisos.length) {
    console.error('\n⚠️  Hay preguntas con dos distractores idénticos (se sirven con tres opciones de hecho):')
    avisos.slice(0, 20).forEach((x) => console.error(linea(x)))
  }

  if (errores.length > TECHO_ERROR || avisos.length > TECHO_WARN) {
    console.error('\n❌ TRINQUETE ROTO — el número ha subido sobre el techo declarado.')
    console.error('   Repara reescribiendo una opción que NO sea la clave, con el contenido que le falta')
    console.error('   a la rejilla de la propia pregunta. NUNCA toques `correct_option`.')
    console.error('   Runbook: docs/runbooks/salud-contenido.md · frase «revisa las opciones duplicadas».')
    process.exit(2)
  }
  console.log('\n✅ dentro del techo: ninguna pregunta activa repite una opción.')
})().catch((e) => { console.error('❌', e.message); process.exit(1) })
