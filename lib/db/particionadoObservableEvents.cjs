'use strict'
/**
 * Núcleo PURO del particionado de `observable_events` por rango diario de `created_at` (T-360).
 *
 * ## Por qué `created_at` y no `ts`
 *
 * La retención existente (`telemetry-retention.service.ts`) ya renunció a `ts` (hora del EVENTO,
 * que puede venir corrupta desde el cliente — se vio un `ts`=2067) y poda por `created_at` (hora de
 * INSERCIÓN, monotónica, generada en servidor). Particionar por `ts` rompería esa garantía: una fila
 * con `ts` futuro caería en una partición que nunca se droppea. `created_at` es la columna en la que
 * ya confiamos; particionar por otra distinta introduciría una segunda verdad. Documentado también
 * en `docs/roadmap/particionado-telemetria.md`.
 *
 * ## Por qué DIARIO y no MENSUAL
 *
 * La primera versión del roadmap (11/07) proponía mensual. Con retención EXACTA de 30 días, una
 * partición mensual no se puede `DROP` hasta que TODA ella quede fuera de la ventana — en el peor
 * caso eso retiene datos ~60 días en vez de 30, justo lo que el particionado viene a evitar (que la
 * retención deje de depender de un DELETE). Con partición DIARIA, cada día se dropea en cuanto
 * cumple los 30 días exactos, igual que hoy. Medido (T-360, RDS real vía `pg_stats.histogram_bounds`
 * — sin escanear la tabla): 85 k-1,27 M filas/día (el pico de 1,27 M/día es el incidente del
 * 07-10/07 ya documentado en el runbook), 8.464.499 filas vivas en total — un volumen diario que no
 * dispara ningún problema de "demasiadas particiones" (pg_partman recomienda cientos, no miles).
 *
 * ## Qué NO hace este módulo
 *
 * No toca la base de datos. Genera nombres, rangos de fechas y DDL como TEXTO — lo ejecuta (o no)
 * quien tenga permiso de escritura, vía `scripts/db/particionar-observable-events.cjs`.
 *
 * ## GOTCHA encontrado en revisión (T-360, 08/08/2026), sin ejecutar nada — code review + una
 * consulta de solo lectura contra RDS real
 *
 * `CREATE TABLE observable_events_new (...)` crea una tabla NUEVA, y una tabla nueva en este
 * proyecto **nace SIN permisos** por diseño: `supabase/migrations/20260805_rol_lector_flota.sql`
 * hizo `GRANT SELECT ON ALL TABLES IN SCHEMA public TO vence_lector` una sola vez, **a propósito
 * SIN `ALTER DEFAULT PRIVILEGES`** — el propio comentario de esa migración lo dice: *"una tabla
 * nueva NO queda legible sola... se prefiere el error por defecto que no expone"*. Confirmado en
 * vivo (`VENCE_LECTOR_URL`, 08/08): `information_schema.role_table_grants` da exactamente
 * `vence_lector` con `SELECT` sobre `observable_events` — y `supabase/migrations/
 * 20260804_rol_coordinacion_flota.sql:70` tiene `GRANT INSERT ON public.observable_events TO
 * vence_coordinacion`. Ninguno de los dos se replica en la DDL de aquí abajo.
 *
 * Sin este añadido, el `swap` (que renombra `observable_events_new` a `observable_events`)
 * dejaría la tabla SIN esos dos grants — rompiendo de golpe, sin previo aviso, TODO lo que hoy
 * depende de ellos: la lectura de cualquier trabajador de la flota vía `VENCE_LECTOR_URL` (el
 * panel de salud, el motor de alertas leído por herramientas del CLI, cualquier `npm run` de
 * diagnóstico) y el `INSERT` de `vence_coordinacion` (los eventos `flota_turno` que emite el
 * supervisor en cada reparto). Ninguna de las dos roturas daría un error de DDL al aplicar el
 * `create` — el fallo aparecería DESPUÉS del `swap`, en el primer `SELECT`/`INSERT` real, que es
 * el peor momento para descubrirlo.
 *
 * `ddlGrants()` genera los dos `GRANT` que hacían falta. Si algún día se añade OTRO rol con
 * acceso a `observable_events`, añadir su grant aquí — es la lista completa que se puede ver
 * desde el rol de lectura de la flota.
 *
 * `cmdVerify()` (revisión 08/08: el hallazgo real de la vuelta anterior — el propio swap podía
 * romper esto EN SILENCIO y nada lo comprobaba tras aplicarlo) ya contrasta esto automáticamente
 * con `evaluarGrantsTrasSwap()`, en la MISMA conexión de solo lectura que el resto del script —
 * pero solo puede confirmar el grant de `vence_lector` (el suyo propio): el de `vence_coordinacion`
 * queda fuera del alcance de `information_schema.role_table_grants` consultado desde este rol
 * (confirmado en vivo, ver `evaluarGrantsTrasSwap`), así que sigue haciendo falta que alguien con
 * `DATABASE_URL` de escritura (o superusuario) confirme ESE con `\dp observable_events` antes de
 * dar el swap por bueno del todo — `cmdVerify()` ya lo avisa explícitamente en vez de callarlo.
 */

