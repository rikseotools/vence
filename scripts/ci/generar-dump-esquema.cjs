#!/usr/bin/env node
// scripts/ci/generar-dump-esquema.cjs — [T-644]
//
// Genera el dump de SOLO ESQUEMA (sin datos) que restaura la BD efímera del job de CI
// "Integration / perf / security" — decisión de Manuel (08/08/2026, pregunta #123): la fuente
// de verdad del esquema de test es la BD VIVA (pg_dump), no un replay de las 282 migraciones
// de supabase/migrations/ (17 asumen auth.uid()/auth.users de Supabase, 37 asumen los roles
// authenticated/service_role/anon, 3 usan pg_cron/pg_net — historia de un sistema del que esta
// casa ya se mudó el 04/07/2026; emularlo con un shim sería mantener una imitación de algo que
// ya no se usa, un silo por definición).
//
// ⚠️ NO VERIFICADO EJECUTÁNDOSE — este worker no tiene `pg_dump` ni `docker` en la máquina
// (comprobado: `which pg_dump` y `which docker` sin salida). Escrito con cuidado siguiendo la
// convención de conexión de este repo, pero el primer run real lo tiene que hacer alguien con
// esas herramientas — no lo des por bueno sin correrlo primero.
//
// Uso:
//   VENCE_SCHEMA_DUMP_URL="postgresql://…" node scripts/ci/generar-dump-esquema.cjs
//   (o exporta DATABASE_URL/VENCE_LECTOR_URL — se prueban en ese orden si no se da la var)
//
// Requiere que la credencial usada tenga permiso de LECTURA sobre las tablas y objetos del
// esquema `public` (pg_dump --schema-only NO necesita escritura, solo poder listar/leer
// definiciones vía los catálogos del sistema — cualquier rol de solo-SELECT sirve).
//
// Salida: supabase/schema-ci/schema.sql — con una primera línea que es EL marcador de fecha que
// lee el guardarraíl de frescura (lib/ci/schemaDumpFreshness.js, umbral por defecto 7 días,
// decisión de Manuel: "un dump viejo no da error, da un verde que no significa nada").

const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../..')
const SALIDA = path.join(ROOT, 'supabase/schema-ci/schema.sql')

function urlOrigen() {
  const candidatas = ['VENCE_SCHEMA_DUMP_URL', 'DATABASE_URL', 'VENCE_LECTOR_URL']
  for (const nombre of candidatas) {
    if (process.env[nombre]) return { url: process.env[nombre], origen: nombre }
  }
  console.error(
    '❌ No hay URL de origen. Exporta VENCE_SCHEMA_DUMP_URL (o DATABASE_URL / VENCE_LECTOR_URL) ' +
      'con una credencial de LECTURA sobre el esquema de RDS.',
  )
  process.exit(1)
}

function main() {
  const { url, origen } = urlOrigen()
  console.log(`→ Generando dump de esquema desde ${origen}…`)

  // pg_dump (libpq) acepta `sslmode=require` en la cadena de conexión sin necesitar la CA de
  // AWS: a diferencia del cliente `pg` de Node (ver lib/db/pgSsl.cjs, gotcha T-377), libpq en
  // modo `require` NO verifica la cadena de certificados, solo exige cifrado. NO tocar el
  // sslmode aquí — quitarlo (como hace pgConfig() para `pg`) sería la receta EQUIVOCADA para
  // esta herramienta distinta. Sin verificar esto en un run real: primer punto a confirmar.
  let dump
  try {
    dump = execFileSync(
      'pg_dump',
      [
        '--schema-only',
        '--no-owner',
        '--no-privileges',
        '--schema=public',
        url,
      ],
      { encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 },
    )
  } catch (e) {
    console.error('❌ pg_dump falló:', e.message)
    console.error('   ¿está pg_dump instalado y en PATH? ¿la URL tiene permiso de lectura del esquema?')
    process.exit(1)
  }

  const marcador = `-- VENCE_SCHEMA_DUMP_GENERADO_EN: ${new Date().toISOString()}\n`
  const contenido = marcador + dump

  fs.mkdirSync(path.dirname(SALIDA), { recursive: true })
  fs.writeFileSync(SALIDA, contenido, 'utf8')
  console.log(`✅ ${SALIDA} (${(contenido.length / 1024).toFixed(1)} KB)`)
  console.log('   Revisar a mano antes de comitear: que no se haya colado ningún dato (--schema-only')
  console.log('   no debería traer filas, pero algunas vistas/funciones incrustan literales).')
}

main()
