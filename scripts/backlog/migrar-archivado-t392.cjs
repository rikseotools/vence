#!/usr/bin/env node
/**
 * migrar-archivado-t392.cjs — Fase 3 de [T-392]: las ~350 tareas cerradas ANTES del ciclo de
 * archivado explícito pasan a `archivada` SIN re-verificar. La propia ficha lo dice: "el ciclo
 * aplica de la fecha de estreno en adelante" — repasar 350 cierres contra producción no es el
 * trabajo que esto resuelve, y bloquearía el estreno del ciclo por algo retroactivo.
 *
 * REQUIERE que la migración de esquema ya esté aplicada:
 *   supabase/migrations/20260805_backlog_archivado.sql
 * (columnas archived_at/archive_evidence/archived_by/requiere_archivo). El rol de coordinación de
 * la flota NO es owner de `backlog_tasks` — solo puede correr este backfill una PERSONA con la
 * credencial de owner, después de aplicar el ALTER TABLE.
 *
 * Idempotente: solo toca status='done' AND archived_at IS NULL. Ejecutar sin --apply primero.
 *
 *   node scripts/backlog/migrar-archivado-t392.cjs           # dry-run: cuenta y enseña 5 ejemplos
 *   node scripts/backlog/migrar-archivado-t392.cjs --apply   # escribe
 */
'use strict';
const path = require('path');
const fs = require('fs');
const { MOTIVO_MIGRACION, SID_MIGRACION } = require('../../lib/backlog/archivo.cjs');

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const REPO = path.join(__dirname, '..', '..');
  return fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

async function main() {
  const apply = process.argv.includes('--apply');
  const s = require('postgres')(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const pendientes = await s`
      SELECT id, title, closed_at FROM public.backlog_tasks
       WHERE status = 'done' AND archived_at IS NULL
       ORDER BY closed_at ASC NULLS LAST`;
    console.log(`${pendientes.length} tarea(s) 'done' sin archivar.`);
    for (const t of pendientes.slice(0, 5)) console.log(`   ${t.id}  ${String(t.title).slice(0, 70)}`);
    if (pendientes.length > 5) console.log(`   …y ${pendientes.length - 5} más`);
    if (!apply) { console.log('\n(dry-run — repite con --apply para escribir)'); return; }
    const filas = await s`
      UPDATE public.backlog_tasks
         SET archived_at = COALESCE(closed_at, now()),
             archive_evidence = ${MOTIVO_MIGRACION},
             archived_by = ${SID_MIGRACION},
             -- NULL a propósito, no false: no se AFIRMA que no tocaran superficie servida (no se
             -- analizó), solo que no entran en el cubo de "pendiente de archivar" retroactivamente.
             requiere_archivo = NULL
       WHERE status = 'done' AND archived_at IS NULL
      RETURNING id`;
    console.log(`✅ ${filas.length} archivada(s).`);
  } finally {
    await s.end({ timeout: 5 });
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
