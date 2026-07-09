// scripts/opofimatica-teoria.cjs
// Descarga la TEORÍA (38 lecciones de curso) + los PDFs/ejercicios de /docs/
// de OpofimáticaEstado, usando la cookie de sesión.
// Salida:
//   preguntas-para-subir/opofimaticaestado/teoria/{slug}.json  (texto + media + pdfs)
//   preguntas-para-subir/opofimaticaestado/docs/*.pdf           (PDFs descargados)

const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'preguntas-para-subir', 'opofimaticaestado');
const TEORIA_DIR = path.join(OUT, 'teoria');
const DOCS_DIR = path.join(OUT, 'docs');
const COOKIES = require('./opofimatica-cookies.json');
const JAR = COOKIES.filter((c) => /opofimaticaestado/.test(c.domain)).map((c) => `${c.name}=${c.value}`).join('; ');
const H = { Cookie: JAR, 'User-Agent': 'Mozilla/5.0' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Lista de teoría (del sitemap). Se puede regenerar con /tmp/opofi_urls.json.
let TEORIA = [];
try { TEORIA = require('/tmp/opofi_urls.json').teoria; } catch {}
if (!TEORIA.length) {
  const base = 'https://www.opofimaticaestado.com/';
  TEORIA = [
    ...Array.from({ length: 12 }, (_, i) => `${base}curso-word-${i + 1}/`),
    ...Array.from({ length: 13 }, (_, i) => `${base}curso-excel-${String(i + 1).padStart(2, '0')}/`),
    ...Array.from({ length: 7 }, (_, i) => `${base}curso-access-${i + 1}/`),
    `${base}curso-de-outlook/`, `${base}curso-de-outlook-2/`, `${base}curso-de-outlook-3/`, `${base}curso-de-outlook-4/`, `${base}curso-de-outlook-novedades/`,
    `${base}curso-windows11/`,
  ];
}

function extractContent(html) {
  // Contenido principal: dentro de <main> o <article> o .entry-content (Kadence)
  let m = html.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/(article|main|div)>/i)
    || html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)
    || html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  const raw = m ? m[1] : html;
  const text = raw.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  const pdfs = [...html.matchAll(/href=["']([^"']+\.pdf[^"']*)["']/gi)].map((x) => x[1]);
  const images = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((x) => x[1]).filter((u) => /docs|uploads|curso/i.test(u));
  const videos = [...html.matchAll(/(youtube\.com\/embed\/[\w-]+|youtu\.be\/[\w-]+|vimeo\.com\/\d+)/gi)].map((x) => x[1]);
  return { text, pdfs: [...new Set(pdfs)], images: [...new Set(images)], videos: [...new Set(videos)] };
}

async function downloadPdf(url) {
  const name = url.split('/').slice(-2).join('__').replace(/[^\w.\-]/g, '_');
  const dest = path.join(DOCS_DIR, name);
  if (fs.existsSync(dest)) return { url, saved: name, skipped: true };
  try {
    const r = await fetch(url, { headers: H });
    if (!r.ok) return { url, error: r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return { url, saved: name, bytes: buf.length };
  } catch (e) { return { url, error: e.message }; }
}

(async () => {
  fs.mkdirSync(TEORIA_DIR, { recursive: true });
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  const allPdfs = new Set();
  let okPages = 0, totalChars = 0;
  for (const url of TEORIA) {
    const slug = url.replace(/https?:\/\/[^/]+\//, '').replace(/\/$/, '');
    try {
      const r = await fetch(url, { headers: H });
      if (!r.ok) { console.log(`  ✗ ${slug} HTTP ${r.status}`); continue; }
      const html = await r.text();
      const c = extractContent(html);
      c.pdfs.forEach((p) => allPdfs.add(p.startsWith('http') ? p : new URL(p, url).href));
      fs.writeFileSync(path.join(TEORIA_DIR, slug + '.json'), JSON.stringify({ url, slug, ...c, source: 'opofimaticaestado' }, null, 2));
      okPages++; totalChars += c.text.length;
      console.log(`  ✓ ${slug.padEnd(26)} ${c.text.length} chars | ${c.pdfs.length} pdf | ${c.videos.length} vid | ${c.images.length} img`);
    } catch (e) { console.log(`  ✗ ${slug} ${e.message}`); }
    await sleep(400);
  }
  console.log(`\nTeoría: ${okPages}/${TEORIA.length} páginas, ${totalChars} chars totales.`);
  console.log(`\nDescargando ${allPdfs.size} PDFs...`);
  let dl = 0;
  for (const p of allPdfs) {
    const res = await downloadPdf(p);
    if (res.saved) { dl++; if (!res.skipped) console.log(`  ↓ ${res.saved} (${res.bytes} b)`); }
    else console.log(`  ✗ pdf ${res.url} → ${res.error}`);
    await sleep(300);
  }
  console.log(`\n✅ ${dl}/${allPdfs.size} PDFs guardados en ${DOCS_DIR}`);
})();
