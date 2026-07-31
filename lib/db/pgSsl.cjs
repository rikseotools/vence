// lib/db/pgSsl.cjs
//
// Configuración de conexión a RDS para node-postgres (`pg`). CJS a propósito: la
// usan tanto los scripts operativos (`require`) como los tests (`import`), y una
// sola fuente evita que vuelvan a divergir.
//
// EL GOTCHA, medido el 31/07/2026 (T-377):
//
//   A) { connectionString: <url con sslmode=require>, ssl:{rejectUnauthorized:false} }
//      → ❌ self-signed certificate in certificate chain
//   B) { connectionString: <url SIN sslmode>,        ssl:{rejectUnauthorized:false} }
//      → ✅ conecta
//
// En `pg`, el `sslmode` de la cadena de conexión PISA la opción `ssl` que le pases.
// Como la URL de RDS lleva `sslmode=require` y su certificado lo firma una CA privada
// de AWS, la forma (A) —que parece correcta y es la que se copió por todas partes—
// no conecta nunca. Lo que hace el trabajo es QUITAR el `sslmode`.
//
// Ojo: esto NO afecta a `postgres` (porsager), que sí respeta la opción `ssl`. Por eso
// convivían scripts que funcionaban con otros que no, sin patrón aparente.
//
// Qué rompió mientras nadie lo veía: 14 suites del job de integración (51 de sus 80
// fallos) y 3 canarios que imprimían el error y salían con **código 0**, o sea verdes
// sin haber mirado la BD — entre ellos `canary-landing-vs-bd.cjs`, el que vigila que
// las cifras publicadas de una landing coincidan con la BD.

/**
 * Quita el parámetro `sslmode` de una URL de conexión, dejando el resto intacto.
 * @param {string} url
 * @returns {string}
 */
function sinSslMode(url) {
  try {
    const u = new URL(url)
    u.searchParams.delete('sslmode')
    // `toString()` deja el '?' colgando cuando era el único parámetro
    return u.toString().replace(/\?$/, '')
  } catch {
    // Cadena no parseable: al menos quitar el parámetro sin romper el resto
    return url
      .replace(/[?&]sslmode=[^&]*/, m => (m[0] === '?' ? '?' : ''))
      .replace(/\?&/, '?')
      .replace(/\?$/, '')
  }
}

/**
 * Config lista para `new Client(...)` / `new Pool(...)` contra RDS.
 *
 * `rejectUnauthorized: false` es deliberado: el certificado lo firma una CA privada
 * de AWS que Node no trae. La alternativa correcta sería embarcar el bundle
 * `rds-ca-rsa2048-g1`; si algún día se hace, se cambia AQUÍ y en ningún otro sitio.
 *
 * @param {string} [url] por defecto `process.env.DATABASE_URL`
 */
function pgConfig(url = process.env.DATABASE_URL) {
  if (!url) throw new Error('pgConfig(): no hay URL de base de datos (DATABASE_URL)')
  return { connectionString: sinSslMode(url), ssl: { rejectUnauthorized: false } }
}

module.exports = { sinSslMode, pgConfig }
