// lib/db/negocioSoloLectura.cjs
//
// Resuelve la URL de conexión para scripts que SOLO LEEN tablas de negocio
// (articles, questions, topic_scope…). Preferir SIEMPRE el rol de lectura
// (`vence_lector`, T-486) sobre el de coordinación (`DATABASE_URL`), que
// desde T-539 está restringido a las 4 tablas de coordinación de la flota
// y da "permission denied" contra cualquier tabla de negocio.
//
// GOTCHA que esto evita: varios scripts de la campaña T-115
// (huerfanos-plan.cjs, verificar-articulos-vs-boe.cjs…) leían el
// `DATABASE_URL` directamente del fichero `.env.local`, ignorando
// `process.env` — así que un trabajador de la flota con `DATABASE_URL`
// restringido no tenía forma de usarlos aunque exportara `VENCE_LECTOR_URL`.
// Con dos credenciales distintas para dos propósitos distintos, un único
// punto de resolución evita que cada script reinvente el fallback.
//
// Preferencia: process.env.VENCE_LECTOR_URL > VENCE_LECTOR_URL en .env.local
// > process.env.DATABASE_URL > DATABASE_URL en .env.local. Es SOLO LECTURA
// (SELECT), así que preferir el rol de menor privilegio es correcto también
// para sesiones interactivas, no solo para trabajadores.
const fs = require('fs')
const path = require('path')

function leerEnvLocal() {
  const envPath = path.join(__dirname, '..', '..', '.env.local')
  try {
    return fs.readFileSync(envPath, 'utf8')
  } catch {
    return ''
  }
}

function urlLecturaNegocio() {
  if (process.env.VENCE_LECTOR_URL) return process.env.VENCE_LECTOR_URL.trim()
  const envFile = leerEnvLocal()
  const lector = envFile.match(/^VENCE_LECTOR_URL=(.*)$/m)
  if (lector) return lector[1].trim()
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim()
  const coordinacion = envFile.match(/^DATABASE_URL=(.*)$/m)
  if (coordinacion) return coordinacion[1].trim()
  throw new Error('urlLecturaNegocio(): no hay VENCE_LECTOR_URL ni DATABASE_URL disponibles')
}

module.exports = { urlLecturaNegocio }
