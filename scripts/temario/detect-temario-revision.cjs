#!/usr/bin/env node
'use strict';
//
// detect-temario-revision.cjs — FASE 2: cola de REVISIÓN de temario. Lista las oposiciones
// activas cuya convocatoria vigente tiene un temario NO verificado del todo contra su fuente
// oficial (o cuya fuente cambió) → toca revisar el temario con el pipeline T-107 (verify:epigrafe
// /scope) y aplicar los diffs al temario vivo. NO copia nada; es solo detección (el humano revisa).
//
// Mismo criterio que el detector `temario_revision_pendiente` del health-sweep. Prioriza por usuarios.
// Uso: node scripts/temario/detect-temario-revision.cjs

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

// Query pura compartida con el health-sweep (mantener en sync).
const QUERY = `
  WITH tv AS (
    SELECT t.position_type,
           count(*)::int temas,
           count(*) FILTER (WHERE ev.state='verified_literal')::int verificados
    FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id=t.id
    WHERE t.is_active GROUP BY 1),
  users AS (SELECT target_oposicion pt, count(*)::int n FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1)
  SELECT replace(o.slug,'-','_') AS position_type, o.slug, COALESCE(u.n,0)::int usuarios, tv.temas, tv.verificados
  FROM tv
  JOIN oposiciones o ON o.is_active AND replace(o.slug,'-','_')=tv.position_type
  JOIN convocatorias cv ON cv.oposicion_id=o.id AND cv.is_current
  LEFT JOIN users u ON u.pt=tv.position_type
  WHERE tv.verificados < tv.temas
  ORDER BY usuarios DESC`;

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    const rows = (await c.query(QUERY)).rows;
    const usuarios = rows.reduce((a, r) => a + r.usuarios, 0);
    console.log(`Cola de revisión de temario: ${rows.length} oposiciones · ${usuarios} usuarios afectados`);
    console.log('(convocatoria vigente + temario no verificado del todo → revisar con verify:epigrafe/scope y aplicar al temario vivo)\n');
    for (const r of rows) console.log(`  ${r.slug} | ${r.usuarios} usuarios | ${r.verificados}/${r.temas} verificados`);
  } finally { await c.end(); }
}

module.exports = { QUERY };
if (require.main === module) main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
