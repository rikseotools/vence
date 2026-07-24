#!/usr/bin/env node
'use strict';
//
// canary-doc-key-parity.cjs — guardarraíl anti-drift: el canonicalizador JS
// (lib/convocatoria/canonicalizeBoletinUrl.cjs) y el espejo SQL (boletin_doc_key) DEBEN
// coincidir en los boletines RECONOCIDOS (BOE/BOCM). Si divergen, el backend (SQL) y los
// scripts (JS) generarían doc_keys distintos → dedup roto. Salida !=0 si hay discrepancia.

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

// Fixtures RECONOCIDOS: donde JS y SQL deben dar el MISMO doc_key.
const FIXTURES = [
  'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262',
  'https://www.boe.es/boe/dias/2025/12/22/pdfs/BOE-A-2025-26262.pdf',
  'https://sede.inap.gob.es/sites/sede/files/public/2026-03/BOE-A-2026-6249.pdf',
  'https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/18/BOCM-20260218-2.PDF',
  'https://www.boe.es/buscar/act.php?id=BOE-A-2023-7500',
  'https://www.boe.es/x?id=BOE-B-2026-123',
];

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    const mismatch = [];
    for (const u of FIXTURES) {
      const js = canonicalizeBoletinUrl(u).docKey;
      const sql = (await c.query('SELECT boletin_doc_key($1) AS k', [u])).rows[0].k;
      if (js !== sql) mismatch.push({ u, js, sql });
    }
    if (mismatch.length) {
      console.error('❌ DRIFT JS↔SQL en doc_key:');
      for (const m of mismatch) console.error(`   ${m.u}\n     js=${m.js}  sql=${m.sql}`);
      process.exit(1);
    }
    console.log(`✅ paridad JS↔SQL OK (${FIXTURES.length} boletines reconocidos)`);
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