const TABLA = 'observable_events'
const TABLA_NUEVA = 'observable_events_new'
const COLUMNA_PARTICION = 'created_at'

/**
 * Los grants confirmados sobre la tabla real (08/08/2026): `vence_lector` vía
 * `information_schema.role_table_grants` (consulta directa), `vence_coordinacion` vía
 * `supabase/migrations/20260804_rol_coordinacion_flota.sql:70`. Ver el gotcha de arriba.
 */
const GRANTS = [
  { rol: 'vence_lector', privilegio: 'SELECT' },
  { rol: 'vence_coordinacion', privilegio: 'INSERT' },
]

/** Columnas reales de `observable_events`, medidas contra RDS el 07/08/2026 (VENCE_LECTOR_URL). */
const COLUMNAS = [
  { nombre: 'id', tipo: 'uuid', notNull: true, default: 'gen_random_uuid()' },
  { nombre: 'ts', tipo: 'timestamptz', notNull: true, default: 'now()' },
  { nombre: 'source', tipo: 'text', notNull: true },
  { nombre: 'severity', tipo: 'text', notNull: true },
  { nombre: 'event_type', tipo: 'text', notNull: true },
  { nombre: 'endpoint', tipo: 'text' },
  { nombre: 'user_id', tipo: 'uuid' },
  { nombre: 'deploy_version', tipo: 'text' },
  { nombre: 'duration_ms', tipo: 'integer' },
  { nombre: 'http_status', tipo: 'integer' },
  { nombre: 'error_message', tipo: 'text' },
  { nombre: 'metadata', tipo: 'jsonb' },
  { nombre: 'created_at', tipo: 'timestamptz', notNull: true, default: 'now()' },
]

/** Los 8 índices reales medidos contra RDS (`pg_indexes`, 07/08/2026), retargeteados a la tabla nueva. */
const INDICES = [
  {
    nombreOriginal: 'idx_observable_events_created_at',
    ddl: (tabla, nombre) => `CREATE INDEX ${nombre} ON public.${tabla} USING btree (created_at)`,
  },
  {
    nombreOriginal: 'idx_observable_events_cron_covering_v2',
    ddl: (tabla, nombre) =>
      `CREATE INDEX ${nombre} ON public.${tabla} USING btree (event_type, ts DESC) ` +
      `INCLUDE (endpoint, duration_ms, severity) WHERE (event_type = ANY (ARRAY['cron_tick'::text, 'cron_run'::text]))`,
  },
  {
    nombreOriginal: 'idx_observable_events_endpoint_ts',
    ddl: (tabla, nombre) =>
      `CREATE INDEX ${nombre} ON public.${tabla} USING btree (endpoint, ts DESC) WHERE (endpoint IS NOT NULL)`,
  },
  {
    nombreOriginal: 'idx_observable_events_event_type_ts',
    ddl: (tabla, nombre) => `CREATE INDEX ${nombre} ON public.${tabla} USING btree (event_type, ts DESC)`,
  },
  {
    nombreOriginal: 'idx_observable_events_peticiones_lentas',
    ddl: (tabla, nombre) =>
      `CREATE INDEX ${nombre} ON public.${tabla} USING btree (created_at DESC) INCLUDE (endpoint, duration_ms) ` +
      `WHERE ((event_type = 'request_completed'::text) AND (duration_ms > 5000))`,
  },
  {
    nombreOriginal: 'idx_observable_events_source_severity_ts',
    ddl: (tabla, nombre) => `CREATE INDEX ${nombre} ON public.${tabla} USING btree (source, severity, ts DESC)`,
  },
  {
    nombreOriginal: 'idx_observable_events_ts_desc',
    ddl: (tabla, nombre) => `CREATE INDEX ${nombre} ON public.${tabla} USING btree (ts DESC)`,
  },
  {
    nombreOriginal: 'idx_observable_events_user_id',
    ddl: (tabla, nombre) => `CREATE INDEX ${nombre} ON public.${tabla} USING btree (user_id) WHERE (user_id IS NOT NULL)`,
  },
]

