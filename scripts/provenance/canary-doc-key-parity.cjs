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
  'https://dogv.gva.es/datos/2026/03/12/pdf/2026_8057_es.pdf',
  'https://dogv.gva.es/datos/2026/03/12/pdf/2026_8057_va.pdf',
  'https://bocyl.jcyl.es/boletines/2026/06/24/pdf/BOCYL-D-24062026-120-22.pdf',
  'https://portaldogc.gencat.cat/ca/document-del-dogc/?documentId=1035641',
  // Añadidos en T-107 (25/07): el canary se había quedado en la lista anterior y no vigilaba
  // ninguno de ellos — el drift del eBOJA (JS lo tenía, RDS no) vivió sin que nadie lo viera.
  'https://www.gobiernodecanarias.org/boc/2024/239/3965.html',            // BOC (Canarias)
  'https://www.gobiernodecanarias.org/boc/2024/239/3965.pdf',             // BOC .pdf → mismo docKey
  'https://www.juntadeandalucia.es/boja/2024/191/27',                     // BOJA (Andalucía)
  'https://www.juntadeandalucia.es/eboja/2026/136/BOJA26-136-00016-9536-01_00340768.pdf', // eBOJA PDF → mismo docKey
  'https://www.xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0004_es.html',  // DOG (Galicia)
  'https://www.xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0004_gl.html',  // DOG _gl → mismo docKey
  'https://mia.aragon.es/documentos?csv=CSVS60B0W34IP1Q0XFIL',            // MIA (portal CSV Aragón)
  'https://carp-core-mia.aragon.es/rest/documentos/CSVS60B0W34IP1Q0XFIL/pdf', // MIA API → mismo docKey
  // Añadidos en T-221 (28/07): boletines cuyo enlace de anuncio ya emite el sensor.
  'https://miprincipado.asturias.es/bopa/disposiciones?p_p_id=x&p_r_p_dispositionReference=2026-06220', // BOPA (Asturias)
  'https://sede.gobiernodecanarias.org/boc/boc-a-2026-150-2685.pdf',     // BOC sede → mismo docKey que la web
  'https://www.gobiernodecanarias.org/boc/2026/150/2685.html',
  'https://bon.navarra.es/es/anuncio/-/texto/2026/146/1',                 // BON (Navarra)
  'https://bon.navarra.es/eu/anuncio/-/texto/2026/146/1',                 // BON /eu → mismo docKey
  'https://bomemelilla.es/bome/BOME-B-2026-6400/articulo/872',            // BOME: el ARTÍCULO, no el boletín
  'https://docm.jccm.es/docm/descargarArchivo.do?ruta=2026/07/23/pdf/2026_5573.pdf&tipo=rutaDocm', // DOCM
];

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  // SSL solo para RDS; el Postgres local (podman) es plano → permite simular local-first.
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
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
