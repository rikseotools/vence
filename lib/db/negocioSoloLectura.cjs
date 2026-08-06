// lib/db/negocioSoloLectura.cjs — ¿CON QUÉ credencial leo una tabla de negocio? (T-624)
//
// ── QUÉ RESUELVE, Y QUÉ NO ──────────────────────────────────────────────────────────────────
// Esto responde **con qué URL**; `lib/db/pgSsl.cjs` → `pgConfig(url)` responde **cómo conectar
// con ella** (el gotcha del `sslmode` que pisa la opción `ssl`). Se COMPONEN, no se solapan:
//
//     const { Client } = require('pg')
//     const { pgConfig } = require('./pgSsl.cjs')
//     const { urlLecturaNegocio } = require('./negocioSoloLectura.cjs')
//     const c = new Client(pgConfig(urlLecturaNegocio()))
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────────────────────
// Hay DOS credenciales para DOS propósitos: `DATABASE_URL` es el rol de **coordinación**, que
// desde [T-539] solo alcanza las 4 tablas de la flota y da «permission denied» contra cualquier
// tabla de negocio; `VENCE_LECTOR_URL` es el rol de **lectura** ([T-486]), con SELECT sobre
// negocio y sin datos personales. Un script que solo lee negocio quiere SIEMPRE el segundo.
//
// Medido el 06/08/2026: **cuatro scripts** resolvían esto por su cuenta, cada uno con su propia
// versión de `VENCE_LECTOR_URL || DATABASE_URL` (`audit-temario-display-drift.cjs`,
// `health/kinds-evaluados.cjs`, `temario/revisar-oposicion.cjs`, `impugnaciones/revisar-impugnacion.cjs`).
// Cuatro copias del mismo criterio son cuatro sitios donde arreglarlo, y es exactamente cómo
// nacieron los cinco escritores de `seguimiento_url` ([T-130]).
//
// ── EL CASO QUE LAS COPIAS NO CUBRÍAN ───────────────────────────────────────────────────────
// Todas leen `process.env`. Pero varios scripts de la campaña [T-115] leían el `DATABASE_URL`
// **del fichero `.env.local` directamente**, ignorando el entorno — así que un trabajador de la
// flota que exportara `VENCE_LECTOR_URL` no tenía forma de usarlos. Por eso aquí se mira también
// el fichero, y en ese orden: el rol de MENOR privilegio disponible gana, venga de donde venga.
//
// ── PURO Y INYECTABLE A PROPÓSITO ───────────────────────────────────────────────────────────
// `resolver()` no toca el disco ni `process.env`: recibe los dos. La primera versión de esto se
// testeaba contra el `.env.local` REAL de la máquina, y su test pasaba en el portátil donde se
// escribió y **fallaba en cualquier otro worktree** (los worktrees copian el fichero, y no todos
// llevan `VENCE_LECTOR_URL`). Un test que depende de un fichero ignorado por git no prueba el
// código: prueba la máquina.
const fs = require('fs')
const path = require('path')

/** Orden de preferencia, de MENOR a mayor privilegio. Cambiarlo se hace aquí y en ningún sitio más. */
const PREFERENCIA = ['VENCE_LECTOR_URL', 'DATABASE_URL']

/** Extrae `CLAVE=valor` del texto de un `.env` (sin dependencias, sin evaluar nada). */
function delFichero(texto, clave) {
  const m = String(texto || '').match(new RegExp(`^${clave}=(.*)$`, 'm'))
  return m ? m[1].trim() : ''
}

/**
 * Núcleo puro: elige la URL sin tocar disco ni entorno global.
 *
 * Para cada credencial, en orden de menor privilegio, se mira PRIMERO el entorno y luego el
 * fichero. Es decir: `VENCE_LECTOR_URL` del fichero gana a `DATABASE_URL` del entorno — el rol
 * de lectura es el correcto para leer, no «el último que alguien exportó».
 *
 * @param {Record<string,string|undefined>} env      normalmente `process.env`
 * @param {string} envFile                            contenido de `.env.local` («» si no hay)
 * @returns {{url:string, fuente:string}|null}        `null` si no hay ninguna
 */
function resolver(env = {}, envFile = '') {
  for (const clave of PREFERENCIA) {
    const deEntorno = String(env[clave] || '').trim()
    if (deEntorno) return { url: deEntorno, fuente: `${clave} (entorno)` }
    const deFichero = delFichero(envFile, clave)
    if (deFichero) return { url: deFichero, fuente: `${clave} (.env.local)` }
  }
  return null
}

/** Lee `.env.local` de la raíz del repo. Devuelve «» si no existe (worktree de agente, CI…). */
function leerEnvLocal(raiz = path.join(__dirname, '..', '..')) {
  try { return fs.readFileSync(path.join(raiz, '.env.local'), 'utf8') } catch { return '' }
}

/**
 * URL con la que leer tablas de negocio. Lanza si no hay ninguna: quedarse sin credencial es un
 * error de configuración, no algo que se pueda degradar en silencio.
 *
 * @param {{env?:Record<string,string|undefined>, envFile?:string}} [opts] inyección para tests
 */
function urlLecturaNegocio(opts = {}) {
  const env = opts.env || process.env
  const envFile = opts.envFile !== undefined ? opts.envFile : leerEnvLocal()
  const r = resolver(env, envFile)
  if (!r) {
    throw new Error(
      'urlLecturaNegocio(): no hay VENCE_LECTOR_URL ni DATABASE_URL. ' +
      'Un trabajador de la flota necesita VENCE_LECTOR_URL exportado para leer tablas de negocio (T-486).',
    )
  }
  return r.url
}

/** Como `urlLecturaNegocio` pero devolviendo también DE DÓNDE salió, para poder decirlo en pantalla. */
function urlLecturaNegocioConFuente(opts = {}) {
  const env = opts.env || process.env
  const envFile = opts.envFile !== undefined ? opts.envFile : leerEnvLocal()
  return resolver(env, envFile)
}

module.exports = { urlLecturaNegocio, urlLecturaNegocioConFuente, resolver, PREFERENCIA }
