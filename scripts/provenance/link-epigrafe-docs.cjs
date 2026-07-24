#!/usr/bin/env node
'use strict';
//
// link-epigrafe-docs.cjs — enlaza al HUB los epígrafes ya verificados ANTES del hub:
// topic_epigrafe_verification con source_url pero source_documento_id NULL. Canonicaliza
// la URL → ensure_convocatoria_documento (dedup) → fija source_documento_id. Cierra los
// huérfanos "enlazables" que muestra el detector epigrafe_provenance_no_doc.
//
// Los que NO tienen source_url NO se tocan (necesitan re-sourcing por la campaña T-107).
// Idempotente. Uso: node scripts/provenance/link-epigrafe-docs.cjs [--apply]

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const { canonicalizeBoletinUrl } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'canonicalizeBoletinUrl.cjs'));

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
  if (!url) throw new Error('DATABASE_URL no configurada');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const rows = (await c.query(
      `SELECT ev.topic_id, ev.source_url, ev.source_convocatoria_id, ev.source_notes
       FROM topic_epigrafe_verification ev
       WHERE ev.state = 'verified_literal' AND ev.source_documento_id IS NULL
         AND ev.source_url IS NOT NULL AND ev.source_convocatoria_id IS NOT NULL`
    )).rows;

    const docCache = {}; // `${conv}::${docKey}` -> documento_id
    let linked = 0, noKey = 0;
    for (const r of rows) {
      const { docKey, canonicalUrl } = canonicalizeBoletinUrl(r.source_url);
      if (!docKey) { noKey++; continue; }
      const gk = `${r.source_convocatoria_id}::${docKey}`;
      if (APPLY) {
        if (!(gk in docCache)) {
          const d = await c.query(
            `SELECT ensure_convocatoria_documento($1,$2,$3,$4,$5,$6,$7,$8) AS id`,
            [r.source_convocatoria_id, docKey, canonicalUrl, null, 'convocatoria', r.source_notes || null, null, 'epigrafe-verify']);
          docCache[gk] = d.rows[0].id;
        }
        await c.query(`UPDATE topic_epigrafe_verification SET source_documento_id=$2 WHERE topic_id=$1`, [r.topic_id, docCache[gk]]);
      }
      linked++;
    }
    console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} — enlazables=${rows.length}  enlazados=${linked}  sin_docKey=${noKey}`);
    if (!APPLY) console.log('(usa --apply para escribir)');
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
