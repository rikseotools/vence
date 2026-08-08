#!/usr/bin/env node
// scripts/db/particionar-observable-events.cjs
//
// Particionado por rango DIARIO de `observable_events` (`created_at`), para que la retención
// pase de DELETE nocturno a `DROP PARTITION` (T-360, `docs/roadmap/particionado-telemetria.md`).
//
// ⚠️ NO PROBADO CONTRA UN POSTGRES REAL. Este trabajador tiene `VENCE_LECTOR_URL` (solo lectura,
// sin PII) y `DATABASE_URL` de coordinación (4 tablas de la flota) — ninguna de las dos permite
// escribir en `observable_events`. Esta máquina tampoco tiene `psql`/docker para levantar un
// Postgres local. El subcomando `plan` es de solo lectura y SÍ se ha ejecutado contra RDS real
// (vía `VENCE_LECTOR_URL`); `create`/`backfill`/`swap` generan y ejecutan DDL/DML que nadie ha
// corrido todavía. Quien tenga `DATABASE_URL` de escritura: lee el DDL que imprime `plan` antes
// de aplicar nada, y considera probarlo primero contra una instancia de prueba.
//
// Uso:
//   node scripts/db/particionar-observable-events.cjs plan
//       Solo lectura. Mide el estado real (relkind, rango de created_at, tamaño) y muestra el
//       plan completo: qué particiones haría falta crear y el DDL exacto. Funciona con
//       VENCE_LECTOR_URL — es lo que puede correr un trabajador de la flota.
//
//   node scripts/db/particionar-observable-events.cjs create --apply
//       Crea `observable_events_new` (particionada), la extensión `pg_partman`, el registro en
//       `partman.create_parent` y todas las particiones que `plan` haya listado. Requiere
//       DATABASE_URL de escritura. Sin --apply, solo imprime el DDL (igual que `plan` pero
//       fijando la tabla nueva).
//
//   node scripts/db/particionar-observable-events.cjs backfill --apply [--lote 50000]
//       Copia en lotes las filas de `observable_events` a `observable_events_new`
//       (`INSERT ... ON CONFLICT (id, created_at) DO NOTHING`, así que es reanudable: si se
//       corta a medias, se vuelve a lanzar y no duplica). NO borra nada de la tabla vieja.
//
//   node scripts/db/particionar-observable-events.cjs swap --apply
//       Transacción corta: renombra la tabla vieja a `observable_events_old`, la nueva a
//       `observable_events`, y los 8 índices a su nombre canónico. Antes de aplicar, vuelve a
//       backfillear lo que haya llegado desde el último `backfill` (la tabla sigue recibiendo
//       escrituras hasta el instante del rename).
//
//   node scripts/db/particionar-observable-events.cjs verify
//       Solo lectura, post-swap: `relkind='p'`, número de particiones, últimas filas insertadas
//       en la partición que les toca, los 8 índices con su nombre original.
//
// Tras el swap y con la app verificada: `DROP TABLE observable_events_old;` a mano (no lo hace
// este script — es irreversible y merece una decisión humana explícita, no un flag).

require('dotenv').config({ path: '.env.local' })
const { Client } = require('pg')
const { pgConfig } = require('../../lib/db/pgSsl.cjs')
const { urlLecturaNegocio } = require('../../lib/db/negocioSoloLectura.cjs')
const {
  TABLA,
  TABLA_NUEVA,
  GRANTS,
  planParticiones,
  ddlCrearTablaParticionada,
  ddlIndices,
  ddlRenombrarIndicesTrasSwap,
  ddlGrants,
  ddlParticion,
  evaluarGrantsTrasSwap,
} = require('../../lib/db/particionadoObservableEvents.cjs')

const argv = process.argv.slice(2)
const SUBCOMANDO = argv[0]
const APPLY = argv.includes('--apply')
const arg = (n, d) => {
  const i = argv.indexOf(n)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}
const LOTE = Number(arg('--lote', '50000'))
const DIAS_PREMAKE = Number(arg('--premake', '7'))
const DIAS_RETENCION = Number(arg('--retencion', '30'))

/** Solo lectura: la credencial la elige el punto único de [T-624], no este script. */
function clienteLectura() {
  return new Client(pgConfig(urlLecturaNegocio()))
}

