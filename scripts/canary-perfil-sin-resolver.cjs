#!/usr/bin/env node
// scripts/canary-perfil-sin-resolver.cjs
//
// ¿Cuánta gente sigue navegando con sesión y SIN perfil? [T-434]
//
// ## Por qué existe
//
// Un usuario cuyo `user_profiles.id` no se resolvió entra en la web y **parece que todo va
// bien**, pero para la base de datos no existe: sus estadísticas fallan, el checkout le
// responde «User not found in database» y el formulario de soporte también — así que **ni
// siquiera puede avisarnos**. Medido el 01/08/2026: **235 personas** en ese estado, la más
// antigua desde el 7 de julio, y **85 intentos de compra rechazados en 7 días de 12 personas**.
//
// El arreglo (reintentar la resolución en cualquier rotación de sesión, no solo en el alta) los
// cura solos al recargar. **Este canario mide si eso está pasando de verdad**, que es distinto
// de que el código esté desplegado.
//
// ## Qué mira, y por qué así
//
// No se puede consultar «sesiones sin perfil»: la sesión vive en una cookie firmada, no en la
// base de datos. Lo que sí deja rastro es el REBOTE — cada vez que uno de ellos toca un
// endpoint que indexa por su id, queda un `auth`/`warn` con «Usuario no existe». Se cuentan
// USUARIOS DISTINTOS, no eventos: uno solo navegando mucho generaría cientos y taparía si el
// grupo crece o se vacía.
//
// Se contrasta con `auth_perfil_recuperado` —las curaciones— porque las dos cifras juntas dicen
// lo que ninguna dice sola:
//
//   rotos ↓ y curados > 0  → el atasco se está drenando: lo esperado
//   rotos ↓ y curados = 0  → SOSPECHOSO: se han ido, pero no porque les curásemos
//   rotos ≈ y curados > 0  → siguen naciendo rotos al mismo ritmo que se curan (goteo tapado)
//   rotos > 0 y curados = 0 → el reintento NO está corriendo (¿desplegado?)
//
// Ese tercer caso es el que más importa y el que nadie habría visto sin cruzarlos: un arreglo
// que cura tan rápido como se rompe se lee como éxito en cualquier gráfica de «rotos».
//
// Uso:
//   node scripts/canary-perfil-sin-resolver.cjs            # ventana de 24 h
//   node scripts/canary-perfil-sin-resolver.cjs --horas 72
//
// Salida: 0 = verde · 1 = hay que mirarlo. Pensado para leerse a ojo y para un cron.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') })
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')
const { clasificarRebotes, bandaRebotes } = require('../lib/auth/rebotePersistente.cjs')

const arg = (n, def) => {
  const i = process.argv.indexOf(n)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def
}
const HORAS = Number(arg('--horas', 24))

