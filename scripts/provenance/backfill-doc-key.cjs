#!/usr/bin/env node
'use strict';
//
// backfill-doc-key.cjs — rellena convocatoria_documentos.doc_key en las filas legacy
// (clonadas antes del hub) usando el ÚNICO canonicalizador lib/convocatoria/canonicalizeBoletinUrl.
// Necesario para que ensure_convocatoria_documento ENCUENTRE la fila ya clonada y no duplique.
//
// Idempotente: solo toca filas con doc_key IS NULL. Ante colisión intra-convocatoria
// (dos filas → mismo (convocatoria_id, doc_key), p.ej. txt.php y /pdfs del mismo BOE
// clonados por separado), pone el doc_key en UNA (la mejor: con content_hash y más
// reciente) y deja las demás en NULL, reportándolas como duplicados a limpiar.
//
// Uso: node scripts/provenance/backfill-doc-key.cjs [--apply]   (sin --apply = dry-run)

const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
const { canonicalizeBoletinUrl } = require(path.join(__dirname, '..', '..', 'lib', 'convocatoria', 'canonicalizeBoletinUrl.cjs'));

// ── .env.local ──
try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const APPLY = process.argv.includes('--apply');
const RECANON = process.argv.includes('--recanonicalize');

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  if (!url) throw new Error('DATABASE_URL no configurada');
  // SSL solo para RDS; local (podman) es plano → permite pre-flight local-first.
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    // Modo RE-CANONICALIZE: recomputa doc_key de TODAS las filas con el canonicalizador
    // actual y actualiza las que cambien (p.ej. al añadir un patrón de boletín), saltando
    // colisiones. Necesario para que las filas legacy adopten un patrón nuevo. Idempotente.
    if (RECANON) {
      const all = (await c.query(`SELECT id, convocatoria_id, url, doc_key, tipo FROM convocatoria_documentos WHERE url IS NOT NULL`)).rows;
      let changed = 0, collisions = 0, samekey = 0;
      for (const r of all) {
        const { docKey } = canonicalizeBoletinUrl(r.url);
        if (!docKey || docKey === r.doc_key) { samekey++; continue; }
        if (r.tipo !== 'nota') {
          const clash = (await c.query(
            `SELECT 1 FROM convocatoria_documentos WHERE convocatoria_id=$1 AND doc_key=$2 AND id<>$3 LIMIT 1`,
            [r.convocatoria_id, docKey, r.id])).rows.length > 0;
          if (clash) { collisions++; continue; }
        }
        if (APPLY) await c.query(`UPDATE convocatoria_documentos SET doc_key=$2, updated_at=now() WHERE id=$1`, [r.id, docKey]);
        changed++;
      }
      console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} recanonicalize — cambiados=${changed}, colisiones_saltadas=${collisions}, sin_cambio=${samekey}`);
      if (!APPLY) console.log('(usa --apply para escribir)');
      return;
    }
    // Pares (convocatoria_id, doc_key) ya asignados en BD (por si se corre parcialmente)
    const taken = new Set();
    for (const r of (await c.query(`SELECT convocatoria_id, doc_key FROM convocatoria_documentos WHERE doc_key IS NOT NULL`)).rows) {
      taken.add(`${r.convocatoria_id}::${r.doc_key}`);
    }

    const rows = (await c.query(
      `SELECT id, convocatoria_id, url, content_hash, updated_at
       FROM convocatoria_documentos WHERE doc_key IS NULL AND url IS NOT NULL
       ORDER BY convocatoria_id, (content_hash IS NOT NULL) DESC, updated_at DESC NULLS LAST`
    )).rows;

    // En memoria: el primero del orden por (conv, docKey) gana; los demás = duplicados (NULL)
    let set = 0, dup = 0, noKey = 0;
    const dups = [];
    const ids = [], keys = [];
    for (const r of rows) {
      const { docKey } = canonicalizeBoletinUrl(r.url);
      if (!docKey) { noKey++; continue; }
      const gk = `${r.convocatoria_id}::${docKey}`;
      if (taken.has(gk)) { dup++; dups.push({ docKey, url: r.url }); continue; }
      taken.add(gk);
      ids.push(r.id); keys.push(docKey);
      set++;
    }
    if (APPLY && ids.length) {
      await c.query(
        `UPDATE convocatoria_documentos AS d SET doc_key = v.dk, updated_at = now()
         FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::text[]) AS dk) v
         WHERE d.id = v.id`, [ids, keys]);
    }
    console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} — candidatas=${rows.length}  doc_key puesto=${set}  duplicados_saltados=${dup}  sin_docKey=${noKey}`);
    if (dups.length) {
      console.log('  duplicados intra-convocatoria (dejados en NULL para limpieza posterior):');
      for (const d of dups.slice(0, 20)) console.log(`    ${d.docKey}  ${d.url}`);
      if (dups.length > 20) console.log(`    …y ${dups.length - 20} más`);
    }
    if (!APPLY) console.log('\n(usa --apply para escribir)');
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