/** Escritura: EXCLUSIVAMENTE DATABASE_URL — nunca cae a VENCE_LECTOR_URL (es de solo lectura, fallaría en el primer INSERT/CREATE con un error claro, que es justo lo que queremos si alguien lo lanza sin permiso). */
function clienteEscritura() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL de escritura para este subcomando')
  return new Client(pgConfig(process.env.DATABASE_URL))
}

async function medirEstadoActual(c) {
  const { rows: rk } = await c.query(`SELECT relkind FROM pg_class WHERE relname = $1`, [TABLA])
  const relkind = rk[0]?.relkind
  const { rows: rango } = await c.query(
    `SELECT (SELECT created_at FROM ${TABLA} ORDER BY created_at ASC LIMIT 1) AS min_ca,
            (SELECT created_at FROM ${TABLA} ORDER BY created_at DESC LIMIT 1) AS max_ca`,
  )
  // $1 y $2 llevan el MISMO valor pero NO se puede reusar un solo placeholder: Postgres unifica
  // el tipo de un parámetro en toda la sentencia, y aquí hacen falta dos tipos distintos
  // (regclass para pg_total_relation_size, name/text para la comparación) — reusarlo daba
  // "operator does not exist: name = regclass" (medido al ejecutar esto por primera vez).
  const { rows: stats } = await c.query(
    `SELECT n_live_tup, pg_size_pretty(pg_total_relation_size($1)) AS total
     FROM pg_stat_user_tables WHERE relname = $2`,
    [TABLA, TABLA],
  )
  return {
    relkind,
    yaParticionada: relkind === 'p',
    minCreatedAt: rango[0]?.min_ca ? new Date(rango[0].min_ca).toISOString().slice(0, 10) : null,
    maxCreatedAt: rango[0]?.max_ca ? new Date(rango[0].max_ca).toISOString().slice(0, 10) : null,
    filasVivas: stats[0]?.n_live_tup ?? null,
    tamanoTotal: stats[0]?.total ?? null,
  }
}

async function cmdPlan() {
  const c = clienteLectura()
  await c.connect()
  try {
    const estado = await medirEstadoActual(c)
    console.log('=== Estado medido (solo lectura) ===')
    console.log(estado)

    if (estado.yaParticionada) {
      console.log('\n⚠️  observable_events YA es una tabla particionada (relkind=p). Nada que planear — usa `verify`.')
      return
    }
    if (!estado.minCreatedAt) {
      console.log('\n⚠️  Tabla sin filas — nada que planear todavía.')
      return
    }

    const hoy = new Date().toISOString().slice(0, 10)
    const plan = planParticiones({
      minCreatedAt: estado.minCreatedAt,
      hoy,
      diasPremake: DIAS_PREMAKE,
      diasRetencion: DIAS_RETENCION,
    })

    console.log(`\n=== Plan (hoy=${hoy}, premake=${DIAS_PREMAKE}d, retención=${DIAS_RETENCION}d) ===`)
    console.log(`Particiones a crear: ${plan.fechas.length} (${plan.fechas[0]} .. ${plan.fechas[plan.fechas.length - 1]})`)
    if (plan.fechasYaFueraDeRetencion.length) {
      console.log(
        `⚠️  ${plan.fechasYaFueraDeRetencion.length} partición(es) nacerían YA fuera de retención ` +
          `(${plan.fechasYaFueraDeRetencion.join(', ')}) — el primer \`run_maintenance\` las dropea de inmediato. Esperado, no es un error.`,
      )
    }

    console.log('\n=== DDL: tabla nueva ===')
    console.log(ddlCrearTablaParticionada())

    console.log('\n=== DDL: índices (8, nombre provisional _new) ===')
    ddlIndices().forEach((i) => console.log(i.sql))

    console.log('\n=== DDL: grants (T-360, imprescindibles — ver el gotcha en particionadoObservableEvents.cjs) ===')
    console.log('Una tabla nueva NACE SIN permisos en este proyecto (a propósito, ver 20260805_rol_lector_flota.sql).')
    console.log('Sin esto, el `swap` deja `observable_events` SIN lectura para la flota ni INSERT para el supervisor.')
    ddlGrants().forEach((s) => console.log(s))

    console.log(`\n=== DDL: primeras y últimas 3 particiones (de ${plan.fechas.length} totales) ===`)
    ;[...plan.fechas.slice(0, 3), '…', ...plan.fechas.slice(-3)].forEach((f) =>
      console.log(f === '…' ? '…' : ddlParticion(f)),
    )

    console.log('\n=== pg_partman (extensión disponible, confirmado 07/08/2026 vía pg_available_extensions) ===')
    console.log('CREATE EXTENSION IF NOT EXISTS pg_partman;')
    console.log(
      `SELECT partman.create_parent(p_parent_table => 'public.${TABLA_NUEVA}', p_control => 'created_at', ` +
        `p_interval => 'daily', p_premake => ${DIAS_PREMAKE});`,
    )
    console.log(
      `UPDATE partman.part_config SET retention = '${DIAS_RETENCION} days', retention_keep_table = false, ` +
        `infinite_time_partitions = true WHERE parent_table = 'public.${TABLA_NUEVA}';`,
    )
    console.log(
      '\n⚠️  Firma de `create_parent` sin verificar contra una instancia real de pg_partman 5.2.4 — ' +
        'confirmar contra la documentación oficial (github.com/pgpartman/pg_partman) antes de aplicar; ' +
        'puede variar entre versiones 4.x/5.x.',
    )

    console.log('\nNada de esto se ha ejecutado. Para crear de verdad: `create --apply` con DATABASE_URL de escritura.')
  } finally {
    await c.end()
  }
}

