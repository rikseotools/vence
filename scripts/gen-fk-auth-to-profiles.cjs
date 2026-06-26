#!/usr/bin/env node
// scripts/gen-fk-auth-to-profiles.cjs
// Genera el DRAFT de migración que re-apunta los FK `... -> auth.users(id)` a
// `user_profiles(id)` — precondición de esquema para el swap a Neon/RDS, donde
// `auth.users` (schema GoTrue) NO existe. Detectado por neon-readiness-audit.cjs.
//
// SOLO LEE la BD (pg_constraint + un orphan-check por FK) y emite SQL a stdout.
// NO aplica nada. El draft sale FUERA de supabase/migrations/ a propósito.
//
// Decisiones codificadas:
//   - `user_profiles.id -> auth.users.id` (la identidad raíz): se DROPea, no se
//     re-apunta (user_profiles pasa a ser la tabla raíz de identidad tras Fase B).
//   - El resto: DROP CONSTRAINT viejo + ADD CONSTRAINT nuevo -> user_profiles(id),
//     preservando ON DELETE/ON UPDATE.
//   - PRECONDICIÓN: el re-point FALLA si hay filas cuyo valor no está en
//     user_profiles (huérfanos auth.users-sin-perfil). El draft incluye el
//     orphan-check y NO debe aplicarse hasta que dé 0 (limpiar/backfill antes).
//
// Uso:  DATABASE_URL=... node scripts/gen-fk-auth-to-profiles.cjs > docs/roadmap/fk-auth-users-to-profiles.draft.sql

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
const ACTION = { a: 'NO ACTION', r: 'RESTRICT', c: 'CASCADE', n: 'SET NULL', d: 'SET DEFAULT' }

