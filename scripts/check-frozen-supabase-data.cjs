#!/usr/bin/env node
// Guardarraíl anti-recurrencia: caza scripts .cjs que leen/escriben TABLAS DE DATOS
// contra la Supabase CONGELADA (self-hosted en auth.vence.es) usando supabase-js crudo
// en vez del shim agnóstico (`scripts/lib/pg-agnostic-client.cjs`) o pg/RDS directo.
//
// Contexto (cutover 04/07/2026 → AWS RDS): las tablas de datos viven en RDS; Supabase
// quedó congelada como espejo (pero SIGUE VIVA porque aún sirve auth/storage, no migrados).
// Un script que hace createClient(SUPABASE_URL).from('questions') lee un SNAPSHOT MUERTO
// en silencio — o, si escribe, manda datos a un espejo que nunca llega a prod. La migración
// masiva (commit 5b6a2f30) repuntó ~540 scripts al shim; quedan one-offs legacy. Este guard
// evita que el patrón REGRESE y mantiene un inventario siempre actualizado de los que quedan.
//
// Detección ESTÁTICA (no toca la BD): un fichero es OFENSOR si
//   (a) crea cliente supabase-js crudo apuntando a SUPABASE_URL,  y
//   (b) NO usa el shim pg-agnostic ni pg/DATABASE_URL,  y
//   (c) accede a una TABLA de datos vía `.from(` (o `.rpc(` de datos).
// Excepción LEGÍTIMA: scripts SOLO de auth/storage (login, reset de contraseña, subida a
// buckets) — esos DEBEN seguir en Supabase. Se listan en LEGIT_AUTH_STORAGE.
//
// Trinquete: si el nº de ofensores <= BASELINE, pasa (legacy conocido tolerado). Si aparece
// uno NUEVO (> BASELINE), falla con --fail. Al archivar/migrar legacy, BAJAR el BASELINE.
//
// Uso:
//   node scripts/check-frozen-supabase-data.cjs            # informa (inventario + conteo)
//   node scripts/check-frozen-supabase-data.cjs --list     # + lista completa con tablas
//   node scripts/check-frozen-supabase-data.cjs --fail     # exit 1 si ofensores > BASELINE (CI)

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname);

// Ofensores legacy tolerados hoy. BAJAR conforme se archiven/migren (nunca subir a mano
// sin justificar: si sube, es una regresión y el guard debe cazarla).
// 105 (19/07) → 101 tras neutralizar 4 one-offs de escritura con el sentinel de abajo.
const BASELINE = 101;

// Marcador que un one-off obsoleto lleva cuando se ha NEUTRALIZADO en sitio (aborta salvo
// escape consciente). No cuenta como ofensor: ya no puede escribir/leer la congelada.
const NEUTRALIZED_SENTINEL = 'FROZEN-SUPABASE-NEUTRALIZED';

// Scripts SOLO de auth/storage — legítimos contra Supabase (auth/storage NO migraron a RDS).
// Rutas relativas a scripts/. Si uno de estos empieza a leer tablas de datos, quítalo de aquí.
const LEGIT_AUTH_STORAGE = new Set([
  'recovery/send_laura_umu.cjs',
  'recovery/send_lu.cjs',
  'upload-outlook-course.cjs',
  'upload-video-courses.cjs',
]);

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules') continue;
      out.push(...walk(full));
    } else if (e.isFile() && e.name.endsWith('.cjs')) {
      out.push(full);
    }
  }
  return out;
}

function classify(src) {
  const hasRawClient = /createClient\s*\(/.test(src) && /SUPABASE_URL/.test(src);
  const usesShim = /pg-agnostic-client/.test(src);
  const usesPg = /DATABASE_URL/.test(src) || /require\(['"](postgres|pg)['"]\)/.test(src);
  const touchesData = /\.from\s*\(/.test(src);
  const authStorage = /\.auth\b|\.storage\b/.test(src);
  return { hasRawClient, usesShim, usesPg, touchesData, authStorage };
}

function tablesOf(src) {
  const t = new Set();
  for (const m of src.matchAll(/\.from\(\s*['"]([a-z0-9_]+)['"]/g)) t.add(m[1]);
  return [...t].sort();
}

const files = walk(SCRIPTS_DIR);
const offenders = [];

for (const full of files) {
  const rel = path.relative(SCRIPTS_DIR, full);
  if (rel === 'lib/pg-agnostic-client.cjs') continue; // el shim mismo
  const src = fs.readFileSync(full, 'utf8');
  const c = classify(src);
  if (!c.hasRawClient) continue;      // no habla con Supabase crudo
  if (c.usesShim) continue;           // ya migrado al shim → seguro
  if (!c.touchesData) continue;       // solo auth/storage → legítimo
  if (LEGIT_AUTH_STORAGE.has(rel)) continue; // whitelist auth/storage confirmada
  if (src.includes(NEUTRALIZED_SENTINEL)) continue; // neutralizado en sitio (aborta en run)
  const writes = /\.(insert|update|upsert|delete)\s*\(/.test(src);
  offenders.push({ rel, writes, tables: tablesOf(src) });
}

offenders.sort((a, b) => (b.writes - a.writes) || a.rel.localeCompare(b.rel));

const nWrite = offenders.filter(o => o.writes).length;
console.log(`Scripts que leen/escriben tablas de datos contra Supabase CONGELADA (supabase-js crudo, sin shim):`);
console.log(`  Total ofensores: ${offenders.length}  (baseline tolerado: ${BASELINE})`);
console.log(`  De ellos ESCRIBEN (riesgo alto: writes al espejo muerto): ${nWrite}`);

if (process.argv.includes('--list')) {
  console.log('');
  for (const o of offenders) {
    console.log(`  ${o.writes ? '✍️ ' : '👁 '} ${o.rel.padEnd(58)} ${o.tables.join(', ')}`);
  }
}

if (offenders.length > BASELINE) {
  console.error(`\n❌ REGRESIÓN: ${offenders.length} ofensores > baseline ${BASELINE}.`);
  console.error(`   Un script nuevo lee/escribe la Supabase congelada. Usa el shim`);
  console.error(`   (scripts/lib/pg-agnostic-client.cjs) o pg/DATABASE_URL contra RDS.`);
  if (process.argv.includes('--fail')) process.exit(1);
} else if (offenders.length < BASELINE) {
  console.log(`\n✅ ${BASELINE - offenders.length} ofensor(es) menos que el baseline: BAJA BASELINE a ${offenders.length} en el guard.`);
} else {
  console.log(`\n✅ Sin regresiones (== baseline).`);
}
