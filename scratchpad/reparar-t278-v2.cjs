// Paso 9 §4, segunda ronda de reparación del lote de Mecánico-Conductor T10.
// Dos hallazgos del agente ciego, los dos ciertos y ninguno cambia la clave.
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const APLICAR = process.argv.includes('--apply')

// 1) 16adafca — art. 54.1: la cita corta justo antes de la salvedad de los ciclistas en grupo, sin
//    marcarla, y presenta como absoluta una regla que el propio apartado exceptúa. Mismo patrón que
//    ya se reparó en la del art. 48.1.e). Se completa el blockquote y se explica la salvedad.
const CITA_54_VIEJA =
  'y frenado."'
const CITA_54_NUEVA =
  'y frenado. No obstante, se permitirá a los conductores de bicicletas circular en grupo sin ' +
  'mantener tal separación, extremando en esta ocasión la atención, a fin de evitar alcances entre ellos."'
const NOTA_54 =
  '\n\n**Ojo a la salvedad del propio apartado:** la regla no es absoluta — el art. 54.1 permite a ' +
  'los ciclistas circular EN GRUPO sin mantener esa separación, a cambio de extremar la atención ' +
  'para evitar alcances entre ellos.'

// 2) 147859fd — la razón del distractor A dice que 100 km/h «es el máximo fuera de poblado del
//    artículo 48», y no lo es: el art. 48.1.a) fija 120 km/h para turismos y motocicletas en
//    autopista y autovía. Los 100 son el límite de los autobuses. El dato de la razón tiene que
//    ser tan cierto como el de la clave.
const RAZON_VIEJA =
  'El artículo 50.6 fija 80 km/h dentro de poblado, no 100 km/h (que es el máximo fuera de poblado del artículo 48).'
const RAZON_NUEVA =
  'El artículo 50.6 fija 80 km/h dentro de poblado, no 100 km/h (que es el límite de los autobuses ' +
  'en autopista y autovía fuera de poblado; el máximo del artículo 48 son 120 km/h para turismos y motocicletas).'

;(async () => {
  const c = new Client(pgConfig())
  await c.connect()

  const { rows: [a] } = await c.query(`SELECT id, explanation FROM questions WHERE id::text LIKE '16adafca%'`)
  if (a && a.explanation.includes(CITA_54_VIEJA) && !a.explanation.includes('circular en grupo')) {
    const nueva = a.explanation.replace(CITA_54_VIEJA, CITA_54_NUEVA) + NOTA_54
    console.log('· 16adafca — cita del art. 54.1 completada con la salvedad de los ciclistas en grupo')
    if (APLICAR) await c.query(`UPDATE questions SET explanation=$1, updated_at=now() WHERE id=$2`, [nueva, a.id])
  } else console.log('⏭  16adafca — ya reparada o cita inesperada')

  const { rows: [b] } = await c.query(`SELECT id, explanation FROM questions WHERE id::text LIKE '147859fd%'`)
  if (b && b.explanation.includes(RAZON_VIEJA)) {
    console.log('· 147859fd — corregida la razón del distractor A (el máximo del art. 48 son 120, no 100)')
    if (APLICAR) await c.query(`UPDATE questions SET explanation=$1, updated_at=now() WHERE id=$2`,
      [b.explanation.replace(RAZON_VIEJA, RAZON_NUEVA), b.id])
  } else console.log('⏭  147859fd — ya reparada o razón inesperada')

  console.log(APLICAR ? '\n✅ aplicado' : '\n(dry-run — repite con --apply)')
  await c.end()
})().catch((e) => { console.error(e.message); process.exit(1) })
