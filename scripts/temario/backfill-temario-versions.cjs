#!/usr/bin/env node
'use strict';
//
// backfill-temario-versions.cjs — FASE 1: crea UNA temario_version `active`+default por oposición
// activa, asigna sus topics, y apunta la convocatoria vigente a esa versión. Backward-compatible:
// con 1 versión default por oposición, position_type sigue resolviendo 1:1 → serving intacto.
//
// Idempotente (solo crea versión si la oposición no tiene default; solo asigna topics con versión
// NULL). Transaccional en --apply. Maneja oposiciones sin convocatoria (label='base') y topics
// huérfanos (position_type sin oposición → se dejan NULL y se reportan).
//
// Uso: node scripts/temario/backfill-temario-versions.cjs [--apply]

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const APPLY = process.argv.includes('--apply');

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    const opos = (await c.query(
      `SELECT o.id, o.slug, replace(o.slug,'-','_') AS pt FROM oposiciones o WHERE o.is_active ORDER BY o.slug`
    )).rows;

    if (APPLY) await c.query('BEGIN');
    let creadas = 0, yaTenian = 0, topicsAsignados = 0, sinConvocatoria = 0;
    for (const o of opos) {
      // ¿ya tiene versión default? (idempotencia)
      const has = (await c.query(`SELECT id FROM temario_versions WHERE oposicion_id=$1 AND es_default LIMIT 1`, [o.id])).rows[0];
      let versionId;
      if (has) { yaTenian++; versionId = has.id; }
      else {
        const conv = (await c.query(
          `SELECT id, "año" AS anio FROM convocatorias WHERE oposicion_id=$1 AND is_current ORDER BY "año" DESC NULLS LAST LIMIT 1`, [o.id]
        )).rows[0];
        if (!conv) sinConvocatoria++;
        const label = conv && conv.anio ? String(conv.anio) : 'base';
        if (APPLY) {
          const v = (await c.query(
            `INSERT INTO temario_versions (oposicion_id, label, estado, es_default, source_convocatoria_id)
             VALUES ($1,$2,'active',true,$3) RETURNING id`, [o.id, label, conv ? conv.id : null])).rows[0];
          versionId = v.id;
          if (conv) await c.query(`UPDATE convocatorias SET temario_version_id=$2, updated_at=now() WHERE id=$1`, [conv.id, versionId]);
        }
        creadas++;
      }
      // asignar topics de esta oposición (por position_type) que aún no tienen versión
      if (APPLY && versionId) {
        const r = await c.query(`UPDATE topics SET temario_version_id=$2, updated_at=now() WHERE position_type=$1 AND temario_version_id IS NULL`, [o.pt, versionId]);
        topicsAsignados += r.rowCount;
      } else if (!APPLY) {
        const n = (await c.query(`SELECT count(*)::int n FROM topics WHERE position_type=$1 AND temario_version_id IS NULL`, [o.pt])).rows[0].n;
        topicsAsignados += n;
      }
    }
    // topics huérfanos: position_type que no corresponde a ninguna oposición activa
    const huerfanos = (await c.query(
      `SELECT count(*)::int n FROM topics t WHERE t.is_active AND t.temario_version_id IS NULL
       AND NOT EXISTS (SELECT 1 FROM oposiciones o WHERE o.is_active AND replace(o.slug,'-','_')=t.position_type)`
    )).rows[0].n;

    if (APPLY) await c.query('COMMIT');
    console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} — oposiciones=${opos.length} · versiones creadas=${creadas} (ya tenían=${yaTenian}) · topics asignados=${topicsAsignados} · oposiciones sin convocatoria=${sinConvocatoria}`);
    console.log(`   topics activos HUÉRFANOS (position_type sin oposición) = ${huerfanos}${huerfanos ? ' ⚠️ (quedan sin versión, revisar)' : ' ✅'}`);
    if (!APPLY) console.log('(usa --apply para escribir; transaccional)');
  } catch (e) {
    if (APPLY) await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
