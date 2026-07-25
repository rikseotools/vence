#!/usr/bin/env node
'use strict';
// clonar-oep-documento.cjs — F1/F3 de T-108: clona el documento oficial de un decreto de OEP en
// el hub de provenance (`convocatoria_documentos`, tipo='oep_decreto') y lo enlaza a la entidad
// `oep` (source_documento_id) + al hub inverso (convocatoria_documentos.oep_id). Reutiliza el
// canonicalizador y `ensure_convocatoria_documento` (mismo camino que epígrafes/convocatorias).
//
// Uso: node scripts/oep/clonar-oep-documento.cjs <oep_id> <fuente_url> [--pdf|--boe-xml]
//   o programático: require(...).clonarOepDoc(client, { oepId, url, fetchText })
//
// El hub es convocatoria-scoped → el doc se cuelga de la convocatoria is_current de la oposición
// de esa OEP (siempre existe una fila). doc_key dedup evita clonar dos veces el mismo decreto.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Client } = require('pg');
const { canonicalizeBoletinUrl } = require('../../lib/convocatoria/canonicalizeBoletinUrl.cjs');

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

/**
 * Clona el doc de un decreto de OEP en el hub y lo enlaza a la entidad oep.
 * @param {Client} c  cliente pg conectado
 * @param {{oepId:string, url:string, extractedText?:string, contentHash?:string, titulo?:string}} p
 * @returns {Promise<{docId:string, docKey:string}>}
 */
async function clonarOepDoc(c, { oepId, url, extractedText = null, contentHash = null, titulo = null }) {
  const oep = (await c.query(`SELECT o.id, o.oposicion_id, o.decreto, o."año_oep" FROM oep o WHERE o.id=$1`, [oepId])).rows[0];
  if (!oep) throw new Error(`oep ${oepId} no existe`);
  const conv = (await c.query(
    `SELECT id FROM convocatorias WHERE oposicion_id=$1 AND is_current=true LIMIT 1`, [oep.oposicion_id])).rows[0]
    || (await c.query(`SELECT id FROM convocatorias WHERE oposicion_id=$1 ORDER BY "año" DESC LIMIT 1`, [oep.oposicion_id])).rows[0];
  if (!conv) throw new Error(`la oposición de la oep ${oepId} no tiene convocatoria donde colgar el doc`);
  const { docKey, canonicalUrl } = canonicalizeBoletinUrl(url);
  const hash = contentHash || (extractedText ? crypto.createHash('sha256').update(extractedText).digest('hex') : null);
  const tit = titulo || `OEP ${oep.año_oep}${oep.decreto ? ' — ' + oep.decreto : ''}`;
  const r = await c.query(
    `SELECT ensure_convocatoria_documento($1,$2,$3,$4,'oep_decreto',$5,$6,'oep-backfill') AS id`,
    [conv.id, docKey, canonicalUrl, hash, tit, extractedText]);
  const docId = r.rows[0].id;
  // asegurar texto/hash aunque la fila existiese sin ellos. Y PROMOVER el tipo: si `ensure_` dedupó
  // por doc_key y devolvió un doc pre-existente con otro tipo (p.ej. 'otro'/'convocatoria'), es el
  // MISMO documento oficial que estamos clonando como decreto de OEP → tipo='oep_decreto' (mantiene
  // la invariante source_documento_id→oep_decreto). NUNCA toca notas (`ensure_` ya las excluye).
  if (extractedText) await c.query(
    `UPDATE convocatoria_documentos SET extracted_text=COALESCE(extracted_text,$2), content_hash=COALESCE(content_hash,$3), oep_id=$4, tipo='oep_decreto' WHERE id=$1`,
    [docId, extractedText, hash, oepId]);
  else await c.query(`UPDATE convocatoria_documentos SET oep_id=$2, tipo='oep_decreto' WHERE id=$1`, [docId, oepId]);
  // enlazar la entidad oep al doc + fijar fuente/doc_key
  await c.query(`UPDATE oep SET source_documento_id=$2, doc_key=$3, fuente_url=COALESCE(fuente_url,$4) WHERE id=$1`,
    [oepId, docId, docKey, canonicalUrl]);
  return { docId, docKey };
}

module.exports = { clonarOepDoc };

// CLI
async function main() {
  const [oepId, url, ...flags] = process.argv.slice(2);
  if (!oepId || !url) { console.log('Uso: node scripts/oep/clonar-oep-documento.cjs <oep_id> <fuente_url> [--boe-xml]'); process.exit(1); }
  const c = new Client({ connectionString: (process.env.DATABASE_URL || '').split('?')[0], ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    // fetch verbatim del texto (BOE xml o curl genérico); si falla, clona la referencia sin texto
    let text = null;
    try {
      if (flags.includes('--boe-xml') || /boe\.es/.test(url)) {
        const id = (url.match(/BOE-[ABS]-\d{4}-\d+/i) || [])[0];
        if (id) { const res = await fetch(`https://www.boe.es/diario_boe/xml.php?id=${id}`); const xml = await res.text();
          text = xml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/[ \t]+/g, ' ').trim(); }
      }
    } catch (e) { console.warn('fetch texto falló, clono la referencia sin texto:', e.message); }
    const { docId, docKey } = await clonarOepDoc(c, { oepId, url, extractedText: text });
    console.log(`✅ OEP ${oepId} → hub doc ${docId} (docKey ${docKey})${text ? ` · ${text.length}c` : ' · sin texto (referencia)'}`);
  } finally { await c.end(); }
}

if (require.main === module) main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
