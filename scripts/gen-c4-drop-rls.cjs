#!/usr/bin/env node
// scripts/gen-c4-drop-rls.cjs
// Generador REPRODUCIBLE del draft C4 (drop de políticas RLS auth.uid()).
//
// Por qué existe: el draft `docs/roadmap/c4-drop-rls.draft.sql` se generó a mano
// el 25/06 y quedó INCOMPLETO — solo capturó las políticas con `auth.uid()` en la
// cláusula USING (qual) y se dejó 26 políticas INSERT/UPDATE cuyo `auth.uid()` vive
// en WITH CHECK. Aplicar C4 así dejaría esas políticas vivas → en Neon/RDS
// (sin función auth.uid()) las escrituras a ~17 tablas romperían. Este script lee
// pg_policies (fuente autoritativa) y emite el draft COMPLETO + regenerable, para
// que nunca vuelva a driftar: basta re-ejecutarlo antes de aplicar C4.
//
// Uso:  DATABASE_URL=... node scripts/gen-c4-drop-rls.cjs > docs/roadmap/c4-drop-rls.draft.sql
//       (o sin redirección para inspeccionar por stdout)
//
// NO aplica nada. Solo SELECT a pg_policies + genera SQL a stdout.

const fs = require('fs')
const path = require('path')

