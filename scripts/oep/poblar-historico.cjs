#!/usr/bin/env node
'use strict';
// poblar-historico.cjs <slug> — cose el paso AUTOMATIZABLE de poblar el histórico de una
// oposición y lo VERIFICA (gate), para que no se escape (como pasó el 25/07: se corrió el
// backfill en DRY sin --apply → las convocatorias quedaron sin OEP enlazada y el histórico
// mostraba el año de convocatoria en vez del año de OEP).
//
// La INVESTIGACIÓN + inserción de las convocatorias verificadas del BOE es PREVIA y manual
// (contenido legal, regla nuclear "nunca inventar"; ver docs/runbooks/historico-convocatorias-landing.md).
// Este comando: (1) corre el backfill de la entidad OEP con --apply, (2) comprueba que TODAS
// las convocatorias de <slug> con `oep_decreto` quedaron enlazadas a `oep` vía `convocatoria_oep`,
// (3) exit 1 (GATE) si alguna quedó sin enlace. Idempotente.
//
// Uso: node scripts/oep/poblar-historico.cjs <slug>
//      DATABASE_URL=... node scripts/oep/poblar-historico.cjs auxiliar-administrativo-estado

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { Client } = require('pg');

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('Uso: node scripts/oep/poblar-historico.cjs <slug>'); process.exit(2); }
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  if (!url) { console.error('❌ DATABASE_URL no configurado'); process.exit(2); }

  // (1) backfill de la entidad OEP CON --apply (idempotente). Falla ruidosamente si peta.
  console.log('▶ Corriendo backfill de la entidad OEP (--apply)…');
  execSync('node ' + path.join(__dirname, 'backfill-oep-entidad.cjs') + ' --apply', { stdio: 'inherit', env: process.env });

  // (2) GATE: ¿queda alguna convocatoria de <slug> con oep_decreto pero SIN OEP enlazada?
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const { rows } = await c.query(`
      SELECT cv."año", cv.oep_decreto,
             EXISTS (SELECT 1 FROM convocatoria_oep co WHERE co.convocatoria_id = cv.id) AS enlazada
      FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
      WHERE o.slug = $1 AND cv.oep_decreto IS NOT NULL AND btrim(cv.oep_decreto) <> ''
      ORDER BY cv."año" DESC`, [slug]);
    if (!rows.length) { console.log(`\n⚠️  ${slug}: no hay convocatorias con oep_decreto (¿poblaste las convocatorias antes?).`); process.exit(1); }
    const sin = rows.filter((r) => !r.enlazada);
    console.log(`\n=== ${slug}: ${rows.length} convocatorias con OEP, ${sin.length} sin enlazar ===`);
    for (const r of rows) console.log(`  ${r.enlazada ? '✅' : '❌'} ${r.año} — ${(r.oep_decreto || '').slice(0, 50)}`);
    if (sin.length) {
      console.error(`\n❌ GATE: ${sin.length} convocatoria(s) con oep_decreto SIN OEP enlazada. El histórico mostraría el año de convocatoria, no el de OEP. Revisa el parseo de oep_decreto en backfill-oep-entidad.cjs.`);
      process.exit(1);
    }
    console.log(`\n✅ ${slug}: histórico de OEP completo y enlazado. Revalida el tag 'landing' para que la landing lo sirva.`);
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
