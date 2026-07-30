#!/usr/bin/env node
/**
 * SIMULACIÓN — radio de impacto de resolver el marco INTRUSO por EVIDENCIA
 * (`resolverMarco`, 26/07/2026, `lib/generacion/literalidad.js`).
 *
 * Hermana de `scripts/sim-intruso-atribucion.cjs`, que midió el cambio anterior
 * sobre el mismo detector. Mismo método y misma razón: `analizarIntruso` decide
 * si el gate de generación EXENTA a una pregunta del check de literalidad
 * (§2.2 del manual `generar-preguntas-con-ia.md`), así que tocarlo no se da por
 * bueno con tests sintéticos — se mide contra el banco REAL.
 *
 * EL DEFECTO QUE MOTIVA EL CAMBIO
 * -------------------------------
 * La pista se saca de la REDACCIÓN, y la redacción engaña. Caso raíz: art. 5.1
 * RDL 1/1993 (batch `gen_atc_t223_2026-07-26_s26c`). El enunciado CITA la
 * negación de la propia ley y pide completarla —*"…no se considerará protegido
 * por la fe pública registral el tercero:"*— así que la pista dispara, pero es
 * una pregunta DIRECTA cuya correcta sí es cita literal. Con el marco mal
 * elegido el gate (a) exigía literalidad a los tres distractores, que son
 * inventados como en cualquier pregunta normal → rojo absurdo; y (b) daba por
 * buena la literalidad de la correcta SIN comprobarla, que es justo lo que el
 * gate existe para verificar.
 *
 * EL CAMINO MUERTO (medido, por eso está escrito aquí)
 * ---------------------------------------------------
 * El primer intento fue endurecer el regex de la pista exigiendo marco de
 * selección explícito, como ya se hace con los verbos de atribución. Medido con
 * este mismo script: volvía a marcar **438 intrusos legítimos**, porque las
 * redacciones reales del banco no siguen plantilla ("EUROPOL. Indique cual NO
 * forma parte de sus objetivos", "…NO forma parte del contenido del Reglamento").
 * Se descartó. La lección es que la forma de la frase no es un discriminante
 * fiable en un banco heterogéneo.
 *
 * LA REGLA QUE SÍ
 * ---------------
 * La EVIDENCIA manda sobre la redacción: **si la correcta ES cita literal del
 * artículo, no era un intruso** (en un intruso la correcta es, por construcción,
 * la única inventada). Así el marco se decide con el mismo dato que luego se
 * verifica.
 *
 * QUÉ MIDE
 * --------
 * Sobre las preguntas cuyo enunciado contiene una negación (único conjunto donde
 * la pista puede disparar):
 *
 *   1. Cuántas tienen PISTA de intruso.
 *   2. De esas, cuántas quedan CONFIRMADAS como intruso → comportamiento
 *      idéntico al anterior. Riesgo cero por construcción.
 *   3. Cuántas quedan DESMENTIDAS → pasan a DIRECTA. Son las que el cambio
 *      toca: su cita, que antes no se verificaba nunca, ahora se comprueba.
 *   4. De las desmentidas, cuántas tienen los TRES distractores no literales:
 *      ésas son ambiguas y el gate emite aviso, porque o el enunciado no era un
 *      intruso (correcto) o la CLAVE está mal (la opción marcada sí figura en el
 *      artículo, así que no puede ser la intrusa).
 *
 * El cambio es MONÓTONO: nada que estuviera exento deja de comprobarse, y lo que
 * pasa a comprobarse solo puede añadir señal.
 *
 * Uso:  node scripts/sim-marco-intruso.cjs [--ambiguas] [--limite N]
 *       --ambiguas  lista las desmentidas con 3 distractores no literales
 *                   (las candidatas a clave equivocada).
 */
const fs = require('fs')
const path = require('path')
const pg = require('postgres')
const { analizarIntruso, resolverMarco } = require(path.join(__dirname, '..', 'lib', 'generacion', 'literalidad'))

const LISTAR_AMBIGUAS = process.argv.includes('--ambiguas')
const LIMITE = Number((process.argv.find((a) => a.startsWith('--limite=')) || '').split('=')[1]) || 25