/** `2026-08-07` → `2026_08_07`, para nombres de partición legibles y ordenables. */
function sufijoFecha(fechaISO) {
  return fechaISO.replace(/-/g, '_')
}

function nombreParticion(fechaISO) {
  return `${TABLA}_p${sufijoFecha(fechaISO)}`
}

/** Suma `n` días a una fecha 'YYYY-MM-DD' sin tocar el reloj del sistema (recibe todo por parámetro). */
function sumarDias(fechaISO, n) {
  const [y, m, d] = fechaISO.split('-').map(Number)
  const fecha = new Date(Date.UTC(y, m - 1, d))
  fecha.setUTCDate(fecha.getUTCDate() + n)
  return fecha.toISOString().slice(0, 10)
}

/** Lista de fechas 'YYYY-MM-DD' desde `desde` hasta `hasta` inclusive. */
function listaFechas(desde, hasta) {
  const fechas = []
  let cursor = desde
  while (cursor <= hasta) {
    fechas.push(cursor)
    cursor = sumarDias(cursor, 1)
  }
  return fechas
}

/**
 * El plan completo, puro: qué particiones hacen falta para cubrir los datos existentes más un
 * margen de premake, y cuáles ya estarían fuera de retención en cuanto se cree la tabla.
 *
 * @param {object} p
 * @param {string} p.minCreatedAt fecha 'YYYY-MM-DD' del dato más antiguo vivo (medido, no supuesto)
 * @param {string} p.hoy fecha 'YYYY-MM-DD' de hoy — SIEMPRE por parámetro, nunca `new Date()` aquí
 * @param {number} [p.diasPremake] días de partición futura a crear por adelantado (defecto 7)
 * @param {number} [p.diasRetencion] días de retención (defecto 30, el mismo que el cron actual)
 */
function planParticiones({ minCreatedAt, hoy, diasPremake = 7, diasRetencion = 30 }) {
  if (!minCreatedAt || !hoy) throw new Error('minCreatedAt y hoy son obligatorios')
  const hastaConPremake = sumarDias(hoy, diasPremake)
  const fechas = listaFechas(minCreatedAt, hastaConPremake)
  const limiteRetencion = sumarDias(hoy, -diasRetencion)
  return {
    fechas,
    limiteRetencion,
    fechasDentroDeRetencion: fechas.filter((f) => f >= limiteRetencion),
    fechasYaFueraDeRetencion: fechas.filter((f) => f < limiteRetencion),
  }
}

function ddlCrearTablaParticionada(tabla = TABLA_NUEVA) {
  const cols = COLUMNAS.map((c) => {
    let linea = `  ${c.nombre} ${c.tipo}`
    if (c.default) linea += ` DEFAULT ${c.default}`
    if (c.notNull) linea += ' NOT NULL'
    return linea
  }).join(',\n')
  return (
    `CREATE TABLE ${tabla} (\n${cols},\n` +
    `  CONSTRAINT ${tabla}_pkey PRIMARY KEY (id, ${COLUMNA_PARTICION}),\n` +
    `  CONSTRAINT ${tabla}_severity_check CHECK (severity = ANY (ARRAY['debug','info','warn','error','critical']))\n` +
    `) PARTITION BY RANGE (${COLUMNA_PARTICION});`
  )
}

/** DDL de los 8 índices, retargeteados a `tabla` con nombre `<original>_new` (evita choque de nombre con la tabla vieja mientras conviven). */
function ddlIndices(tabla = TABLA_NUEVA) {
  return INDICES.map((i) => {
    const nombreNuevo = `${i.nombreOriginal}_new`
    return { nombreOriginal: i.nombreOriginal, nombreNuevo, sql: i.ddl(tabla, nombreNuevo) + ';' }
  })
}

/** Índices renombrados a su nombre canónico tras el swap (para que `pg_indexes` quede igual que antes). */
function ddlRenombrarIndicesTrasSwap() {
  return INDICES.map((i) => `ALTER INDEX ${i.nombreOriginal}_new RENAME TO ${i.nombreOriginal};`)
}

