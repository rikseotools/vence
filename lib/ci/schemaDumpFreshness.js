// lib/ci/schemaDumpFreshness.js
// [T-644] Núcleo puro del guardarraíl de frescura del dump de esquema para la BD efímera de CI.
//
// Decisión de Manuel (08/08/2026, pregunta #123): el esquema de las 10 suites de escritura
// mudas se construye con un `pg_dump --schema-only` PERIÓDICO de la BD real, restaurado en un
// contenedor Postgres del propio runner — NO con un replay de las 282 migraciones (17 asumen
// `auth.uid()`/`auth.users` de Supabase, 37 asumen los roles `authenticated`/`service_role`/
// `anon`, 3 usan `pg_cron`/`pg_net` — historia de un sistema del que esta casa ya se mudó el
// 04/07/2026, y emularlo sería un silo cuyo único trabajo es imitar algo que no se usa).
//
// "Un dump viejo no da error, da un verde que no significa nada — que es como estas 10 suites
// llegaron a llevar años mudas." Por eso el job que restaura el dump tiene que FALLAR, no
// callar, si el dump lleva más de `UMBRAL_DIAS_DEFECTO` sin refrescarse.

/** Ajustar con lo que se vea en producción — empieza en 7 por indicación explícita de Manuel. */
const UMBRAL_DIAS_DEFECTO = 7

/** Primera línea del dump: el propio fichero lleva su fecha dentro, no un sidecar aparte. */
const MARCADOR_RE = /^-- VENCE_SCHEMA_DUMP_GENERADO_EN:\s*(\S+)\s*$/m

/**
 * Extrae la fecha de generación del dump, o null si el marcador no está o no es una fecha
 * válida. No lanza — un dump sin marcador es un dato ausente, no una excepción.
 * @param {string} contenidoSql
 * @returns {Date|null}
 */
function extraerFechaDump(contenidoSql) {
  if (typeof contenidoSql !== 'string' || !contenidoSql) return null
  const m = MARCADOR_RE.exec(contenidoSql)
  if (!m) return null
  const d = new Date(m[1])
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Días transcurridos entre la fecha del dump y "ahora". Negativo si el dump está fechado en
 * el futuro (reloj desincronizado) — se trata igual que "fresco", nunca como más viejo.
 * @param {Date} fechaDump
 * @param {Date} ahora
 * @returns {number}
 */
function diasDeAntiguedad(fechaDump, ahora) {
  const ms = ahora.getTime() - fechaDump.getTime()
  return ms / (1000 * 60 * 60 * 24)
}

/**
 * Veredicto completo: fresco / viejo / sin marcador. Es la única función que decide si el
 * guardarraíl deja pasar — el test solo la llama y afirma sobre lo que devuelve.
 * @param {string} contenidoSql
 * @param {Date} ahora
 * @param {number} [umbralDias]
 * @returns {{ fresco: boolean, motivo: string, dias: number|null, fecha: Date|null }}
 */
function veredictoFrescura(contenidoSql, ahora, umbralDias = UMBRAL_DIAS_DEFECTO) {
  const fecha = extraerFechaDump(contenidoSql)
  if (!fecha) {
    return { fresco: false, motivo: 'sin marcador de fecha (VENCE_SCHEMA_DUMP_GENERADO_EN)', dias: null, fecha: null }
  }
  const dias = diasDeAntiguedad(fecha, ahora)
  if (dias > umbralDias) {
    return { fresco: false, motivo: `dump de hace ${dias.toFixed(1)} días, umbral ${umbralDias}`, dias, fecha }
  }
  return { fresco: true, motivo: `dump de hace ${dias.toFixed(1)} días, dentro del umbral de ${umbralDias}`, dias, fecha }
}

module.exports = { UMBRAL_DIAS_DEFECTO, MARCADOR_RE, extraerFechaDump, diasDeAntiguedad, veredictoFrescura }
