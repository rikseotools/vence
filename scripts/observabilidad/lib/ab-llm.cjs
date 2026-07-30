// scripts/observabilidad/lib/ab-llm.cjs — lo COMÚN de los bancos de pruebas de modelos.
//
// Nace al escribir el tercero (`ab-modelo-reescritura`): copiar por tercera vez la llamada a
// OpenRouter, el registro del gasto y los gates habría garantizado que los tres midieran cosas
// distintas en cuanto alguien tocara uno. Y ya pasó dos veces en un día que el ARNÉS mintiera antes
// que el modelo (`max_tokens` corto; el campo `v:1` que faltaba en el prompt): con el código
// repartido en tres copias, arreglarlo en una y no en las otras es cuestión de tiempo.
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..', '..');

function envVar(name) {
  if (process.env[name]) return process.env[name];
  const env = fs.readFileSync(path.join(RAIZ, '.env.local'), 'utf8');
  const m = env.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim() : null;
}

/** Normalización compartida por los gates de contenido. */
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Qué fracción de las palabras significativas de `a` aparece en `b`.
 * De pieza→fuente detecta INVENCIÓN; de fuente→piezas detecta PÉRDIDA; de texto→artículo, ANCLAJE.
 */
function cobertura(a, b) {
  const A = new Set(String(a).split(' ').filter((w) => w.length > 3));
  const B = new Set(String(b).split(' ').filter((w) => w.length > 3));
  if (!A.size) return 1;
  let h = 0; A.forEach((w) => B.has(w) && h++);
  return h / A.size;
}

/**
 * Llamada a OpenRouter con los parámetros que costaron dos mediciones falsas:
 *   · `max_tokens` ALTO — con 400, los modelos de razonamiento gastaban el presupuesto pensando y
 *     devolvían vacío: salían 0/10 y no era incapacidad, era el arnés.
 *   · `response_format: json_object` — quita la otra mitad de los «SIN_JSON» (prosa alrededor).
 *   · `reasoning: {effort:'low'}` — los que razonan por defecto tardan y gastan de más en una tarea
 *     de clasificación. Los que no lo soportan lo ignoran.
 */
async function llamarModelo({ key, modelo, prompt, maxTokens = 4000, registrar }) {
  const t0 = Date.now();
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo, messages: [{ role: 'user', content: prompt }], temperature: 0,
      max_tokens: maxTokens, response_format: { type: 'json_object' }, reasoning: { effort: 'low' },
      usage: { include: true },
    }),
  });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content || '';
  const m = txt.match(/\{[\s\S]*\}/);
  let data = null;
  if (m) { try { data = JSON.parse(m[0]); } catch { /* json roto */ } }
  const salida = { ms: Date.now() - t0, coste: j?.usage?.cost ?? 0, tokens: j?.usage?.total_tokens ?? 0, data, crudo: txt };
  // El registro del gasto se hace AQUÍ, no en el llamador: si cada banco tuviera que acordarse de
  // llamarlo, el primero que se olvide convierte su gasto en invisible. Así el módulo es
  // instrumentado por construcción (lo comprueba `llmInstrumentation.guardrail.test.ts`).
  if (registrar) await registrar({ ...salida, modelo, ok: !!data });
  return salida;
}

/**
 * Registro del gasto como `llm_call`. Lo exige el guardarraíl de cobertura de instrumentación.
 * La función interna se llama `recordLlmCall` a propósito: es el nombre CANÓNICO del proyecto para
 * «esto escribe el gasto» (lo usa `ab-modelo-notas.cjs`) y es el que busca el guardarraíl. Alinearse
 * con la convención es mejor que ensanchar el detector para que acepte un nombre nuevo.
 */
function hacerRegistrador(sql, source, feature) {
  return async function recordLlmCall(r) {
    try {
      await sql`
        INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
        VALUES (gen_random_uuid(), NOW(), ${source}, ${r.ok ? 'info' : 'warn'}, 'llm_call',
                ${sql.json({ ok: r.ok, provider: 'openrouter', model: r.modelo, feature,
                  billing: 'api', totalTokens: r.tokens || 0, estimatedCostUsd: r.coste || 0 })}, NOW())`;
    } catch { /* la observabilidad nunca rompe la medición */ }
  };
}

/** Ejecuta en tandas de `n`. Sin esto, 55 modelos en serie se van a media hora y nadie lo repite. */
async function enTandas(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

/** Tabla final, ordenada por acierto y luego por coste. El acierto MANDA: un modelo que acierta la
 *  mitad no es barato, escribe explicaciones malas que alguien tendrá que deshacer. */
function imprimirTabla(tabla, fallos, cabecera) {
  tabla.sort((a, b) => b.ok - a.ok || a.coste - b.coste);
  console.log(`\n modelo                                        ${cabecera}    tiempo      coste   $/1000 preguntas`);
  for (const t of tabla) {
    const por1000 = (t.coste / Math.max(t.total, 1)) * 1000;
    console.log(`  ${t.modelo.padEnd(44)} ${String(`${t.ok}/${t.total}`).padStart(7)} (${String(Math.round((t.ok * 100) / t.total)).padStart(3)}%)  ${String(`${t.segundos}s`).padStart(7)}   $${t.coste.toFixed(4)}   $${por1000.toFixed(2)}`);
  }
  console.log('\n  ¿Por qué fallan?');
  for (const t of tabla) {
    const f = Object.entries(fallos[t.modelo] || {}).sort((a, b) => b[1] - a[1]);
    if (f.length) console.log(`  ${t.modelo}: ${f.map(([k, n]) => `${k}×${n}`).join(' · ')}`);
  }
}

module.exports = { RAIZ, envVar, normalizar, cobertura, llamarModelo, hacerRegistrador, enTandas, imprimirTabla };