// Cargar DATABASE_URL de .env.local si no está en el entorno
function loadDbUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(process.cwd(), '.env.local')
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))
  if (!line) throw new Error('DATABASE_URL no encontrado (env ni .env.local)')
  return line.slice('DATABASE_URL='.length).trim().replace(/^['"]|['"]$/g, '')
}

const postgres = require(path.join(process.cwd(), 'node_modules', 'postgres'))

// Reconstruye un CREATE POLICY verbatim desde una fila de pg_policies (para el DOWN/rollback).
// `oneline` colapsa el whitespace interno de qual/with_check (pg_policies deparsea las
// subconsultas EXISTS en MULTILÍNEA) para que cada statement quepa en UNA línea física →
// así el prefijo `-- ` del bloque DOWN comenta el statement entero (no solo su 1ª línea).
// SQL es insensible a ese whitespace, el recreate sigue siendo verbatim-equivalente.
function recreate(p) {
  const oneline = (e) => (e == null ? null : String(e).replace(/\s+/g, ' ').trim())
  const roles = (p.roles && p.roles.length ? p.roles.join(', ') : 'public')
  let s = `CREATE POLICY "${p.policyname}" ON public.${p.tablename}`
  s += ` AS ${p.permissive === 'RESTRICTIVE' ? 'RESTRICTIVE' : 'PERMISSIVE'}`
  s += ` FOR ${p.cmd}`
  s += ` TO ${roles}`
  if (p.qual != null) s += ` USING (${oneline(p.qual)})`
  if (p.with_check != null) s += ` WITH CHECK (${oneline(p.with_check)})`
  return s + ';'
}

;(async () => {
  const sql = postgres(loadDbUrl(), { ssl: 'require', max: 1 })
  // TODAS las políticas cuyo USING (qual) o WITH CHECK invoque CUALQUIER función del schema
  // `auth` de Supabase: `auth.uid()` (user-scoped), `auth.role()`, `auth.jwt()`,
  // `auth.email()`, o cualquier helper que Supabase añada en el futuro. Ese schema es
  // Supabase-only: en RDS/Neon no existe, así que cualquier política que lo use rompe el
  // esquema y hay que dropearla (la app NO depende de RLS: C1/C2/C3 la sustituyen).
  //
  // Criterio ROBUSTO por regex `auth\.<ident>(` en vez de listar funciones a mano: matchea
  // la LLAMADA a función (identificador del schema auth + paréntesis), así NO matchea
  // literales de cadena como 'service_role' ni columnas. Historia del footgun (por qué NO
  // volver a enumerar a mano): el draft del 25/06 solo miraba `qual`; una primera versión del
  // generador solo `auth.uid()` (se dejaba 4 de `auth.role()`); tras añadir `auth.role()`
  // seguía dejándose `auth.jwt()` (user_avatar_settings "Service role full access") — cazado
  // por el piloto RDS al restaurar el esquema post-C4 y ver que la policy sobrevivía. El match
  // por familia cierra la clase entera de una vez.
  const AUTH_FN = 'auth\\.[a-z_]+\\s*\\('
  const rows = await sql`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual ~ ${AUTH_FN} OR with_check ~ ${AUTH_FN})
    ORDER BY tablename, policyname`
  await sql.end()

  const nTablas = new Set(rows.map((r) => r.tablename)).size
  const n = rows.length

  const out = []
  out.push('-- ============================================================================')
  out.push('-- C4 — DROP de políticas RLS que usan el schema auth.* de Supabase (DRAFT — ⚠️ NO APLICAR TODAVÍA)')
  out.push('-- ============================================================================')
  out.push('-- docs/roadmap/auth-agnostico-jwks-y-rls.md')
  out.push('-- GENERADO por scripts/gen-c4-drop-rls.cjs desde pg_policies (regenerable, NO editar a mano).')
  out.push('--')
  out.push('-- ESTE FICHERO ES UN BORRADOR. Está FUERA de supabase/migrations/ A PROPÓSITO')
  out.push('-- (las de esa carpeta se aplican a mano; aquí evitamos cualquier riesgo de que se')
  out.push('-- ejecute por error). Cuando se cumplan las precondiciones, RE-GENERAR este draft')
  out.push('-- (las tablas/políticas crecen al añadir oposiciones), revisar el diff, y mover el')
  out.push('-- bloque "UP" a supabase/migrations/<timestamp>_c4_drop_rls.sql.')
  out.push('--')
  out.push('-- PRECONDICIONES OBLIGATORIAS antes de aplicar (si falta una, NO aplicar):')
  out.push('--   1. C1+C2+C3 llevan ~1 semana estables en prod (autorización en app probada).')
  out.push('--   2. Resueltos los 3 .from de CLIENTE que aún tocan tablas user-scoped por')
  out.push('--      PostgREST (si se dropa RLS con ellos vivos = FUGA cross-user):')
  out.push('--        - contexts/AuthContext.tsx (dual-path flag-gated) → flip de Fase B.')
  out.push('--        - hooks/useIntelligentNotifications.ts loadProblematicArticles (×2) →')
  out.push('--          canary FASE 4/5 (user_problematic_articles / problematic_articles_logs).')
  out.push('--   3. Revisadas las políticas public-read (qual=true, inocuas) y lockdown — este')
  out.push('--      script SOLO dropa las políticas que llaman a auth.* (uid/role/jwt/…, en USING y/o WITH CHECK); las demás se quedan.')
  out.push('--   4. RE-GENERAR el draft (este script) inmediatamente antes, y probar contra copia de staging.')
  out.push('--')
  out.push('-- ROLLBACK: ejecutar el bloque "DOWN" (recrea las políticas verbatim). Reversible.')
  out.push(`-- Nº de políticas auth.* afectadas: ${n} (sobre ${nTablas} tablas).`)
  out.push('-- (Incluye WITH CHECK-only (uid) y auth.jwt()/auth.role() service-role — todo lo que el match a mano omitía.)')
  out.push('--')
  out.push('-- ============================================================================')
  out.push('-- UP — DROP de las políticas auth.uid() (ejecutar tras precondiciones)')
  out.push('-- ============================================================================')
  out.push('BEGIN;')
  out.push('')
  let lastTable = null
  for (const p of rows) {
    if (p.tablename !== lastTable) { if (lastTable !== null) out.push(''); lastTable = p.tablename }
    out.push(`DROP POLICY IF EXISTS "${p.policyname}" ON public.${p.tablename};`)
  }
  out.push('')
  out.push('COMMIT;')
  out.push('')
  out.push('-- ============================================================================')
  out.push('-- DOWN — recreación verbatim (rollback). Descomentar para revertir.')
  out.push('-- ============================================================================')
  lastTable = null
  for (const p of rows) {
    if (p.tablename !== lastTable) { if (lastTable !== null) out.push('--'); lastTable = p.tablename }
    out.push('-- ' + recreate(p))
  }
  out.push('')

  process.stdout.write(out.join('\n'))
})().catch((e) => { console.error('ERR', e.message); process.exit(1) })
