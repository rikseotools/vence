#!/usr/bin/env node
/**
 * sim-seguimiento-ciego.cjs — SIMULACIÓN del detector de "seguimiento ciego".
 *
 * Problema raíz (incidente Extremadura 27/06): el seguimiento_url apuntaba a la
 * HOME de un portal genérico, no a la convocatoria → 0 señales específicas → un
 * exam_date placeholder erróneo (futuro) nunca se corrigió y el examen real
 * (pasado) fue invisible.
 *
 * Este detector, por CONTENIDO (no por la URL), decide para cada oposición:
 *   - ¿la página de seguimiento es ESPECÍFICA de su convocatoria o GENÉRICA?
 *   - extrae la fecha de examen / plazas que la página declare
 *   - cross-check con lo que tenemos guardado → señala divergencias
 *
 * Una sola pasada LLM caza dos fallos: URL ciega Y exam_date stale.
 *
 * Uso: node scripts/sim-seguimiento-ciego.cjs <slug> [<slug> ...]
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { execFileSync } = require('child_process');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const MODEL = 'claude-sonnet-4-6';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
let anthropic;

async function initAnthropic() {
  const { data } = await supabase.from('ai_api_config').select('api_key_encrypted').eq('provider', 'anthropic').eq('is_active', true).limit(1).single();
  anthropic = new Anthropic({ apiKey: Buffer.from(data.api_key_encrypted, 'base64').toString('utf-8') });
}

function curl(url) {
  try { return execFileSync('curl', ['-sL', '--max-time', '40', '-A', UA, url], { encoding: 'utf8', maxBuffer: 80e6, stdio: ['ignore', 'pipe', 'ignore'] }); }
  catch { return ''; }
}
function textOf(html) { return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim(); }

async function render(url, headless) {
  let html = curl(url);
  let txt = textOf(html);
  if (headless || txt.length < 800) {
    try {
      const { chromium } = require('playwright');
      const b = await chromium.launch({ headless: true });
      const p = await (await b.newContext({ userAgent: UA })).newPage();
      await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      await p.waitForTimeout(2500);
      txt = textOf(await p.content());
      await b.close();
    } catch { /* nos quedamos con lo de curl */ }
  }
  return txt;
}

async function judge(opo, pageText) {
  const prompt = `Eres analista de oposiciones. Te doy los datos de una oposición y el TEXTO de la página oficial que tenemos como "seguimiento" de su convocatoria. Decide si esa página es ESPECÍFICA de esta convocatoria o un LISTADO/PORTAL GENÉRICO de muchos procesos.

OPOSICIÓN:
- nombre: ${opo.nombre}
- convocatoria: ${opo.convocatoria_numero ?? '—'}
- plazas que tenemos: ${opo.plazas_libres ?? '—'}
- exam_date que tenemos: ${opo.exam_date ?? '—'}

TEXTO DE LA PÁGINA (recortado):
${pageText.slice(0, 12000)}

Devuelve EXCLUSIVAMENTE un JSON:
{"tipo":"especifica|generica","menciona_esta_convocatoria":true|false,"fecha_examen_en_pagina":"<fecha o null>","plazas_en_pagina":"<o null>","datos_especificos_encontrados":["..."],"confianza":"alta|media|baja","motivo":"<1 frase>"}
"generica" = listado/portal de varios procesos sin contenido propio de ESTA convocatoria. "especifica" = página de esta convocatoria (sus fechas/plazas/listados/notas). Si no hay datos propios de esta oposición, es "generica".`;
  const resp = await anthropic.messages.create({ model: MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
  const raw = resp.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
  try { return JSON.parse(raw); } catch { return { _parse_error: true, raw: raw.slice(0, 200) }; }
}

(async () => {
  const slugs = process.argv.slice(2);
  if (!slugs.length) { console.log('Uso: node scripts/sim-seguimiento-ciego.cjs <slug> [...]'); return; }
  await initAnthropic();
  const { data } = await supabase.from('oposiciones').select('slug, nombre, convocatoria_numero, plazas_libres, exam_date, estado_proceso, seguimiento_url, fetcher_type').in('slug', slugs);
  for (const slug of slugs) {
    const o = (data || []).find((x) => x.slug === slug);
    if (!o) { console.log('no existe:', slug); continue; }
    console.log('\n' + '█'.repeat(68));
    console.log(`█ ${o.slug}  (guardado: exam=${o.exam_date} estado=${o.estado_proceso})`);
    console.log(`  url: ${o.seguimiento_url}`);
    if (!o.seguimiento_url) { console.log('  ⚠️ sin seguimiento_url'); continue; }
    const txt = await render(o.seguimiento_url, o.fetcher_type === 'headless');
    if (txt.length < 50) { console.log('  ❌ página no accesible → REVISIÓN MANUAL'); continue; }
    const v = await judge(o, txt);
    const flagCiego = v.tipo === 'generica' || v.menciona_esta_convocatoria === false;
    const flagFecha = v.fecha_examen_en_pagina && o.exam_date && !String(v.fecha_examen_en_pagina).includes(String(o.exam_date).slice(0, 4));
    console.log('  VEREDICTO:', JSON.stringify(v));
    console.log('  → ' + (flagCiego ? '🚩 SEGUIMIENTO CIEGO (URL genérica, revisar)' : '✅ específica'));
    if (flagFecha) console.log('  → 🚩 CROSS-CHECK FECHA: página dice "' + v.fecha_examen_en_pagina + '" vs guardado "' + o.exam_date + '"');
  }
})();
