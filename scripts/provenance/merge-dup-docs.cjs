#!/usr/bin/env node
'use strict';
//
// merge-dup-docs.cjs — fusiona documentos CANÓNICOS duplicados en el hub: filas con
// doc_key NULL (tipo<>'nota') cuyo doc_key canónico YA lo tiene otra fila (el superviviente)
// en la misma convocatoria. Son el mismo documento oficial clonado 2× (p.ej. txt.php y /pdfs).
// Repunta cualquier FK (hitos/epígrafe/señales source_documento_id) del duplicado al
// superviviente y BORRA el duplicado → el hub queda 100% canónico, sin huérfanos.
//
// Transaccional en --apply, dry-run por defecto. Idempotente. Local-first friendly (SSL cond.).

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
const CONSUMERS = ['convocatoria_hitos', 'topic_epigrafe_verification', 'oep_detection_signals'];

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    const dups = (await c.query(`SELECT id, convocatoria_id, url FROM convocatoria_documentos WHERE doc_key IS NULL AND tipo <> 'nota' AND url IS NOT NULL`)).rows;
    let merged = 0, repointed = 0, skipped = 0;
    if (APPLY) await c.query('BEGIN');
    for (const d of dups) {
      const { docKey } = canonicalizeBoletinUrl(d.url);
      if (!docKey) { skipped++; continue; }
      const surv = (await c.query(
        `SELECT id FROM convocatoria_documentos WHERE convocatoria_id=$1 AND doc_key=$2 AND id<>$3 LIMIT 1`,
        [d.convocatoria_id, docKey, d.id])).rows[0];
      if (!surv) { skipped++; continue; } // sin superviviente → no es un dup, dejar
      // repuntar FKs del dup al superviviente
      for (const t of CONSUMERS) {
        const r = await c.query(
          `UPDATE ${t} SET source_documento_id=$2 WHERE source_documento_id=$1${APPLY ? '' : ' AND false'}`,
          [d.id, surv.id]);
        // en dry-run el AND false no actualiza; contamos aparte
        if (APPLY) repointed += r.rowCount;
      }
      if (!APPLY) {
        for (const t of CONSUMERS) {
          const n = (await c.query(`SELECT count(*)::int n FROM ${t} WHERE source_documento_id=$1`, [d.id])).rows[0].n;
          repointed += n;
        }
      }
      if (APPLY) await c.query(`DELETE FROM convocatoria_documentos WHERE id=$1`, [d.id]);
      merged++;
    }
    if (APPLY) await c.query('COMMIT');
    console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} — duplicados fusionados=${merged}, FKs repuntados=${repointed}, saltados=${skipped}`);
    if (!APPLY) console.log('(usa --apply para escribir; transaccional)');
  } catch (e) {
    if (APPLY) await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
