// ¿El tercer escritor puede marcar `safe` algo que NO lo es?
//
// `reparar-narrativa-letra-clavada.ts` escribe `explanation_data` y llama a
// `record_shuffle_safety(..., 'safe', ...)` tras podar la narrativa. Los otros dos escritores están
// obligados por guardarraíl a consultar `optionsReferenceOtherOptions` antes; éste no, porque no
// está en la lista. Y la función SQL solo valida la CADENA del estado, no el contenido.
//
// La pregunta que decide si el agujero es vivo o teórico: de las preguntas que este script tocaría
// (explicación estructurada con letra clavada en la narrativa), ¿cuántas tienen opciones que se
// citan entre sí?
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { urlLecturaNegocio } = require('../lib/db/negocioSoloLectura.cjs')
const { optionsReferenceOtherOptions } = require('../lib/shuffle/classifyShuffleMode')

;(async () => {
  const c = new Client(pgConfig(urlLecturaNegocio()))
  await c.connect()
  const { rows } = await c.query(`
    SELECT id, option_a, option_b, option_c, option_d, option_e, explanation
      FROM questions
     WHERE is_active AND explanation_data IS NOT NULL
     LIMIT 4000`)
  let cruzadas = 0
  const ej = []
  for (const q of rows) {
    const ops = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(Boolean)
    let r = false
    try { r = optionsReferenceOtherOptions(ops) } catch { r = false }
    if (r) { cruzadas++; if (ej.length < 5) ej.push(String(q.id).slice(0, 8)) }
  }
  console.log(`preguntas activas con explicación estructurada miradas: ${rows.length}`)
  console.log(`  · con opciones que se CITAN entre sí: ${cruzadas}`)
  if (ej.length) console.log(`    ej.: ${ej.join(', ')}`)
  console.log(cruzadas
    ? '\n⚠️  El agujero es VIVO: si el script poda una de éstas, la marca safe sin mirar esto.'
    : '\nℹ️  Hoy no hay ninguna: el agujero es real pero todavía teórico.')
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
