#!/usr/bin/env node
// scripts/canary-target-oposicion-vacio.cjs — [T-569]
//
// `user_profiles.target_oposicion` solo puede significar dos cosas: NULL ("sin oposición") o
// un slug válido. Una cadena vacía ('') es un TERCER estado que nadie mira — un `IS NULL`
// no la ve, así que cualquier código que trata "sin oposición" mirando NULL cuenta a estas
// cuentas como si SÍ tuvieran una, y el configurador "por leyes" les responde
// `positionType required` en cuanto lo intentan.
//
// Cómo nacía (arreglado en este mismo commit): `/perfil` "limpiaba" en pantalla un
// target_oposicion inválido (UUID, JSON, slug fuera del registro del frontend) poniéndolo a
// '', y saveProfile() mandaba ese '' de vuelta al guardar CUALQUIER otro campo — el usuario
// no tenía que tocar el selector de oposición. Con el escritor cerrado, este canario vigila
// que el número NO SUBA: los 11 de origen (05/08/2026) son deuda pendiente de recuperar
// manualmente (requiere criterio humano, no un backfill mecánico — ver ficha T-569), pero
// una SUBIDA significa que otro escritor está reintroduciendo el mismo defecto.
//
// Uso:
//   node scripts/canary-target-oposicion-vacio.cjs
//
// Salida: 0 = igual o por debajo de la línea base conocida · 1 = ha subido, hay un escritor
// nuevo escribiendo '' — mirar antes que nada `git log -p -- app/perfil/page.tsx
// app/api/v2/onboarding/save-field/route.ts app/api/v2/oposicion/assign/route.ts`.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')

// Medido el 05/08/2026 al escribir la ficha T-569. Deuda conocida, no un objetivo: baja solo
// cuando alguien con permiso de escritura reconstruye esas 11 cuentas UNA A UNA (target_oposicion_data,
// histórico de tests o registration_source), nunca en bloque.
const LINEA_BASE_CONOCIDA = 11

async function main() {
  // [T-624] El criterio de qué credencial se usa para LEER negocio vive en un solo sitio. Este
  // canario nació con su propia copia (`VENCE_LECTOR_URL || DATABASE_URL`) y el guardarraíl la
  // cazó al mergear: dos sitios eligiendo credencial es como se acaba leyendo con la que no toca.
  const { urlLecturaNegocioConFuente } = require('../lib/db/negocioSoloLectura.cjs')
  const { url, fuente } = urlLecturaNegocioConFuente()
  if (!url) {
    console.error('⚠️  No hay credencial de lectura de negocio definida — no puedo medir.')
    return 1
  }
  if (process.env.DEBUG) console.error(`   (leyendo con ${fuente})`)
  const c = new Client(pgConfig(url))
  await c.connect()
  try {
    const r = await c.query(
      `SELECT count(*)::int AS n FROM user_profiles WHERE target_oposicion = ''`,
    )
    const n = r.rows[0].n

    console.log(`\n══ target_oposicion = '' (el tercer estado que nadie mira) ${'═'.repeat(10)}`)
    console.log(`   cuentas con cadena vacía : ${n}`)
    console.log(`   línea base conocida      : ${LINEA_BASE_CONOCIDA} (medida 05/08/2026)`)

    if (n === 0) {
      console.log(`\n   🟢 VERDE — cero cuentas en el estado inválido. Deuda saldada.`)
      return 0
    }
    if (n <= LINEA_BASE_CONOCIDA) {
      console.log(
        `\n   🟡 DEUDA CONOCIDA — no ha subido desde la línea base. Sigue pendiente de\n` +
          `      recuperación manual (una por una, ver ficha T-569), pero NO es una regresión.`,
      )
      return 0
    }
    console.log(
      `\n   🔴 ROJO — ${n} es MÁS que la línea base de ${LINEA_BASE_CONOCIDA}: hay un escritor\n` +
        `      NUEVO (o reintroducido) persistiendo '' en vez de NULL. NO es la misma deuda de\n` +
        `      siempre. Candidatos: app/perfil/page.tsx (saveProfile — arreglado en T-569),\n` +
        `      app/api/v2/onboarding/save-field/route.ts, app/api/v2/oposicion/assign/route.ts.`,
    )
    return 1
  } finally {
    await c.end()
  }
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error(`\n⚠️  canary-target-oposicion-vacio: no pude medir (${e.message}).\n`)
    process.exit(1)
  })