const envPath = path.join(__dirname, '..', '.env.local')
const url = fs.readFileSync(envPath, 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim()
const s = pg(url.replace(/sslmode=[^&]*/, 'sslmode=no-verify'), {
  ssl: { rejectUnauthorized: false },
  max: 1,
  connect_timeout: 60,
  idle_timeout: 120,
})

;(async () => {
  // OJO con el `\y` de Postgres dentro de un template literal de JS: `\y` es un
  // escape desconocido y el literal se cocina a "y", así que el patrón buscaría
  // "yno y" y devolvería CERO filas sin error. Hay que doblar la barra.
  const filas = await s`
    SELECT q.id, q.question_text, q.correct_option, q.is_active,
           q.option_a, q.option_b, q.option_c, q.option_d,
           a.content AS art_content, a.article_number, l.short_name
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE length(coalesce(a.content, '')) > 50
      AND q.question_text ~* '\\yno\\y'`

  let conPista = 0
  const confirmadas = []
  const desmentidas = []
  for (const q of filas) {
    if (!analizarIntruso(q.question_text)) continue
    conPista++
    const opciones = [q.option_a, q.option_b, q.option_c, q.option_d]
    const m = resolverMarco(q.art_content, opciones, q.correct_option, q.question_text)
    ;(m.marco === 'INTRUSO' ? confirmadas : desmentidas).push({ ...q, marco: m })
  }

  const ambiguas = desmentidas.filter((d) => d.marco.distractoresNoLiterales.length === 3)
  const activas = (xs) => xs.filter((x) => x.is_active).length

  console.log('SIMULACIÓN — marco INTRUSO resuelto por evidencia (resolverMarco)')
  console.log('='.repeat(72))
  console.log(`universo analizado (preguntas con negación en el enunciado):  ${filas.length}`)
  console.log(`  con PISTA de intruso:                                      ${conPista}`)
  console.log(`  · CONFIRMADAS por la evidencia (comportamiento idéntico):  ${confirmadas.length}  (activas ${activas(confirmadas)})`)
  console.log(`  · DESMENTIDAS → pasan a DIRECTA y su cita SE VERIFICA:     ${desmentidas.length}  (activas ${activas(desmentidas)})`)
  console.log(`     de ellas AMBIGUAS (3 distractores no literales):        ${ambiguas.length}  (activas ${activas(ambiguas)})`)
  console.log('')
  console.log('Lectura: el cambio es MONÓTONO — ninguna pregunta pierde una comprobación.')
  console.log('Las DESMENTIDAS pasan a tener su cita verificada (antes no se miraba nunca).')
  console.log('Las AMBIGUAS son las únicas que piden juicio: si de verdad son intrusos, su')
  console.log('clave está mal, porque la opción marcada SÍ aparece en el artículo.')

  const reparto = {}
  for (const d of desmentidas) {
    const k = d.marco.literalidadCorrecta.estado
    reparto[k] = (reparto[k] || 0) + 1
  }
  console.log(`\nliteralidad de la correcta en las desmentidas: ${JSON.stringify(reparto)}`)

  if (LISTAR_AMBIGUAS) {
    console.log(`\n--- AMBIGUAS (${Math.min(LIMITE, ambiguas.length)} de ${ambiguas.length}) ---`)
    for (const d of ambiguas.slice(0, LIMITE)) {
      console.log(`\n· ${String(d.id).slice(0, 8)} · ${d.short_name} art.${d.article_number} · ${d.is_active ? 'ACTIVA' : 'inactiva'}`)
      console.log(`  ${d.question_text.replace(/\s+/g, ' ').slice(0, 160)}`)
      console.log(`  clave (${'ABCD'[d.correct_option]}, ${d.marco.literalidadCorrecta.estado}): ${String([d.option_a, d.option_b, d.option_c, d.option_d][d.correct_option]).slice(0, 130)}`)
    }
  } else if (ambiguas.length) {
    console.log(`\n(usa --ambiguas para listar las ${ambiguas.length} que piden juicio)`)
  }

  await s.end()
})()
