#!/usr/bin/env node
'use strict';
//
// repoint-nota-to-canonical.cjs — repara los consumidores que enlazaron a una NOTA de monitoreo
// en vez de al documento CANÓNICO (bug pre-fix: ensure_convocatoria_documento no filtraba tipo,
// así que su SELECT por doc_key podía devolver una nota). Para cada epígrafe/hito cuyo
// source_documento_id apunta a un tipo='nota', re-ejecuta ensure_ (ya arreglado → crea/encuentra
// el CANÓNICO) desde su URL y repunta el FK. Idempotente. Local-first (SSL condicional).
//
// Uso: node scripts/provenance/repoint-nota-to-canonical.cjs [--apply]

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

// Un consumidor: tabla, columna URL, columna convocatoria, fuente para ensure_.
const CONSUMERS = [
  { table: 'topic_epigrafe_verification', key: 'topic_id', urlCol: 'source_url', convCol: 'source_convocatoria_id', fuente: 'epigrafe-verify' },
  { table: 'convocatoria_hitos', key: 'id', urlCol: 'url', convCol: 'convocatoria_id', fuente: 'seguimiento' },
];

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    let total = 0;
    for (const cons of CONSUMERS) {
      const rows = (await c.query(
        `SELECT x.${cons.key} AS k, x.${cons.urlCol} AS url, x.${cons.convCol} AS conv
         FROM ${cons.table} x
         JOIN convocatoria_documentos cd ON cd.id = x.source_documento_id
         WHERE cd.tipo = 'nota' AND x.${cons.urlCol} IS NOT NULL AND x.${cons.convCol} IS NOT NULL`)).rows;
      let repointed = 0, noKey = 0;
      const cache = {};
      for (const r of rows) {
        const { docKey, canonicalUrl } = canonicalizeBoletinUrl(r.url);
        if (!docKey) { noKey++; continue; }
        const gk = `${r.conv}::${docKey}`;
        if (APPLY) {
          if (!(gk in cache)) {
            const d = await c.query(
              `SELECT ensure_convocatoria_documento($1,$2,$3,$4,$5,$6,$7,$8) AS id`,
              [r.conv, docKey, canonicalUrl, null, 'convocatoria', null, null, cons.fuente]);
            cache[gk] = d.rows[0].id;
          }
          await c.query(`UPDATE ${cons.table} SET source_documento_id=$2 WHERE ${cons.key}=$1`, [r.k, cache[gk]]);
        }
        repointed++;
      }
      console.log(`${cons.table}: apuntaban a nota=${rows.length} → repuntados a canónico=${repointed} (sin docKey=${noKey})`);
      total += repointed;
    }
    console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} — total repuntados=${total}`);
    if (!APPLY) console.log('(usa --apply para escribir)');
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