async function cmdCreate() {
  const c = APPLY ? clienteEscritura() : clienteLectura()
  await c.connect()
  try {
    const estado = await medirEstadoActual(c)
    if (estado.yaParticionada) {
      console.log('observable_events ya está particionada — nada que crear.')
      return
    }
    const hoy = new Date().toISOString().slice(0, 10)
    const plan = planParticiones({
      minCreatedAt: estado.minCreatedAt,
      hoy,
      diasPremake: DIAS_PREMAKE,
      diasRetencion: DIAS_RETENCION,
    })

    const sentencias = [
      ddlCrearTablaParticionada(),
      ...ddlIndices().map((i) => i.sql),
      // T-360: sin esto, el swap deja la tabla nueva sin SELECT para vence_lector ni INSERT
      // para vence_coordinacion — una tabla nueva nace sin permisos en este proyecto, a
      // propósito (ver el gotcha grande en particionadoObservableEvents.cjs).
      ...ddlGrants(),
      ...plan.fechas.map((f) => ddlParticion(f)),
    ]

    if (!APPLY) {
      console.log(`=== DRY-RUN: ${sentencias.length} sentencias (usa --apply para ejecutar) ===`)
      sentencias.forEach((s) => console.log(s))
      return
    }

    console.log(`Ejecutando ${sentencias.length} sentencias contra DATABASE_URL de escritura…`)
    for (const s of sentencias) {
      await c.query(s)
    }
    console.log('✅ Tabla nueva, índices y particiones creadas. Siguiente paso: `backfill --apply`.')
  } finally {
    await c.end()
  }
}

async function cmdBackfill() {
  if (!APPLY) {
    console.log('DRY-RUN: backfill copiaría en lotes de', LOTE, 'filas desde', TABLA, 'a', TABLA_NUEVA)
    console.log('Usa --apply con DATABASE_URL de escritura para ejecutar de verdad.')
    return
  }
  const c = clienteEscritura()
  await c.connect()
  try {
    let copiadas = 0
    for (;;) {
      const res = await c.query(
        `INSERT INTO ${TABLA_NUEVA}
         SELECT * FROM ${TABLA} o
         WHERE NOT EXISTS (
           SELECT 1 FROM ${TABLA_NUEVA} n WHERE n.id = o.id AND n.created_at = o.created_at
         )
         ORDER BY o.created_at
         LIMIT ${LOTE}`,
      )
      const n = res.rowCount ?? 0
      copiadas += n
      console.log(`  lote: ${n} filas (acumulado ${copiadas})`)
      if (n < LOTE) break
    }
    console.log(`✅ Backfill terminado: ${copiadas} filas copiadas en esta pasada.`)
    console.log('Si la tabla sigue recibiendo escrituras, vuelve a correr `backfill --apply` justo antes de `swap` para coger lo último.')
  } finally {
    await c.end()
  }
}

