#!/usr/bin/env node
'use strict';
//
// link-by-dockey.cjs — enlaza al HUB los consumidores cuya URL apunta a un documento YA clonado,
// casando por doc_key CANÓNICO (no url exacta) → pilla txt.php↔/pdfs del mismo BOE que el match
// exacto no ve. NO clona nada (cero fetch): solo enlaza a documentos existentes. Los que no tienen
// documento clonado quedan para su flujo (convocatoria_docs_incompletos / campaña).
//
// Cubre: convocatoria_hitos (por convocatoria_id) y oep_detection_signals (por la convocatoria
// vigente de su oposición). Idempotente. Uso: node scripts/provenance/link-by-dockey.cjs [--apply]

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
  const _url = (process.env.DATABASE_URL || '').split('?')[0];
  const _local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(_url);
  const c = new Client({ connectionString: _url, ssl: _local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    // índice en memoria: (convocatoria_id, doc_key) -> documento_id (solo canónicos, no notas)
    const docs = (await c.query(
      `SELECT id, convocatoria_id, doc_key FROM convocatoria_documentos WHERE doc_key IS NOT NULL AND tipo <> 'nota'`
    )).rows;
    const idx = new Map();
    for (const d of docs) idx.set(`${d.convocatoria_id}::${d.doc_key}`, d.id);

    // ── HITOS ──
    const hitos = (await c.query(
      `SELECT id, url, convocatoria_id FROM convocatoria_hitos
       WHERE source_documento_id IS NULL AND url IS NOT NULL AND convocatoria_id IS NOT NULL`
    )).rows;
    let hLinked = 0;
    for (const h of hitos) {
      const { docKey } = canonicalizeBoletinUrl(h.url);
      if (!docKey) continue;
      const did = idx.get(`${h.convocatoria_id}::${docKey}`);
      if (!did) continue;
      if (APPLY) await c.query(`UPDATE convocatoria_hitos SET source_documento_id=$2 WHERE id=$1`, [h.id, did]);
      hLinked++;
    }

    // ── SEÑALES OEP (por la convocatoria vigente de su oposición) ──
    const sigs = (await c.query(
      `SELECT s.id, s.source_url, cv.id AS convocatoria_id
       FROM oep_detection_signals s
       JOIN convocatorias cv ON cv.oposicion_id = s.oposicion_id AND cv.is_current
       WHERE s.source_documento_id IS NULL AND s.source_url IS NOT NULL`
    )).rows;
    let sLinked = 0;
    for (const sg of sigs) {
      const { docKey } = canonicalizeBoletinUrl(sg.source_url);
      if (!docKey) continue;
      const did = idx.get(`${sg.convocatoria_id}::${docKey}`);
      if (!did) continue;
      if (APPLY) await c.query(`UPDATE oep_detection_signals SET source_documento_id=$2 WHERE id=$1`, [sg.id, did]);
      sLinked++;
    }

    console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'} — hitos enlazados=${hLinked} (de ${hitos.length} candidatos) · señales enlazadas=${sLinked} (de ${sigs.length})`);
    if (!APPLY) console.log('(usa --apply para escribir)');
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