;(async () => {
  const sql = postgres(loadDbUrl(), { ssl: 'require', max: 1 })

  const fks = await sql`
    SELECT c.conname, r.relname AS src_table, a.attname AS src_col,
           c.confupdtype, c.confdeltype
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f' AND n.nspname = 'public'
      AND c.confrelid::regclass::text = 'auth.users'
    ORDER BY r.relname, a.attname`

  // Orphan check por FK (excepto user_profiles.id, que se DROPea)
  const repoint = fks.filter((f) => !(f.src_table === 'user_profiles' && f.src_col === 'id'))
  const dropOnly = fks.filter((f) => f.src_table === 'user_profiles' && f.src_col === 'id')
  const orphans = {}
  for (const f of repoint) {
    const key = `${f.src_table}.${f.src_col}`
    const q = `SELECT count(*)::int n FROM public.${f.src_table} t WHERE t.${f.src_col} IS NOT NULL ` +
              `AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.${f.src_col})`
    try { orphans[key] = (await sql.unsafe(q))[0].n } catch (e) { orphans[key] = `ERR:${e.message}` }
  }
  await sql.end()

  const withOrphans = Object.entries(orphans).filter(([, n]) => typeof n === 'number' && n > 0)
  const totalOrphans = withOrphans.reduce((s, [, n]) => s + n, 0)

  const o = []
  o.push('-- ============================================================================')
  o.push('-- RE-POINT de FKs auth.users(id) -> user_profiles(id) (DRAFT — ⚠️ NO APLICAR TODAVÍA)')
  o.push('-- ============================================================================')
  o.push('-- docs/roadmap/auth-agnostico-jwks-y-rls.md · GENERADO por scripts/gen-fk-auth-to-profiles.cjs')
  o.push('-- (regenerable desde pg_constraint; NO editar a mano). FUERA de supabase/migrations/ a propósito.')
  o.push('--')
  o.push('-- POR QUÉ: en Neon/RDS NO existe el schema `auth` (GoTrue). Cada FK que apunta a')
  o.push('-- auth.users(id) rompe el swap. user_profiles.id == auth.users.id (mismo UUID) y')
  o.push('-- user_profiles vive en NUESTRA Postgres → re-apuntamos los FK ahí.')
  o.push('--')
  o.push(`-- ESTADO (regenerar antes de aplicar; las tablas crecen): ${fks.length} FKs (${repoint.length} re-point + ${dropOnly.length} drop de identidad).`)
  o.push('--')
  o.push('-- 🚨 PRECONDICIÓN DE DATOS — el ADD CONSTRAINT FALLA si hay huérfanos (filas con')
  o.push('--    user-ref en auth.users pero NO en user_profiles). Estado actual del audit:')
  if (withOrphans.length === 0) {
    o.push('--    ✅ 0 huérfanos. Re-point aplicable (tras precondiciones de Fase B).')
  } else {
    o.push(`--    ❌ ${withOrphans.length} columna(s) con ${totalOrphans} filas huérfanas — LIMPIAR/backfill ANTES:`)
    for (const [k, n] of withOrphans) o.push(`--       - ${k}: ${n}`)
    o.push('--    (Decidir por tabla: DELETE de la fila huérfana, o backfill del user_profiles que falta.')
    o.push('--     Las *_pre_outbox son tablas de archivo — probablemente droppables sin backfill.)')
  }
  o.push('--')
  o.push('-- ROLLBACK: bloque DOWN (re-apunta de vuelta a auth.users). Solo válido mientras auth.users exista.')
  o.push('-- ============================================================================')
  o.push('')
  o.push('-- Verificación de precondición (debe devolver 0 filas para poder aplicar el UP):')
  o.push('--   Ejecuta este SELECT y confirma 0 antes de continuar.')
  o.push('/*')
  o.push('SELECT * FROM (')
  o.push(repoint.map((f) =>
    `  SELECT '${f.src_table}.${f.src_col}' AS fk, count(*)::int AS orphans FROM public.${f.src_table} t ` +
    `WHERE t.${f.src_col} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = t.${f.src_col})`
  ).join('\n  UNION ALL\n'))
  o.push(') q WHERE orphans > 0;')
  o.push('*/')
  o.push('')
  o.push('-- ============================================================================')
  o.push('-- UP — drop de identidad raíz + re-point del resto (ejecutar tras precondiciones)')
  o.push('-- ============================================================================')
  o.push('BEGIN;')
  o.push('')
  for (const f of dropOnly) {
    o.push(`-- identidad raíz: user_profiles.id deja de referenciar auth.users (pasa a ser raíz)`)
    o.push(`ALTER TABLE public.${f.src_table} DROP CONSTRAINT IF EXISTS "${f.conname}";`)
  }
  o.push('')
  let last = null
  for (const f of repoint) {
    if (f.src_table !== last) { if (last !== null) o.push(''); last = f.src_table }
    const newName = `${f.src_table}_${f.src_col}_profiles_fkey`
    const onDel = ACTION[f.confdeltype] || 'NO ACTION'
    const onUpd = ACTION[f.confupdtype] || 'NO ACTION'
    o.push(`ALTER TABLE public.${f.src_table} DROP CONSTRAINT IF EXISTS "${f.conname}";`)
    o.push(`ALTER TABLE public.${f.src_table} ADD CONSTRAINT "${newName}" ` +
           `FOREIGN KEY (${f.src_col}) REFERENCES public.user_profiles(id) ON DELETE ${onDel} ON UPDATE ${onUpd};`)
  }
  o.push('')
  o.push('COMMIT;')
  o.push('')
  o.push('-- ============================================================================')
  o.push('-- DOWN — revertir a auth.users (descomentar; solo válido si auth.users aún existe)')
  o.push('-- ============================================================================')
  for (const f of repoint) {
    const newName = `${f.src_table}_${f.src_col}_profiles_fkey`
    const onDel = ACTION[f.confdeltype] || 'NO ACTION'
    const onUpd = ACTION[f.confupdtype] || 'NO ACTION'
    o.push(`-- ALTER TABLE public.${f.src_table} DROP CONSTRAINT IF EXISTS "${newName}";`)
    o.push(`-- ALTER TABLE public.${f.src_table} ADD CONSTRAINT "${f.conname}" FOREIGN KEY (${f.src_col}) REFERENCES auth.users(id) ON DELETE ${onDel} ON UPDATE ${onUpd};`)
  }
  o.push('')

  process.stdout.write(o.join('\n'))
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