async function cmdSwap() {
  if (!APPLY) {
    console.log('DRY-RUN: swap renombraría', TABLA, '→', `${TABLA}_old`, 'y', TABLA_NUEVA, '→', TABLA, 'en una transacción corta.')
    console.log('Usa --apply con DATABASE_URL de escritura. Corre `backfill --apply` justo antes para minimizar lo que se pierde entre el último backfill y el swap.')
    return
  }
  const c = clienteEscritura()
  await c.connect()
  try {
    await c.query('BEGIN')
    await c.query(`ALTER TABLE ${TABLA} RENAME TO ${TABLA}_old`)
    await c.query(`ALTER TABLE ${TABLA_NUEVA} RENAME TO ${TABLA}`)
    for (const s of ddlRenombrarIndicesTrasSwap()) {
      await c.query(s)
    }
    await c.query('COMMIT')
    console.log(`✅ Swap hecho. La tabla vieja quedó como ${TABLA}_old — verifica con \`verify\` antes de decidir un DROP TABLE (a mano, este script no lo hace).`)
  } catch (e) {
    await c.query('ROLLBACK')
    throw e
  } finally {
    await c.end()
  }
}

async function cmdVerify() {
  const c = clienteLectura()
  await c.connect()
  try {
    const estado = await medirEstadoActual(c)
    console.log('=== Estado tras swap (solo lectura) ===')
    console.log(estado)
    if (!estado.yaParticionada) {
      console.log('⚠️  relkind no es "p" — el swap no se ha hecho o falló.')
      return
    }
    const { rows: particiones } = await c.query(
      `SELECT count(*)::int AS n FROM pg_inherits WHERE inhparent = $1::regclass`,
      [TABLA],
    )
    console.log(`Particiones hijas: ${particiones[0]?.n}`)
    const { rows: indices } = await c.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = $1 ORDER BY indexname`,
      [TABLA],
    )
    console.log(`Índices con nombre canónico: ${indices.length}`)
    indices.forEach((i) => console.log('  ', i.indexname))

    // T-360 (hallazgo de revisión 08/08): el swap podía perder los GRANT en silencio — ningún
    // error de DDL, solo un permission denied en el primer SELECT/INSERT real. Se comprueba con
    // la MISMA conexión de solo lectura de arriba, sin credencial de más.
    const { rows: whoami } = await c.query('SELECT current_user')
    const rolActual = whoami[0]?.current_user
    const { rows: grants } = await c.query(
      `SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = $1`,
      [TABLA],
    )
    const { confirmados, faltantesConfirmados, noVisibles } = evaluarGrantsTrasSwap(grants, rolActual)
    console.log(`\nGrants (${rolActual} solo puede confirmar los suyos propios):`)
    confirmados.forEach((g) => console.log(`  ✅ ${g.rol} → ${g.privilegio} (confirmado)`))
    faltantesConfirmados.forEach((g) =>
      console.log(`  ❌ ${g.rol} → ${g.privilegio} — FALTA, confirmado con esta conexión. El swap lo perdió.`),
    )
    noVisibles.forEach((g) =>
      console.log(
        `  ⚠️  ${g.rol} → ${g.privilegio} — no visible desde ${rolActual}; confirmar con ` +
          `\`\\dp ${TABLA}\` desde una sesión con DATABASE_URL de escritura antes de dar el swap por bueno.`,
      ),
    )
    if (faltantesConfirmados.length) {
      console.log(`\n❌ Verificación de grants: ${faltantesConfirmados.length} confirmado(s) FALTANTE(S).`)
    } else if (noVisibles.length) {
      console.log(`\n⚠️  Verificación de grants: sin fallos confirmados, pero ${noVisibles.length} sin poder verse desde este rol.`)
    } else {
      console.log(`\n✅ Verificación de grants: ${GRANTS.length}/${GRANTS.length} confirmados, ninguno pendiente.`)
    }
  } finally {
    await c.end()
  }
}

async function main() {
  const cmds = { plan: cmdPlan, create: cmdCreate, backfill: cmdBackfill, swap: cmdSwap, verify: cmdVerify }
  const fn = cmds[SUBCOMANDO]
  if (!fn) {
    console.error('Uso: particionar-observable-events.cjs <plan|create|backfill|swap|verify> [--apply]')
    process.exit(1)
  }
  await fn()
}

main().catch((e) => {
  console.error('❌', e.message)
  process.exit(1)
})
