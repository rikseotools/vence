#!/usr/bin/env node
/**
 * sim-notas-pipeline.cjs — SIMULACIÓN de la tubería robusta de lectura de notas.
 *
 * Capas (degradan con gracia, nunca fallo en silencio):
 *   1. RENDER     curl → si 0 docs o página JS → Playwright (networkidle).
 *   2. DESCUBRIR  enlaces a PDF/documentos en la página + seguir 1 nivel de
 *                 sublinks cuyo texto sea "documentación/notas/convocatoria/bases".
 *   3. EXTRAER    cada PDF → texto (pdftotext).
 *   4. LLM        Claude lee página + notas y devuelve JSON con versiones,
 *                 fechas, criterio, material, penalización — con CITA literal.
 *   5. TRIAJE     informe estructurado para revisión humana.
 *
 * Uso: node scripts/sim-notas-pipeline.cjs <slug> [<slug> ...]
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MODEL = 'claude-sonnet-4-6';
let anthropic; // se inicializa con la key de ai_api_config (misma vía que AnthropicService en prod)

async function initAnthropic() {
  const { data } = await supabase.from('ai_api_config').select('api_key_encrypted').eq('provider', 'anthropic').eq('is_active', true).limit(1).single();
  if (!data) throw new Error('Anthropic API key no configurada en ai_api_config');
  const apiKey = Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8');
  anthropic = new Anthropic({ apiKey });
}

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const DOC_RX = /\.pdf(\?|$)|\/documents?\//i;
const ASSET_RX = /\.(css|js|png|jpe?g|svg|gif|webp|woff2?|ico|themeconfig)(\?|$)|\/index\.html?$/i;
const SUBLINK_RX = /document|nota|convocat|bases|informaci|anunci|publicaci|temari|programa/i;

function curl(url, binary = false) {
  try {
    const args = ['-sL', '--max-time', '45', '-A', UA];
    if (binary) { const out = path.join(os.tmpdir(), 'd' + Math.abs(hash(url))); execFileSync('curl', args.concat(['-o', out, url]), { stdio: ['ignore', 'ignore', 'ignore'] }); return out; }
    return execFileSync('curl', args.concat([url]), { encoding: 'utf8', maxBuffer: 80e6, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch { return binary ? null : ''; }
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
function textOf(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }
function looksJS(html) { const t = textOf(html); return /__NEXT_DATA__|data-reactroot|ng-version|liferay|AUI\(|Y\.use\(|require\(\[/i.test(html) || t.length < 800; }

function anchors(html, base) {
  const out = [];
  const re = /<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html))) { let href = m[1], text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); try { href = new URL(href, base).href; } catch { continue; } out.push({ href, text }); }
  return out;
}
function docLinks(html, base) {
  return [...new Set(anchors(html, base).map(a => a.href).filter(h => DOC_RX.test(h) && !ASSET_RX.test(h)))];
}

async function renderWithFallback(url) {
  let html = curl(url);
  let via = 'curl';
  let docs = docLinks(html, url);
  // Robusto: si curl no encontró documentos, intentar render con navegador
  // (cubre tanto SPAs como páginas cuyos enlaces los pinta JS sin marcador claro).
  if (docs.length === 0) {
    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      const ctx = await browser.newContext({ userAgent: UA });
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.waitForTimeout(2500);
      html = await page.content();
      via = 'playwright';
      docs = docLinks(html, url);
      await browser.close();
    } catch (e) { via = 'playwright-fail:' + e.message.slice(0, 40); }
  }
  return { html, via, docs };
}

function extractPdf(file) {
  try { const head = fs.readFileSync(file, { encoding: 'latin1' }).slice(0, 5); if (!head.startsWith('%PDF')) return textOf(fs.readFileSync(file, 'utf8')).slice(0, 20000); const txt = file + '.txt'; execFileSync('pdftotext', ['-layout', file, txt]); return fs.readFileSync(txt, 'utf8'); } catch { return ''; }
}

async function llmTriage(slug, pageText, notas) {
  const corpus = [`PÁGINA DE SEGUIMIENTO (${slug}):\n` + pageText.slice(0, 8000)]
    .concat(notas.map((n, i) => `\n--- NOTA ${i + 1}: ${n.title} ---\n` + n.text.slice(0, 8000)))
    .join('\n').slice(0, 60000);
  const prompt = `Eres analista de oposiciones. Lee la página de seguimiento y las notas informativas de una convocatoria española. Extrae SOLO lo que afecte al contenido de las preguntas de examen.

IMPORTANTE sobre versiones de software: las notas suelen fijar qué versión de Windows/Office se examina, con frases como "la versión 11 de Windows", "Word para Microsoft 365 en la Web", "Excel 2016", "Office 2019". Captúralas SIEMPRE en software_versions (ambos órdenes: "Windows 11" y "versión 11 de Windows" → windows:"11"). Si la nota da un criterio general ("la referencia siempre es a la versión más moderna"), ponlo en criterio_version Y, si no hay versión explícita, deduce la moderna (Windows 11, Microsoft 365) marcándolo confianza:"media".

Devuelve EXCLUSIVAMENTE un JSON válido (sin texto fuera del JSON) con esta forma:
{
  "software_versions": { "windows": "<p.ej. '11' o null>", "word": "<p.ej. 'Microsoft 365 en la Web' o null>", "excel": "...", "office_o_365": "...", "otros": "..." },
  "fecha_examen": "<fecha 1er ejercicio o null>",
  "criterio_version": "<o null>",
  "material_permitido": "<o null>",
  "penalizacion": "<fórmula de corrección o null>",
  "otras_aclaraciones": ["<aclaración relevante>"],
  "citas": [{"dato":"<qué>","cita_literal":"<texto exacto del documento>","fuente":"<título de la nota o 'página'>"}],
  "confianza": "alta|media|baja"
}
Si un dato no aparece, pon null. NO inventes citas. Cita literal exacta. Texto:\n\n${corpus}`;

  const resp = await anthropic.messages.create({ model: MODEL, max_tokens: 2048, messages: [{ role: 'user', content: prompt }] });
  const raw = resp.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
  try { return JSON.parse(raw); } catch { return { _parse_error: true, raw: raw.slice(0, 500) }; }
}

async function procesar(opo) {
  console.log('\n' + '█'.repeat(70));
  console.log(`█ ${opo.slug}  (examen ${opo.exam_date})`);
  if (!opo.seguimiento_url) { console.log('  sin seguimiento_url'); return; }

  const { html, via, docs } = await renderWithFallback(opo.seguimiento_url);
  console.log(`  [1-2] render=${via} | docs directos=${docs.length}`);

  // seguir 1 nivel de sublinks "documentación/notas" si hay pocos docs
  let allDocs = [...docs];
  if (docs.length < 2) {
    const subs = anchors(html, opo.seguimiento_url).filter(a => SUBLINK_RX.test(a.text) && /^https?:/.test(a.href) && !DOC_RX.test(a.href) && !ASSET_RX.test(a.href)).slice(0, 4);
    for (const sub of subs) {
      const subHtml = curl(sub.href);
      const subDocs = docLinks(subHtml, sub.href);
      if (subDocs.length) { console.log(`        ↳ sublink "${sub.text.slice(0, 30)}" → ${subDocs.length} docs`); allDocs.push(...subDocs); }
    }
    allDocs = [...new Set(allDocs)];
  }

  // extraer notas (cap 6)
  const notas = [];
  for (const url of allDocs.slice(0, 6)) {
    const file = curl(url, true);
    if (!file) continue;
    const text = extractPdf(file);
    if (text.trim().length > 100) notas.push({ title: decodeURIComponent(url.split('/').pop()).replace(/[-_]/g, ' ').slice(0, 70), text });
  }
  console.log(`  [3] notas con texto: ${notas.length}`);
  for (const n of notas) console.log(`        · "${n.title}" (${n.text.length} chars)`);

  // LLM
  console.log('  [4] LLM extrayendo señales…');
  let result;
  try { result = await llmTriage(opo.slug, textOf(html), notas); } catch (e) { console.log('      LLM error:', e.message.slice(0, 80)); return; }

  console.log('  [5] TRIAJE:');
  console.log(JSON.stringify(result, null, 2).split('\n').map(l => '      ' + l).join('\n'));
}

(async () => {
  const slugs = process.argv.slice(2);
  if (!slugs.length) { console.log('Uso: node scripts/sim-notas-pipeline.cjs <slug> [...]'); return; }
  await initAnthropic();
  const { data } = await supabase.from('oposiciones').select('slug, exam_date, seguimiento_url').in('slug', slugs);
  for (const slug of slugs) { const o = (data || []).find(x => x.slug === slug); if (o) await procesar(o); else console.log('no existe:', slug); }
})();
