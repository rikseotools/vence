#!/usr/bin/env node
// Calibración de la puerta «no digas que está arreglado si no está VIVO» (T-678), contra los
// mensajes REALES que ya se enviaron. Solo LEE.
//
// Por qué esto y no un umbral a ojo: un patrón que marca de más convierte la puerta en un estorbo
// que se rodea con el escape, y entonces no protege de nada. La pregunta que responde este script
// es «¿cuántos de los mensajes que hemos mandado habría parado?» — y, de esos, cuántos son
// promesa DE VERDAD leyéndolos. Misma lección que los 173 falsos positivos del intento anterior de
// otra medida el mismo día.
//
// Uso:  node scripts/impugnaciones/sim-promesa-de-arreglo.cjs [--dias 30] [--ver]

const fs = require('fs')
const path = require('path')
const { afirmaArreglo } = require(path.join(__dirname, '..', '..', 'lib', 'impugnaciones', 'promesaDeArreglo.cjs'))

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8')
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim()
}

const arg = (f, d) => {
  const i = process.argv.indexOf(f)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d
}

;(async () => {
  const dias = Number(arg('--dias', 30))
  const ver = process.argv.includes('--ver')
  const sql = require('postgres')(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 })
  try {
    console.log(`\nCALIBRACIÓN — ¿a cuántos mensajes YA ENVIADOS les habría saltado la puerta? (${dias} días)`)
    console.log('='.repeat(78))

    const mensajes = await sql`
      SELECT 'feedback' AS origen, message AS texto, created_at
        FROM feedback_messages
       WHERE is_admin AND created_at > now() - (${dias} || ' days')::interval
      UNION ALL
      SELECT 'impugnacion', admin_response, resolved_at
        FROM question_disputes
       WHERE admin_response IS NOT NULL AND resolved_at > now() - (${dias} || ' days')::interval`

    const marcados = []
    for (const m of mensajes) {
      const r = afirmaArreglo(m.texto)
      if (r.afirma) marcados.push({ ...m, frase: r.frase })
    }

    const pct = mensajes.length ? ((marcados.length / mensajes.length) * 100).toFixed(1) : '0'
    console.log(`\n  mensajes de admin enviados: ${mensajes.length}`)
    console.log(`  con promesa de arreglo:     ${marcados.length}  (${pct}%)`)
    console.log('\n  ▸ Ese porcentaje NO es el de bloqueos: la puerta solo para si ADEMÁS hay commits')
    console.log('    de superficie servida sin desplegar. Es el techo — lo que como mucho se mirará.')

    const porFrase = {}
    for (const m of marcados) porFrase[m.frase.toLowerCase()] = (porFrase[m.frase.toLowerCase()] || 0) + 1
    console.log('\n  frases que disparan, por frecuencia:')
    for (const [f, n] of Object.entries(porFrase).sort((a, b) => b[1] - a[1])) {
      console.log(`     ${String(n).padStart(3)}×  «${f}»`)
    }

    if (ver) {
      console.log('\n  ── los marcados, para leerlos a mano (la precisión se juzga leyendo) ──')
      for (const m of marcados.slice(0, 25)) {
        console.log(`\n  [${m.origen} · ${new Date(m.created_at).toISOString().slice(0, 10)}] «${m.frase}»`)
        console.log('   ' + String(m.texto).replace(/\s+/g, ' ').slice(0, 220))
      }
    }

    // El ancla: el mensaje que motivó todo esto TIENE que dispararla.
    const ancla = 'Las dos venían del mismo fallo y ya está corregido. Actualiza la página y vuelve a probar, que no debería volver a pasarte.'
    const rAncla = afirmaArreglo(ancla)
    console.log(`\n  ANCLA (el mensaje a Esther): ${rAncla.afirma ? `✅ la dispara — «${rAncla.frase}»` : '❌ NO la dispara — el patrón no sirve'}`)

    // El contraste: lo honesto NO se marca.
    const honesto = 'Lo tenemos identificado y corregido, y estará disponible en las próximas horas.'
    const rHonesto = afirmaArreglo(honesto)
    console.log(`  CONTRASTE (mensaje honesto sin desplegar): ${rHonesto.afirma ? `❌ lo marca y no debería — «${rHonesto.frase}»` : '✅ no lo marca'}`)

    process.exitCode = rAncla.afirma && !rHonesto.afirma ? 0 : 1
  } finally {
    try { await sql.end({ timeout: 5 }) } catch {}
  }
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
