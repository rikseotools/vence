#!/usr/bin/env node
/**
 * ab-modelo-vinculo-vecino.cjs — A/B de MODELOS para adjudicar la cola de `vinculo_articulo_vecino`:
 * mismo prompt, mismos casos REALES, y una VERDAD adjudicada a mano contra el BOE.
 *
 *   npm run llm:ab-vinculo
 *   npm run llm:ab-vinculo -- --modelos google/gemini-2.5-flash-lite,openai/gpt-5-mini
 *
 * ## Por qué existe
 *
 * El detector heurístico (`lib/health/vinculoArticuloVecino.cjs`) es un EMBUDO, no un juez: reduce
 * 139.000 preguntas a ~169 sospechas, pero acertando solo unas 4 de cada 10. Adjudicar esa cola a
 * mano cuesta caro y con un agente Sonnet también. La pregunta práctica es **cuál es el modelo más
 * barato que adjudica igual de bien**, y eso no se responde por intuición: se mide.
 *
 * Hermano de `ab-modelo-notas.cjs` (mismo patrón, misma clave `OPENROUTER_API_KEY`, mismo registro
 * como `llm_call`). Aquí lo que cambia es que **hay respuesta correcta**: el fichero
 * `data/pilotos/vinculo-vecino-golden.json` trae 10 casos reales con su veredicto adjudicado y **el
 * porqué escrito**. Sin ese porqué el banco de pruebas no vale nada dentro de tres meses.
 *
 * ## Cómo se lee el resultado
 *
 * `aciertos` es lo único que decide. El coste importa a partir de ahí: un modelo que acierta 5 de 10
 * no es barato, es inútil — re-vincular una pregunta por un veredicto malo ROMPE una pregunta que
 * estaba bien, que es peor que dejarla como estaba.
 *
 * ## Trampas conocidas (las tres que separan a un buen adjudicador de uno malo)
 *
 * Los casos del golden set no son decorativos: incluyen a propósito los tres patrones donde los
 * modelos baratos se estrellaron el 29/07/2026:
 *   1. El enunciado CITA el artículo vinculado («de conformidad con el artículo 440…»).
 *   2. Pregunta de EXCLUSIÓN («no tendrá en cuenta»), donde la opción correcta cita el vecino
 *      precisamente porque es lo que queda fuera.
 *   3. Pregunta que abarca varios artículos («¿en qué sección se reconoce este derecho?»).
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
function envVar(name) {
  if (process.env[name]) return process.env[name];
  const env = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const m = env.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}
const KEY = envVar('OPENROUTER_API_KEY');
if (!KEY) { console.error('Falta OPENROUTER_API_KEY'); process.exit(2); }

// Cada llamada se registra como `llm_call`, igual que el hermano `ab-modelo-notas.cjs`. Lo exige el
// guardarraíl de cobertura (`__tests__/guardrails/llmInstrumentation.guardrail.test.ts`) y es de
// justicia: una herramienta que existe para medir el gasto no puede ser ella misma gasto invisible.
const sqlDb = (() => {
  try {
    const url = envVar('DATABASE_URL');
    if (!url) return null;
    return require('postgres')(url, {
      ssl: { rejectUnauthorized: false }, max: 2, connect_timeout: 30,
    });
  } catch { return null; }
})();

async function recordLlmCall(r) {
  if (!sqlDb) return;
  try {
    await sqlDb`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:ab-modelo-vinculo-vecino', ${r.ok ? 'info' : 'warn'}, 'llm_call',
              ${sqlDb.json({
                ok: r.ok,
                provider: 'openrouter',
                model: r.modelo,
                feature: 'ab_vinculo_vecino',
                billing: 'api',
                totalTokens: r.tokens || 0,
                estimatedCostUsd: r.coste || 0,
              })}, NOW())`;
  } catch { /* la observabilidad nunca rompe la medición */ }
}

const argv = process.argv.slice(2);
const val = (n, def) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : def; };
const MODELOS = val(
  '--modelos',
  [
    'openai/gpt-5-nano',
    'qwen/qwen3-235b-a22b-2507',
    'google/gemini-2.5-flash-lite',
    'z-ai/glm-4.5-air',
    'deepseek/deepseek-v4-flash',
    'meta-llama/llama-4-maverick',
    'openai/gpt-5-mini',
    'google/gemini-2.5-flash',
    'mistralai/mistral-medium-3.1',
    'anthropic/claude-haiku-4.5',
  ].join(',')
).split(',');

const CASOS = JSON.parse(fs.readFileSync(path.join(RAIZ, 'data/pilotos/vinculo-vecino-golden.json'), 'utf8'));