/**
 * `GRANT` a replicar en la tabla nueva — ver el gotcha grande al principio del fichero. Se
 * aplican DESPUÉS de crear la tabla y ANTES del `swap` (mismo momento que los índices): entre
 * `create` y `swap` la tabla vieja sigue sirviendo con sus grants intactos, así que no hay
 * ventana de rotura real, pero conviene que la nueva ya los tenga para cuando llegue el rename.
 */
function ddlGrants(tabla = TABLA_NUEVA) {
  return GRANTS.map((g) => `GRANT ${g.privilegio} ON ${tabla} TO ${g.rol};`)
}

/**
 * `fechaISO` ('YYYY-MM-DD') a un literal de instante en UTC explícito, no una fecha bare que
 * dependería de la `TimeZone` de la sesión que ejecute el DDL. Confirmado en vivo (08/08) que la
 * sesión de RDS usa `TimeZone=UTC` — así que hoy `'2026-08-07'::timestamptz` ya da la medianoche
 * UTC correcta — pero la DDL no debería depender en silencio de ese ajuste de sesión: un cambio
 * de `TimeZone` en el grupo de parámetros de RDS (o quien aplique esto desde una sesión con OTRO
 * `TimeZone`) movería el límite de cada partición sin que ningún error lo avisara.
 */
function instanteUtc(fechaISO) {
  return `${fechaISO} 00:00:00+00`
}

function ddlParticion(fechaISO, tablaPadre = TABLA_NUEVA) {
  const desde = fechaISO
  const hasta = sumarDias(fechaISO, 1)
  return (
    `CREATE TABLE ${nombreParticion(fechaISO)} PARTITION OF ${tablaPadre} ` +
    `FOR VALUES FROM ('${instanteUtc(desde)}') TO ('${instanteUtc(hasta)}');`
  )
}

/**
 * Contrasta lo que `information_schema.role_table_grants` devolvió DE VERDAD contra los
 * `GRANTS` esperados — para `cmdVerify()`, tras el swap (T-360, hallazgo de revisión 08/08).
 *
 * ⚠️ NO todos los `GRANTS` son verificables desde cualquier rol, y el propio experimento con
 * `VENCE_LECTOR_URL` lo demuestra: consultando como `vence_lector`, `role_table_grants` devuelve
 * SOLO la fila de `vence_lector` — ni rastro del `GRANT INSERT ... TO vence_coordinacion`, que sí
 * existe (confirmado por archivo, `20260804_rol_coordinacion_flota.sql:70`). Postgres filtra esa
 * vista por current_user (grantee/grantor/rol con `WITH ADMIN OPTION`), no por superusuario. Así
 * que declarar "falta" un grant de OTRO rol sería un FALSO POSITIVO seguro, no una comprobación —
 * peor que no comprobar nada, porque miente con aplomo. Por eso se separan tres cubos: lo que este
 * rol puede confirmar que ESTÁ, lo que puede confirmar que FALTA, y lo que sencillamente no puede
 * juzgar (`noVisibles`) y necesita que alguien con más privilegio lo mire (`\dp observable_events`).
 *
 * @param {Array<{grantee:string, privilege_type:string}>} vistos  filas reales de role_table_grants
 * @param {string} rolActual  `current_user` de la conexión que consultó (p.ej. 'vence_lector')
 * @param {Array<{rol:string, privilegio:string}>} esperados  por defecto, GRANTS
 */
function evaluarGrantsTrasSwap(vistos, rolActual, esperados = GRANTS) {
  const hay = (g) => vistos.some((v) => v.grantee === g.rol && v.privilege_type === g.privilegio)
  const confirmados = []
  const faltantesConfirmados = []
  const noVisibles = []
  for (const g of esperados) {
    if (g.rol !== rolActual) {
      noVisibles.push(g)
    } else if (hay(g)) {
      confirmados.push(g)
    } else {
      faltantesConfirmados.push(g)
    }
  }
  return { confirmados, faltantesConfirmados, noVisibles }
}

module.exports = {
  TABLA,
  TABLA_NUEVA,
  COLUMNA_PARTICION,
  COLUMNAS,
  INDICES,
  GRANTS,
  sufijoFecha,
  nombreParticion,
  sumarDias,
  listaFechas,
  planParticiones,
  ddlCrearTablaParticionada,
  ddlIndices,
  ddlRenombrarIndicesTrasSwap,
  ddlGrants,
  instanteUtc,
  ddlParticion,
  evaluarGrantsTrasSwap,
}
