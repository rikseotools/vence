#!/usr/bin/env node
'use strict';
//
// merge-dup-docs.cjs — fusiona documentos duplicados en el hub. Repunta cualquier FK
// (hitos/epígrafe/señales `source_documento_id`) del duplicado al superviviente y BORRA el
// duplicado → el hub queda canónico, sin huérfanos.
//
// Dos modos, la misma semántica:
//   (defecto)  filas con doc_key NULL (tipo<>'nota') cuyo doc_key canónico YA lo tiene otra
//              fila en la misma convocatoria. Mismo documento clonado 2× (txt.php y /pdfs).
//   --notas    filas `nota` con doc_key cuyo (convocatoria_id, doc_key) YA tiene una fila
//              TIPADA. Aparecieron al reclasificar el hub (T-147, 27/07): 16 de los 179
//              documentos que el clasificador iba a tipar eran el gemelo sin tipo de uno ya
//              tipado, y el UNIQUE parcial `ux_convocatoria_documentos_conv_dockey` (que
//              deduplica los tipados y deja pasar las `nota`) abortaba el UPDATE entero.
//              GUARDA: si la `nota` tiene MÁS texto que el superviviente, no se borra — se
//              avisa. Perder el único ejemplar con texto útil sería peor que el duplicado.
//              Medido el 27/07: 12 de 18 estaban en ese caso y DOS supervivientes tenían el
//              texto VACÍO (documento tipado sin contenido), así que la fusión ingenua habría
//              tirado 339.207 caracteres de texto oficial. Con `--adoptar-texto` el
//              superviviente se queda con el texto (y el hash) del más completo y ENTONCES se
//              fusiona: el hub acaba con un documento por doc_key y con el mejor contenido.
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
const MODO_NOTAS = process.argv.includes('--notas');
const ADOPTAR_TEXTO = process.argv.includes('--adoptar-texto');
const CONSUMERS = ['convocatoria_hitos', 'topic_epigrafe_verification', 'oep_detection_signals'];

async function main() {
  const url = (process.env.DATABASE_URL || '').split('?')[0];
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url);
  const c = new Client({ connectionString: url, ssl: local ? false : { rejectUnauthorized: false } });
  await c.connect();
  try {
    const dups = MODO_NOTAS
      ? (await c.query(`
          SELECT d.id, d.convocatoria_id, d.url, d.doc_key,
                 length(coalesce(d.extracted_text,'')) AS chars_dup,
                 length(coalesce(s.extracted_text,'')) AS chars_surv, s.id AS surv_id, s.tipo AS surv_tipo
            FROM convocatoria_documentos d
            JOIN convocatoria_documentos s
              ON s.convocatoria_id = d.convocatoria_id AND s.doc_key = d.doc_key
             AND s.tipo <> 'nota' AND s.id <> d.id
           WHERE d.tipo = 'nota' AND d.doc_key IS NOT NULL`)).rows
      : (await c.query(`SELECT id, convocatoria_id, url FROM convocatoria_documentos WHERE doc_key IS NULL AND tipo <> 'nota' AND url IS NOT NULL`)).rows;
    let merged = 0, repointed = 0, skipped = 0, conservados = 0, adoptados = 0;
    const adopciones = []; // {surv, dup} — se resuelven tras borrar el duplicado (ver orden abajo)
    const textos = new Map(); // id dup → texto, leído antes del DELETE
    if (APPLY) await c.query('BEGIN');
    for (const d of dups) {
      let surv;
      if (MODO_NOTAS) {
        // La guarda: no se borra el ejemplar que tiene MÁS texto que el que sobrevive.
        if (d.chars_dup > d.chars_surv) {
          if (!ADOPTAR_TEXTO) {
            console.log(`  ⚠️  conservada: la nota ${d.id.slice(0, 8)} tiene ${d.chars_dup} chars y el tipado (${d.surv_tipo}) solo ${d.chars_surv} — repite con --adoptar-texto`);
            conservados++; continue;
          }
          // OJO AL ORDEN (fallo real del 27/07): la adopción se hace DESPUÉS de borrar el
          // duplicado. Si el superviviente copia el texto mientras el otro sigue vivo, ambos
          // quedan con la misma (convocatoria_id, url, content_hash) y revienta el UNIQUE
          // `uq_conv_doc_url_hash`. Aquí solo se anota; se ejecuta al final del bucle.
          adopciones.push({ surv: d.surv_id, dup: d.id });
          adoptados++;
          console.log(`  ↪️  ${d.surv_tipo} ${d.surv_id.slice(0, 8)} adopta el texto de la nota ${d.id.slice(0, 8)} (${d.chars_surv} → ${d.chars_dup} chars)`);
        }
        surv = { id: d.surv_id };
      } else {
        const { docKey } = canonicalizeBoletinUrl(d.url);
        if (!docKey) { skipped++; continue; }
        surv = (await c.query(
          `SELECT id FROM convocatoria_documentos WHERE convocatoria_id=$1 AND doc_key=$2 AND id<>$3 LIMIT 1`,
          [d.convocatoria_id, docKey, d.id])).rows[0];
      }
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
      if (APPLY) {
        if (adopciones.some((a) => a.dup === d.id)) {
          const t = (await c.query(`SELECT extracted_text FROM convocatoria_documentos WHERE id=$1`, [d.id])).rows[0];
          textos.set(d.id, t?.extracted_text ?? null);
        }
        await c.query(`DELETE FROM convocatoria_documentos WHERE id=$1`, [d.id]);
      }
      merged++;
    }
    // Adopciones diferidas: el duplicado ya no existe, así que el superviviente puede quedarse
    // con su texto (y el hash correspondiente) sin colisionar con nadie.
    if (APPLY) {
      for (const a of adopciones) {
        const texto = textos.get(a.dup);
        if (texto == null) continue;
        await c.query(
          `UPDATE convocatoria_documentos
              SET extracted_text = $2,
                  content_hash = encode(digest($2, 'sha256'), 'hex'),
                  updated_at = now()
            WHERE id = $1`,
          [a.surv, texto]);
      }
    }
    if (APPLY) await c.query('COMMIT');
    console.log(`${APPLY ? 'APLICADO' : 'DRY-RUN'}${MODO_NOTAS ? ' [modo --notas]' : ''} — duplicados fusionados=${merged}, FKs repuntados=${repointed}, saltados=${skipped}${conservados ? `, conservados por tener más texto=${conservados}` : ''}${adoptados ? `, textos adoptados por el superviviente=${adoptados}` : ''}`);
    if (!APPLY) console.log('(usa --apply para escribir; transaccional)');
  } catch (e) {
    if (APPLY) await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { await c.end(); }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