async function main() {
  const c = new Client(pgConfig(process.env.DATABASE_URL))
  await c.connect()
  try {
    const ventana = `${HORAS} hours`

    const rotos = await c.query(
      `SELECT count(DISTINCT user_id)::int AS usuarios, count(*)::int AS eventos
         FROM observable_events
        WHERE event_type = 'auth' AND severity = 'warn'
          AND error_message = 'Usuario no existe'
          AND user_id IS NOT NULL
          AND created_at > now() - $1::interval`,
      [ventana],
    )

    // ⚠️ SE EXCLUYE EL TRÁFICO DE SIMULACIÓN, y no es un detalle: `sim-perfil-roto-se-cura`
    // recorre la aplicación DE VERDAD, así que sus curaciones son indistinguibles de las de una
    // persona. Medido el 01/08/2026 al verificar el despliegue: este canario cantó «2 usuarios
    // curados» y los dos eran corridas MÍAS —una en local, otra contra producción—. O sea que
    // informaba de progreso donde no había ninguno, justo en el momento en que se decidía si el
    // arreglo funcionaba. Un canario que se cuenta a sí mismo miente en la dirección más cara:
    // la tranquilizadora. La marca la pone `lib/sim/session.ts` (CLAIM_SIMULACION).
    const curados = await c.query(
      `SELECT count(DISTINCT metadata->>'emailPrefijo')::int AS usuarios, count(*)::int AS eventos
         FROM observable_events
        WHERE event_type = 'auth_perfil_recuperado'
          AND coalesce(metadata->>'simulacion', 'false') <> 'true'
          AND created_at > now() - $1::interval`,
      [ventana],
    )

    // El daño en dinero, que es lo que hace que esto no sea una métrica de higiene.
    const pagos = await c.query(
      `SELECT count(DISTINCT user_id)::int AS usuarios, count(*)::int AS intentos
         FROM observable_events
        WHERE endpoint = '/api/stripe/create-checkout'
          AND severity IN ('error','warn')
          AND created_at > now() - $1::interval`,
      [ventana],
    )

    // ── «Cree que está dentro, y no lo está» ────────────────────────────────────────────
    //
    // Las tres cifras de arriba miran una VENTANA CORTA, y por eso no pueden ver este caso:
    // alguien que perdió la sesión y cuyo cliente NO se enteró sigue navegando, respondiendo
    // preguntas y sin que se le guarde nada — durante DÍAS. En 24 h se parece a cualquier
    // caducidad; solo el historial los separa.
    //
    // El rebote de `/api/auth/token` con 401 está silenciado a propósito en `withErrorLogging`
    // (un navegador deslogueado haría ~340k eventos/día de polling anónimo), así que aquí se
    // exige `user_id IS NOT NULL`: sin identidad reclamada no hay a quién arreglar.
    //
    // Ventana propia de 14 días — la persistencia no se puede medir en la ventana corta.
    const persistentes = await c.query(
      `SELECT user_id::text AS "userId",
              count(*)::int AS eventos,
              count(DISTINCT date_trunc('day', created_at))::int AS dias,
              min(created_at) AS primero,
              max(created_at) AS ultimo
         FROM observable_events
        WHERE user_id IS NOT NULL
          AND created_at > now() - interval '14 days'
          AND ( (endpoint = '/api/auth/token' AND http_status = 401)
             OR (event_type = 'auth' AND severity = 'warn' AND error_message = 'Usuario no existe') )
        GROUP BY user_id`,
    )
    const reb = clasificarRebotes(persistentes.rows)
    const bandaReb = bandaRebotes(reb.resumen)

    const r = rotos.rows[0]
    const cu = curados.rows[0]
    const p = pagos.rows[0]

    console.log(`\n══ Perfiles sin resolver — ventana de ${HORAS} h ${'═'.repeat(30)}`)
    console.log(`   usuarios rotos (rebotan con «Usuario no existe») : ${r.usuarios}  (${r.eventos} eventos)`)
    console.log(`   usuarios CURADOS por el reintento               : ${cu.usuarios}  (${cu.eventos} eventos)`)
    console.log(`   checkouts rechazados                            : ${p.intentos} de ${p.usuarios} usuario(s)`)

    // Veredicto. Las bandas no son un umbral inventado: salen del cruce de arriba.
    let codigo = 0
    if (r.usuarios === 0) {
      console.log(`\n   🟢 VERDE — nadie navegando sin perfil en esta ventana.`)
    } else if (cu.usuarios === 0) {
      codigo = 1
      // OJO: esta cifra NO puede distinguir por sí sola las dos causas, y decir solo una manda
      // a investigar al sitio equivocado. Se comprobó el 01/08/2026, media hora después de
      // desplegar: cero curaciones porque **ningún roto había vuelto todavía**, mientras la
      // simulación demostraba que el mecanismo SÍ corría en producción. El canario mide el
      // RESULTADO; solo la simulación puede decir si el mecanismo está vivo.
      console.log(
        `\n   🔴 ROJO — hay ${r.usuarios} usuario(s) rotos y NINGUNA curación.\n` +
          `      DOS causas posibles y hay que distinguirlas antes de tocar nada:\n` +
          `        (a) el reintento no corre → compruébalo, no lo supongas:\n` +
          `            npm run sim:perfil-roto-se-cura -- --url=https://www.vence.es\n` +
          `            (verde = el mecanismo está vivo y la causa es la (b))\n` +
          `        (b) corre, pero ningún roto ha cargado página aún — normal justo tras\n` +
          `            desplegar: cada persona se cura la primera vez que vuelve.`,
      )
    } else {
      console.log(
        `\n   🟡 EN CURSO — ${cu.usuarios} curado(s) y ${r.usuarios} aún rebotando.\n` +
          `      Es lo esperado mientras se drena el atasco: un usuario aparece en AMBAS cifras\n` +
          `      el día en que se cura (rebotó antes, se curó después). Debe bajar cada día.`,
      )
    }
    if (p.intentos > 0) {
      console.log(`   💸 ${p.intentos} intento(s) de compra rechazados: hay dinero en juego.`)
    }

    // Bloque aparte porque responde a otra pregunta: no «¿se está drenando el atasco?» sino
    // «¿hay alguien viviendo dentro de la aplicación sin existir para ella?».
    console.log(`\n── Clientes que CREEN estar dentro — ventana de 14 días ${'─'.repeat(20)}`)
    const etiqueta = (t) => `   ${t.padEnd(48)}: `
    console.log(
      etiqueta(`rotos persistentes (rebotan ${reb.resumen.minDias}+ días distintos)`) +
        reb.resumen.rotos,
    )
    console.log(etiqueta('caducidades normales (descartadas)') + reb.resumen.caducados)
    if (reb.resumen.rotos > 0) {
      codigo = Math.max(codigo, bandaReb.codigo)
      console.log(
        `\n   🔴 ${reb.resumen.rotos} persona(s) llevan días usando la app sin que se les guarde NADA.\n` +
          `      No es una caducidad de sesión: han vuelto en ${reb.resumen.minDias} o más días\n` +
          `      distintos y siguen rebotando. El reintento de [T-434] NO puede curarles, pero\n` +
          `      NO por lo que se creyó hasta el 05/08 («no llegan a tener sesión Auth.js»): eso\n` +
          `      quedó DESMENTIDO al medirlo —180 de 182 sí tenían identidad verificada—. Es que\n` +
          `      no hay nada que reparar en el servidor: el id roto es el que arrastra el\n` +
          `      NAVEGADOR. Ver el bloque de abajo.`,
      )
      for (const f of reb.persistentes.slice(0, 8)) {
        const desde = f.primero ? new Date(f.primero).toISOString().slice(0, 10) : '?'
        console.log(
          `        · ${String(f.userId).slice(0, 8)}  ${String(f.dias).padStart(2)} días  ` +
            `${String(f.eventos).padStart(4)} rebotes  desde ${desde}`,
        )
      }
      if (reb.persistentes.length > 8) {
        console.log(`        … y ${reb.persistentes.length - 8} más`)
      }
    } else {
      console.log(`\n   🟢 Nadie atascado más de ${reb.resumen.minDias} días.`)
    }

    // ── ¿Está corriendo la CURA? (T-434) ─────────────────────────────────────────────────
    // El bloque de arriba cuenta a los rotos. Este cuenta las veces que el cliente ha SOLTADO
    // una sesión fantasma, y hace falta por un motivo que esta misma ficha ya aprendió a su
    // costa: `auth_alta_sin_perfil` llevaba a 0 desde siempre y se leyó como «ningún reintento
    // ha fallado», cuando significaba «esto no se ejecuta». **Una señal que nunca ha hablado no
    // puede tranquilizar a nadie.** Con esto, un 0 arriba se puede interpretar: si además hay
    // curas, la bolsa se está drenando; si no hay ninguna, lo que hay que mirar es si el
    // arreglo está desplegado.
    // Se EXCLUYE el tráfico de simulación. `sim-sesion-fantasma.ts` fabrica un fantasma
    // sintético, y su caso 1 no puede llevar la marca en cookie que usan las demás sims —el
    // fantasma se define justamente por NO tener cookie—, así que cada corrida de la simulación
    // sumaría una «cura» falsa y el canario diría que el arreglo está drenando cuando lo único
    // que ha pasado es que alguien probó. El discriminante honesto es el navegador: un usuario
    // real no llega en headless.
    const NO_SIMULACION = `coalesce(metadata->>'userAgent','') NOT ILIKE '%HeadlessChrome%'`
    const cura = await c.query(
      `SELECT count(*)::int eventos,
              count(DISTINCT metadata->>'userId')::int usuarios,
              max(created_at) ultima
         FROM observable_events
        WHERE event_type = 'sesion_fantasma_soltada'
          AND ${NO_SIMULACION}
          AND created_at > now() - ($1 || ' hours')::interval`,
      [String(HORAS)],
    )
    const cur = cura.rows[0]
    console.log(`\n── La cura, ¿corre? — sesiones fantasma soltadas (${HORAS} h) ${'─'.repeat(11)}`)
    if (cur.eventos > 0) {
      console.log(
        `   🟢 ${cur.eventos} liberación(es) en ${cur.usuarios} usuario(s) · última ` +
          `${new Date(cur.ultima).toISOString().slice(0, 16)}`,
      )
      console.log(`      El arreglo está vivo y drenando. Esta serie DEBE bajar sola según se`)
      console.log(`      vacía la bolsa; si se mantiene, siguen naciendo fantasmas nuevos.`)
    } else {
      const total = await c.query(
        `SELECT count(*)::int n FROM observable_events
          WHERE event_type = 'sesion_fantasma_soltada' AND ${NO_SIMULACION}`,
      )
      console.log(
        total.rows[0].n > 0
          ? `   🟢 ninguna en esta ventana (histórico: ${total.rows[0].n}). Nadie a quien soltar.`
          : `   ⚠️  NUNCA se ha emitido esta señal — un 0 aquí NO es buena noticia:\n` +
            `      significa que la cura no se ha ejecutado todavía. Comprobar que el arreglo\n` +
            `      del cliente está DESPLEGADO antes de leer los ceros de arriba como sanos.`,
      )
    }

    // ── Tercer bloque: LA CAUSA de los persistentes de arriba (T-434, 05/08/2026) ─────────
    //
    // Los dos bloques anteriores CUENTAN a los afectados; este dice POR QUÉ, y hasta hoy no
    // lo miraba nadie. Al medir los 182 apareció que no están rotos: **están sanos y tienen
    // dos identidades en el navegador**. 180 de 182 tenían peticiones con identidad
    // verificada, 0 tenían fila en `user_profiles` con el id que rebotaba, y 0 estaban en
    // `deleted_users_log`. El id malo es el que el CLIENTE manda por parámetro.
    //
    // Las dos señales miran el MISMO hecho desde los dos lados, y por eso van juntas:
    //   · `identityMismatch` (SERVIDOR) ya se emitía desde el 07/07 —nació para el replay de
    //     la cola offline— y NADIE la consultaba. No hubo que construir detector: hubo que
    //     mirarla.
    //   · `auth_identidad_ajena_descartada` (CLIENTE) cuenta el DRENAJE: cada vez que se
    //     suelta un rastro ajeno. Un pico al principio es lo bueno; que no baje es el problema.
    const mismatch = await c.query(
      `SELECT count(*)::int AS eventos, count(DISTINCT user_id)::int AS usuarios
         FROM observable_events
        WHERE metadata->>'identityMismatch' = 'true'
          AND created_at > now() - interval '14 days'`,
    )
    // Mismo discriminante que el bloque de arriba (`NO_SIMULACION`), no uno nuevo: la
    // simulación recorre la app DE VERDAD, así que sus descartes son indistinguibles de los de
    // una persona y cada corrida inflaría el drenaje. Se comprobó al estrenar este bloque —dijo
    // «2 descartes» y los dos eran corridas locales mías—, que es exactamente el fallo que este
    // canario ya se había comido una vez.
    const descartes = await c.query(
      `SELECT count(*)::int AS eventos,
              count(DISTINCT date_trunc('day', created_at))::int AS dias
         FROM observable_events
        WHERE event_type = 'auth_identidad_ajena_descartada'
          AND ${NO_SIMULACION}
          AND created_at > now() - interval '7 days'`,
    )
    const mm = mismatch.rows[0]
    const de = descartes.rows[0]
    console.log(`\n── Navegadores con DOS identidades — la causa de lo de arriba ${'─'.repeat(12)}`)
    console.log(etiqueta('el cliente manda un id ≠ del token (14 d)') + `${mm.usuarios} usuarios (${mm.eventos} eventos)`)
    console.log(etiqueta('rastros ajenos descartados (7 d)') + `${de.eventos} en ${de.dias} día(s) distintos`)
    if (mm.usuarios > 0 && de.eventos === 0) {
      codigo = Math.max(codigo, 1)
      console.log(
        `\n   🔴 Hay ${mm.usuarios} navegador(es) con dos identidades y NINGÚN descarte.\n` +
          `      O el arreglo no está desplegado, o no se está ejecutando. Compruébalo, no lo\n` +
          `      supongas:  npm run sim:sesion-fantasma -- --url=https://www.vence.es`,
      )
    } else if (de.dias >= 7) {
      codigo = Math.max(codigo, 1)
      console.log(
        `\n   🟠 Siete días seguidos descartando: el atasco ya debería estar drenado.\n` +
          `      Si sigue a diario, ALGO VUELVE A ESCRIBIR el rastro legacy (mira quién escribe\n` +
          `      \`sb-<ref>-auth\`: lib/auth/adapters/supabaseAdapter.ts lo hace en el callback).`,
      )
    } else if (mm.usuarios === 0) {
      console.log(`\n   🟢 Ningún navegador mandando una identidad que no es la suya.`)
    } else {
      console.log(
        `\n   🟡 EN CURSO — se están soltando rastros ajenos. Cada navegador se limpia la\n` +
          `      primera vez que vuelve, así que ambas cifras deben bajar día a día.`,      )
    }
    console.log('')
    return codigo
  } finally {
    await c.end()
  }
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    // Fail-open ruidoso: un canario que no puede medir NO es un canario en verde.
    console.error(`\n⚠️  canary-perfil-sin-resolver: no pude medir (${e.message}).\n`)
    process.exit(1)
  })
