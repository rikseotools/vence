#!/usr/bin/env node
// scripts/neon-readiness-audit.cjs
// AUDIT reproducible de "Neon/RDS-readiness" a nivel de BASE DE DATOS (Fase 6 del
// roadmap agnosticismo). Convierte la lista mantenida a mano "Qué seguiría rompiendo
// el swap a Neon/RDS" en algo VERIFICABLE contra la BD viva. SOLO LECTURA — no
// modifica nada.
//
// Detecta el acoplamiento Supabase a nivel de esquema que rompería un swap a una
// Postgres estándar (Neon/RDS), donde NO existen ni el schema `auth` (GoTrue) ni
// la función `auth.uid()`:
//   1. Funciones public que invocan auth.uid()/auth.jwt()/auth.role().
//   2. Políticas RLS con auth.uid() (las dropa C4 — aquí solo el conteo de control).
//   3. FKs de tablas de APP (public) hacia auth.users → hay que re-apuntarlas a
//      user_profiles.id antes del swap (auth.users no existe en RDS).
//   4. Vistas public que referencian el schema auth.
//   5. Extensiones no presentes por defecto en Neon/RDS (supabase_vault, pg_net, http).
//
// Uso:  DATABASE_URL=... node scripts/neon-readiness-audit.cjs
//       (carga .env.local si DATABASE_URL no está en el entorno)

const fs = require('fs')
const path = require('path')

function loadDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const line = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
    .split('\n').find((l) => l.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL no encontrado (env ni .env.local)')
  return line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
}

const postgres = require(path.join(process.cwd(), 'node_modules', 'postgres'))

// Extensiones que NO vienen de serie en Neon/RDS (hay que verificar uso real o sustituir).
const NON_PORTABLE_EXT = new Set(['supabase_vault', 'pg_net', 'http'])

;(async () => {
  const sql = postgres(loadDbUrl(), { ssl: 'require', max: 1 })

  // 1. Funciones public con auth.uid()/jwt()/role() (prokind='f' → pg_get_functiondef no peta en agregados)
  const fns = await sql`
    SELECT p.proname
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public' AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ~* 'auth\.(uid|jwt|role)\(\)'
    ORDER BY p.proname`

  // 2. Políticas RLS con auth.uid() (conteo de control; las dropa C4)
  const pol = await sql`
    SELECT count(*)::int n, count(DISTINCT tablename)::int t
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ILIKE '%auth.uid()%' OR with_check ILIKE '%auth.uid()%')`

  // 3. FKs de tablas de APP (public) → auth.users (las internas auth.*→auth.* no cuentan)
  const fks = await sql`
    SELECT DISTINCT conrelid::regclass::text AS tabla
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE c.contype = 'f'
      AND n.nspname = 'public'
      AND c.confrelid::regclass::text IN ('auth.users')
    ORDER BY 1`

  // 4. Vistas public que referencian el schema auth
  const views = await sql`
    SELECT table_name FROM information_schema.views
    WHERE table_schema = 'public' AND view_definition ~* 'auth\.'
    ORDER BY 1`

  // 5. Extensiones instaladas
  const ext = await sql`SELECT extname FROM pg_extension WHERE extname <> 'plpgsql' ORDER BY 1`

  await sql.end()

  const nonPortable = ext.map((e) => e.extname).filter((e) => NON_PORTABLE_EXT.has(e))

  console.log('================ NEON/RDS-READINESS AUDIT (BD) ================')
  console.log('')
  console.log(`1) Funciones public con auth.uid/jwt/role(): ${fns.length}`)
  fns.forEach((f) => console.log(`     - ${f.proname}`))
  console.log(`   → re-escribir param-driven o DROP antes del swap (auth.* no existe en RDS).`)
  console.log('')
  console.log(`2) Políticas RLS con auth.uid(): ${pol[0].n} sobre ${pol[0].t} tablas`)
  console.log(`   → las dropa C4 (scripts/gen-c4-drop-rls.cjs). Aquí solo control.`)
  console.log('')
  console.log(`3) FKs de tablas de APP → auth.users: ${fks.length} tablas`)
  fks.forEach((f) => console.log(`     - ${f.tabla}`))
  console.log(`   → auth.users NO existe en Neon/RDS. Re-apuntar el FK a user_profiles.id`)
  console.log(`     (mismo UUID) o dropar el FK, ANTES del swap. Blocker de esquema mayor.`)
  console.log('')
  console.log(`4) Vistas public que tocan el schema auth: ${views.length}`)
  views.forEach((v) => console.log(`     - ${v.table_name}`))
  console.log('')
  console.log(`5) Extensiones NO portables por defecto a Neon/RDS: ${nonPortable.length}`)
  nonPortable.forEach((e) => console.log(`     - ${e}`))
  console.log(`   (instaladas todas: ${ext.map((e) => e.extname).join(', ')})`)
  console.log('')
  console.log('===============================================================')
  console.log(`RESUMEN: ${fns.length} fns auth.* · ${pol[0].n} RLS auth.uid() · ${fks.length} FKs→auth.users · ${views.length} vistas auth · ${nonPortable.length} ext no-portables`)
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
