#!/usr/bin/env node
/**
 * leer-notas-oposicion.cjs
 * --------------------------------------------------------------------------
 * Detector de "notas informativas / aclaratorias" del procedimiento de una
 * oposición. Lee TODAS las notas publicadas en su `seguimiento_url` (la página
 * oficial del procedimiento) ANTES del examen, para que no se nos escape ningún
 * detalle que afecte al contenido de las preguntas (versiones de software,
 * fechas, criterios, material permitido, penalización, etc.).
 *
 * Origen: incidente Aragón 26/06/2026 — una nota del IAAP fijaba Windows 11 +
 * Word/Excel Microsoft 365 en la Web, y teníamos preguntas en Windows 10.
 *
 * Uso:
 *   node scripts/leer-notas-oposicion.cjs <slug>     # una oposición
 *   node scripts/leer-notas-oposicion.cjs            # todas las activas con examen futuro
 *
 * Requisitos: curl y pdftotext en el sistema (uso local / Claude Code).
 * Para producción (cron Fargate) habría que portar la extracción de PDF.
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Palabras clave que disparan revisión (lo que suele aclararse en notas).
const KEYWORDS = {
  // Capta ambos órdenes: "Windows 11" y "versión 11 de Windows", y cualquier mención suelta.
  versiones: /\b(windows(\s*(11|10|8|7|xp))?|versi[oó]n\s*\d+\s*de\s*windows|word|excel|outlook|office|microsoft\s*365|powerpoint|access|libreoffice|navegador|edge|chrome)\b/gi,
  version_num: /\bversi[oó]n(es)?\b/gi,
  fechas: /\b(fecha|primer ejercicio|segundo ejercicio|llamamiento|examen|celebra)\b/gi,
  criterio: /\b(versi[oó]n m[aá]s moderna|legislaci[oó]n actualizada|criterio)\b/gi,
  material: /\b(calculadora|material permitido|legislaci[oó]n permitida|sin anotaciones)\b/gi,
  penalizacion: /\b(penaliz|aciertos|errores|respuestas? en blanco|f[oó]rmula de correcci[oó]n)\b/gi,
};

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
}

// Descarga robusta: normal -> TLS viejo (BOA) -> inseguro como último recurso.
function download(url, out) {
  const base = ['-sL', '--max-time', '60', '-A', 'Mozilla/5.0 (X11; Linux x86_64)', '-o', out];
  const tries = [
    base.concat([url]),
    ['--tlsv1.2', '--ciphers', 'DEFAULT@SECLEVEL=1'].concat(base, [url]),
    ['-k'].concat(base, [url]),
  ];
  for (const args of tries) {
    try { sh('curl', args); if (fs.existsSync(out) && fs.statSync(out).size > 0) return true; } catch { /* siguiente */ }
  }
  return false;
}

function extractText(file) {
  const head = fs.readFileSync(file, { encoding: 'latin1' }).slice(0, 5);
  if (head.startsWith('%PDF')) {
    const txt = file + '.txt';
    try { sh('pdftotext', ['-layout', file, txt]); return fs.readFileSync(txt, 'utf8'); } catch { return ''; }
  }
  // HTML: quitar tags
  const raw = fs.readFileSync(file, 'utf8');
  return raw.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
}

// Extrae enlaces a documentos (notas/PDF) del HTML de la página de seguimiento.
function extractDocLinks(html, baseUrl) {
  const links = [];
  const re = /href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    // Solo documentos reales: PDF o rutas /documents/. Excluir assets de la web.
    const esDoc = /\.pdf(\?|$)|\/documents?\//i.test(href);
    const esAsset = /\.(css|js|png|jpe?g|svg|gif|webp|woff2?|ico|themeconfig)(\?|$)|\/index\.html?$/i.test(href);
    if (esDoc && !esAsset) {
      let abs = href;
      try { abs = new URL(href, baseUrl).href; } catch { continue; }
      if (!links.includes(abs)) links.push(abs);
    }
  }
  return links;
}

function scan(text) {
  const out = {};
  for (const [k, rx] of Object.entries(KEYWORDS)) {
    const found = [...text.matchAll(rx)].map((x) => x[0].toLowerCase());
    if (found.length) out[k] = [...new Set(found)];
  }
  return out;
}

async function procesar(opo) {
  console.log('\n' + '='.repeat(78));
  console.log(`📋 ${opo.nombre}  [${opo.slug}]`);
  console.log(`   examen: ${opo.exam_date || '—'} | estado: ${opo.estado_proceso || '—'}`);
  console.log(`   seguimiento_url: ${opo.seguimiento_url || '(NINGUNA)'}`);
  if (!opo.seguimiento_url) { console.log('   ⚠️  Sin seguimiento_url — no se puede leer notas.'); return; }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'notas-'));
  const pageFile = path.join(tmp, 'page.html');
  if (!download(opo.seguimiento_url, pageFile)) { console.log('   ❌ No se pudo descargar la página de seguimiento.'); return; }
  const html = fs.readFileSync(pageFile, 'utf8');
  const docs = extractDocLinks(html, opo.seguimiento_url);
  console.log(`   📎 Documentos/notas enlazados: ${docs.length}`);

  for (const url of docs) {
    const fname = path.join(tmp, 'doc_' + Buffer.from(url).toString('hex').slice(-16));
    if (!download(url, fname)) { console.log(`   · [no descargable] ${url}`); continue; }
    const text = extractText(fname);
    const hits = scan(text);
    const title = decodeURIComponent(url.split('/').pop()).replace(/-/g, ' ');
    const flags = Object.keys(hits);
    console.log(`   · ${title}`);
    if (flags.length) {
      for (const [k, vals] of Object.entries(hits)) console.log(`       ⮑ ${k}: ${vals.slice(0, 12).join(', ')}`);
      // contexto de versiones concretas (lo más crítico)
      const verCtx = [...text.matchAll(/.{0,40}(windows\s*(11|10|8|7|xp)?|versi[oó]n\s*\d+\s*de\s*windows|microsoft\s*365|word|excel|office)\b.{0,60}/gi)].slice(0, 6);
      for (const c of verCtx) console.log(`       » ${c[0].replace(/\s+/g, ' ').trim()}`);
    }
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {}
}

(async () => {
  const slug = process.argv[2];
  let q = supabase.from('oposiciones').select('slug, nombre, exam_date, estado_proceso, seguimiento_url, is_active');
  if (slug) q = q.eq('slug', slug);
  else q = q.eq('is_active', true).gte('exam_date', new Date().toISOString().slice(0, 10)).order('exam_date');
  const { data, error } = await q;
  if (error) { console.error('Error BD:', error.message); process.exit(1); }
  if (!data || !data.length) { console.log('Sin oposiciones que procesar.'); return; }
  console.log(`Procesando ${data.length} oposici${data.length === 1 ? 'ón' : 'ones'}…`);
  for (const opo of data) await procesar(opo);
})();