const PROMPT = (c) => `Eres un verificador de preguntas de oposición. Cada pregunta debe colgar del artículo que la responde.

PREGUNTA: ${c.enunciado}
A) ${c.opciones.A}
B) ${c.opciones.B}
C) ${c.opciones.C}
D) ${c.opciones.D}
RESPUESTA CORRECTA: ${c.correcta}) ${c.correcta_texto}

ARTÍCULO DONDE ESTÁ HOY (art. ${c.art_vinculado.numero}):
${c.art_vinculado.texto}

ARTÍCULO QUE PROPONE EL DETECTOR (art. ${c.art_sugerido.numero}):
${c.art_sugerido.texto}

¿Cuál de los dos sustenta LITERALMENTE la opción correcta? Avisos: (1) hay preguntas que abarcan varios artículos a la vez, y ahí el actual suele ser tan defendible como el sugerido; (2) si el enunciado pide señalar la INCORRECTA o lo que NO se incluye, la opción correcta puede pertenecer al otro artículo a propósito y el vínculo actual estar bien; (3) si el propio enunciado cita un artículo por su número, eso pesa.

Responde SOLO con JSON: {"veredicto":"vinculado_correcto"|"sugerido_mejor"|"ninguno","razon":"una frase"}`;

async function llamar(modelo, prompt) {
  const t0 = Date.now();
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      // 4.000 y no 400: la primera tanda (29/07) dio 0-2/10 a diez modelos por «SIN_JSON», y NO era
      // incapacidad — eran modelos de RAZONAMIENTO que se gastaban el presupuesto pensando y
      // devolvían contenido vacío. Medir con el techo bajo no compara modelos, compara arneses.
      max_tokens: 4000,
      // Formato forzado por la API en vez de por el prompt: quita del medio la otra mitad de los
      // «SIN_JSON» (los que envuelven el JSON en prosa o en ```json).
      response_format: { type: 'json_object' },
      // Los modelos que razonan por defecto tardan y gastan de más para una tarea de clasificación.
      // Los que no lo soportan ignoran el campo.
      reasoning: { effort: 'low' },
      usage: { include: true },
    }),
  });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content || '';
  const m = txt.match(/\{[\s\S]*?\}/);
  let veredicto = 'SIN_JSON';
  let razon = txt.slice(0, 90);
  if (m) {
    try { const p = JSON.parse(m[0]); veredicto = p.veredicto ?? 'SIN_CAMPO'; razon = p.razon ?? ''; }
    catch { veredicto = 'JSON_ROTO'; }
  }
  const salida = {
    ms: Date.now() - t0, coste: j?.usage?.cost ?? 0, tokens: j?.usage?.total_tokens ?? 0, veredicto, razon,
  };
  await recordLlmCall({ ...salida, modelo, ok: !['SIN_JSON', 'JSON_ROTO', 'SIN_CAMPO'].includes(veredicto) });
  return salida;
}

// Los modelos corren EN PARALELO (dentro de cada uno, los casos van en serie): con 30+ candidatos
// en serie el barrido se va a media hora y nadie lo repite. El tope evita que OpenRouter empiece a
// devolver 429, que se contarían como fallo del modelo y ensuciarían la medición.
const CONCURRENCIA = Number(val('--concurrencia', '6'));

async function enTandas(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

(async () => {
  const tabla = [];
  const detalle = {};
  await enTandas(MODELOS, CONCURRENCIA, async (modelo) => {
    let aciertos = 0, ms = 0, coste = 0, malFormato = 0;
    detalle[modelo] = [];
    for (const c of CASOS) {
      let r;
      try { r = await llamar(modelo, PROMPT(c)); }
      catch (e) { r = { ms: 0, coste: 0, veredicto: 'ERROR', razon: String(e.message).slice(0, 60) }; }
      ms += r.ms; coste += r.coste;
      const ok = r.veredicto === c.verdad;
      if (ok) aciertos++;
      if (['SIN_JSON', 'JSON_ROTO', 'SIN_CAMPO', 'ERROR'].includes(r.veredicto)) malFormato++;
      detalle[modelo].push({ id: c.id.slice(0, 8), esperado: c.verdad, dijo: r.veredicto, ok, razon: String(r.razon).slice(0, 100) });
    }
    tabla.push({ modelo, aciertos, total: CASOS.length, segundos: +(ms / 1000).toFixed(1), coste: +coste.toFixed(5), malFormato });
    console.error(`  ${modelo} → ${aciertos}/${CASOS.length}`);
  });

  tabla.sort((a, b) => b.aciertos - a.aciertos || a.coste - b.coste);
  console.log('\n modelo                                        aciertos   tiempo      coste   fallos formato');
  for (const t of tabla) {
    console.log(`  ${t.modelo.padEnd(44)} ${String(t.aciertos + '/' + t.total).padStart(6)}   ${String(t.segundos + 's').padStart(7)}   $${t.coste.toFixed(5)}   ${t.malFormato || ''}`);
  }
  console.log('\n  Los que fallan, ¿en qué fallan?');
  for (const t of tabla) {
    const fallos = detalle[t.modelo].filter((d) => !d.ok);
    if (fallos.length) console.log(`  ${t.modelo}: ${fallos.map((f) => `${f.id}(dijo ${f.dijo}, era ${f.esperado})`).join(' · ')}`);
  }
  fs.writeFileSync('/tmp/ab-vinculo-detalle.json', JSON.stringify(detalle, null, 1));
  console.log('\n  detalle por caso en /tmp/ab-vinculo-detalle.json');
  console.log('  ⚠️  aciertos manda: un modelo que acierta 5/10 no es barato, rompe preguntas que estaban bien.\n');
  if (sqlDb) await sqlDb.end();
})().catch((e) => { console.error(e); process.exit(1); });
