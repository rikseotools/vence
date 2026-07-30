#!/usr/bin/env node
/**
 * ab-modelo-transformacion.cjs — A/B de MODELOS para la tarea que SÍ escala: pasar una explicación
 * ya escrita al formato ESTRUCTURADO barajable (`explanation_data`).
 *
 *   npm run llm:ab-transformacion
 *   npm run llm:ab-transformacion -- --modelos google/gemini-2.5-flash-lite,mistralai/mistral-small-3.2-24b-instruct
 *   npm run llm:ab-transformacion -- --casos 40 --concurrencia 6
 *
 * ## Por qué este banco vale mucho más que el de adjudicación
 *
 * El hermano (`ab-modelo-vinculo-vecino.cjs`) mide **juicio**: si el artículo vinculado es el que
 * responde. Ahí no hay verificador, la verdad la pone un humano, y el golden set se agota. Aquí no:
 *
 * **la métrica NO la adjudica nadie.** Transformar no es opinar — el contenido ya existe y ya es
 * correcto, solo se reestructura. Y el resultado se comprueba con verificadores DETERMINISTAS que
 * ya estaban escritos:
 *
 *   1. estructura completa: una razón por cada opción real de la pregunta;
 *   2. narrativa sin letras (`explanationReferencesLetters` sobre intro/outro) — si la intro dice
 *      "la respuesta correcta es la B", al barajar miente;
 *   3. **no regresión de contenido**: `mismoContenidoExplicacion(original, render(estructura))`, el
 *      mismo comparador que usa el canary de la Fase 2;
 *   4. cita literal: si el modelo declara `cita`, su texto tiene que estar de verdad en el artículo
 *      (`citaNoLiteral`, reutilizado de `validar-explicacion.cjs`).
 *
 * Consecuencia práctica: **se mide solo y se repite solo**. Sale un modelo nuevo, se corre y ya. Y
 * como el fallo lo caza un gate, en producción un mal resultado se descarta en vez de aplicarse:
 * el fallo es BARATO, que es justo lo contrario que en adjudicación.
 *
 * ## El listón a batir
 *
 * El parser heurístico actual (`scripts/backfill-explanation-data.ts`) transcribe el **43,7 %** del
 * formato de generación y el **15,3 %** del de impugnaciones (medido el 27/07). Un modelo solo tiene
 * que superar eso. Este banco lo mide en la MISMA muestra, así que la comparación es justa.
 *
 * ## Por qué la muestra va por EXPOSICIÓN
 *
 * De las 133.140 preguntas activas sin estructura, **82.591 no las ha visto nadie**, y las 10.000
 * más vistas concentran el 71 % de las exposiciones. Medir sobre una muestra aleatoria mediría
 * sobre todo preguntas que no se sirven. Aquí se muestrea entre las que tienen exposición real.
 *
 * Contexto y estrategia completa: ficha T-291 en `docs/roadmap/tareas-pendientes.md`.
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

const argv = process.argv.slice(2);
const val = (n, def) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : def; };
const N_CASOS = Number(val('--casos', '25'));
const CONCURRENCIA = Number(val('--concurrencia', '6'));
const MODELOS = val('--modelos', [
  'mistralai/mistral-small-3.2-24b-instruct',
  'deepseek/deepseek-v4-flash',
  'deepseek/deepseek-chat',
  'openai/gpt-5.4-nano',
  'google/gemini-3.1-flash-lite',
  'google/gemini-2.5-flash-lite',
  'qwen/qwen3-235b-a22b-2507',
  'google/gemini-3.5-flash',
  'anthropic/claude-haiku-4.5',
].join(',')).split(',');

const sql = require(path.join(RAIZ, 'backend', 'node_modules', 'postgres'))(envVar('DATABASE_URL'), {
  ssl: { rejectUnauthorized: false }, max: 3, connect_timeout: 60,
});

// Verificadores YA EXISTENTES. No se reimplementa ninguno: si el gate del banco y el de producción
// divergen, el banco mide una cosa y producción hace otra, que es la peor forma de mentirse.
const { citaNoLiteral } = require(path.join(RAIZ, 'scripts/impugnaciones/validar-explicacion.cjs'));

async function cargarVerificadoresTS() {
  // Los núcleos viven en TypeScript; se cargan con tsx a través de un puente mínimo.
  const { renderStructuredExplanation, isStructuredExplanation, mismoContenidoExplicacion } =
    await import(path.join(RAIZ, 'lib/shuffle/structuredExplanation.ts'));
  const { explanationReferencesLetters } = await import(path.join(RAIZ, 'lib/shuffle/classifyShuffleMode.ts'));
  return { renderStructuredExplanation, isStructuredExplanation, mismoContenidoExplicacion, explanationReferencesLetters };
}

// OJO: el JSON DEBE llevar `"v": 1` — `isStructuredExplanation` lo exige y sin él rechaza una
// estructura por lo demás perfecta. La primera versión del prompt no lo pedía y daba 0/3 «por culpa
// del modelo»; era del arnés. Segunda vez en el mismo día que el arnés miente antes que el modelo.
const PROMPT = (c) => `Reorganiza esta explicación en campos. NO la reescribas: reparte el texto que ya existe.

QUÉ VA EN CADA CAMPO (esto es lo que más se falla):
· "intro"  → SOLO la prosa de contexto que va ANTES del análisis por opciones. NO metas aquí el enunciado de la pregunta. NO metas la frase "La respuesta correcta es la X" (esa se BORRA: la letra la pone el sistema al barajar).
· "cita"   → si hay un párrafo citado de la norma (suele ir con «comillas» o precedido de >), pártelo en "ref" (el artículo) y "texto" (la cita literal). Si no lo hay, omite "cita".
· "options"→ una entrada por opción, con SU razón, copiada TAL CUAL del original y quitándole solo la etiqueta de letra ("**A) INCORRECTA —") y cualquier mención a su propia letra.
· "outro"  → SOLO la frase de cierre o clave, si la hay. Si toda la explicación ya se ha repartido en los campos anteriores, deja "outro" vacío. NUNCA repitas aquí la explicación entera.

REGLA DEL BARAJADO: las opciones se sirven en orden aleatorio, así que "intro" y "outro" NO pueden nombrar ninguna letra de opción ni una posición ("la primera", "la anterior"). Las letras de la NORMA sí valen ("el apartado b) del artículo 21").

PREGUNTA: ${c.question_text}
A) ${c.option_a}
B) ${c.option_b}
${c.option_c ? `C) ${c.option_c}` : ''}
${c.option_d ? `D) ${c.option_d}` : ''}
RESPUESTA CORRECTA: ${'ABCD'[c.correct_option]}

EXPLICACIÓN A REPARTIR:
${c.explanation}

Devuelve SOLO este JSON (el campo "v" es obligatorio y vale 1):
{"v":1,"intro":"","cita":{"ref":"","texto":""},"options":{"0":"","1":"","2":"","3":""},"outro":""}
Una entrada en "options" por CADA opción que exista (0=A, 1=B, 2=C, 3=D).`;

async function llamar(modelo, prompt) {
  const t0 = Date.now();
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: modelo, messages: [{ role: 'user', content: prompt }], temperature: 0,
      max_tokens: 4000, response_format: { type: 'json_object' }, reasoning: { effort: 'low' },
      usage: { include: true },
    }),
  });
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content || '';
  const m = txt.match(/\{[\s\S]*\}/);
  let data = null;
  if (m) { try { data = JSON.parse(m[0]); } catch { /* json roto */ } }
  const out = { ms: Date.now() - t0, coste: j?.usage?.cost ?? 0, tokens: j?.usage?.total_tokens ?? 0, data };
  await recordLlmCall({ ...out, modelo, ok: !!data });
  return out;
}

async function recordLlmCall(r) {
  try {
    await sql`
      INSERT INTO observable_events (id, ts, source, severity, event_type, metadata, created_at)
      VALUES (gen_random_uuid(), NOW(), 'script:ab-modelo-transformacion', ${r.ok ? 'info' : 'warn'}, 'llm_call',
              ${sql.json({ ok: r.ok, provider: 'openrouter', model: r.modelo, feature: 'ab_transformacion',
                billing: 'api', totalTokens: r.tokens || 0, estimatedCostUsd: r.coste || 0 })}, NOW())`;
  } catch { /* la observabilidad nunca rompe la medición */ }
}

/** Normalización compartida: minúsculas sin tildes ni marcado, que es lo que compara el gate 3. */
const normalizar = (t) => String(t || '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Qué fracción de las palabras significativas de `a` aparece en `b`. Sirve en los dos sentidos:
 * de pieza→original detecta INVENCIÓN, y de original→piezas detecta PÉRDIDA.
 */
function cobertura(a, b) {
  const A = new Set(String(a).split(' ').filter((w) => w.length > 3));
  const B = new Set(String(b).split(' ').filter((w) => w.length > 3));
  if (!A.size) return 1;
  let h = 0; A.forEach((w) => B.has(w) && h++);
  return h / A.size;
}

/**
 * Los CUATRO gates. Devuelve el primero que falla, o null si pasa todo.
 * Es el corazón del banco: la nota de cada modelo es cuántos casos pasan esto.
 */
function evaluar(V, caso, data) {
  if (!data || typeof data !== 'object') return 'json_invalido';
  const nOpts = [caso.option_a, caso.option_b, caso.option_c, caso.option_d].filter(Boolean).length;

  // 1) estructura completa
  if (!V.isStructuredExplanation(data, nOpts)) return 'estructura_incompleta';

  // 2) narrativa sin letras de opción
  for (const t of [data.intro, data.outro]) {
    if (t && V.explanationReferencesLetters(String(t))) return 'narrativa_con_letras';
  }

  // 3) REPARTO SIN PÉRDIDA NI INVENCIÓN.
  //
  // Aquí estaba `mismoContenidoExplicacion` y era el gate EQUIVOCADO: se escribió como canario para
  // comparar dos renders de la MISMA estructura (antes y después de barajar), no un texto original
  // contra su reestructuración. Reestructurar reordena por definición —el análisis por opciones
  // cambia de sitio y la línea «la respuesta correcta es la B» se BORRA a propósito—, así que ese
  // comparador da siempre «cambiado». Medido el 30/07: con ese gate, **el parser determinista que
  // usa producción sacaba 0 de 6**. Cuando el patrón de oro suspende tu examen, el examen está mal.
  //
  // Lo que sí hay que exigir a una transformación: que no se PIERDA contenido del original y que no
  // se INVENTE nada nuevo. Es una comprobación de partición, no de igualdad de texto.
  try {
    V.renderStructuredExplanation(data, { correctOption: caso.correct_option, optionOrder: null, nOptions: nOpts });
  } catch { return 'render_peta'; }
  const orig = normalizar(caso.explanation);
  const piezas = [data.intro, data.outro, data.cita?.texto, ...Object.values(data.options || {})]
    .filter(Boolean).map((x) => normalizar(String(x)));
  // (a) nada inventado: cada pieza tiene que estar sustancialmente en el original
  for (const p of piezas) {
    if (p.length < 25) continue;                        // fragmentos cortos: no son afirmaciones
    if (cobertura(p, orig) < 0.75) return 'contenido_inventado';
  }
  // (b) nada perdido: el original tiene que quedar cubierto por el conjunto de piezas
  if (cobertura(orig, piezas.join(' ')) < 0.70) return 'contenido_perdido';

  // 4) la cita, si la hay, tiene que estar en el artículo
  if (data.cita?.texto && caso.articulo && citaNoLiteral(String(data.cita.texto), caso.articulo)) {
    return 'cita_inventada';
  }
  return null;
}

async function enTandas(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

(async () => {
  const V = await cargarVerificadoresTS();

  // Muestra por EXPOSICIÓN: medir sobre preguntas que nadie ve no mide nada útil.
  const casos = await sql`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option,
           q.explanation, left(a.content, 2500) AS articulo,
           (SELECT count(*) FROM test_questions t WHERE t.question_id = q.id)::int AS servidas
      FROM questions q
      LEFT JOIN articles a ON a.id = q.primary_article_id
     WHERE q.is_active = true AND q.explanation_data IS NULL
       AND q.explanation IS NOT NULL AND length(q.explanation) > 150
       -- SOLO las que YA analizan por opción. Es la población que este banco mide: transformar.
       -- Las de prosa corrida (88% del total) no se pueden transformar —hay que ESCRIBIR las
       -- razones— y mezclarlas aquí hundía la nota de todos los modelos por un defecto de la
       -- muestra, no suyo. Descubierto probando: la primera tanda dio 0/3 con una pregunta sobre
       -- la BIOS cuya explicación no analizaba ninguna opción.
       AND q.explanation ~ '\\*\\*A\\)' AND q.explanation ~ '\\*\\*B\\)'
       AND (SELECT count(*) FROM test_questions t WHERE t.question_id = q.id) >= 20
     ORDER BY q.id
     LIMIT ${N_CASOS}`;
  console.error(`muestra: ${casos.length} preguntas con exposición real\n`);

  const tabla = [];
  const fallos = {};
  await enTandas(MODELOS, CONCURRENCIA, async (modelo) => {
    let ok = 0, ms = 0, coste = 0;
    fallos[modelo] = {};
    for (const c of casos) {
      let r;
      try { r = await llamar(modelo, PROMPT(c)); } catch { r = { ms: 0, coste: 0, data: null }; }
      ms += r.ms; coste += r.coste;
      const fallo = evaluar(V, c, r.data);
      if (!fallo) ok++; else fallos[modelo][fallo] = (fallos[modelo][fallo] || 0) + 1;
    }
    tabla.push({ modelo, ok, total: casos.length, segundos: +(ms / 1000).toFixed(1), coste: +coste.toFixed(5) });
    console.error(`  ${modelo} → ${ok}/${casos.length}`);
  });

  tabla.sort((a, b) => b.ok - a.ok || a.coste - b.coste);
  console.log('\n modelo                                        pasa gates    tiempo      coste   coste/1000 preguntas');
  for (const t of tabla) {
    const por1000 = t.coste / Math.max(t.total, 1) * 1000;
    console.log(`  ${t.modelo.padEnd(44)} ${String(t.ok + '/' + t.total).padStart(7)} (${String(Math.round(t.ok * 100 / t.total)).padStart(3)}%)  ${String(t.segundos + 's').padStart(7)}   $${t.coste.toFixed(4)}   $${por1000.toFixed(2)}`);
  }
  console.log('\n  ¿Por qué fallan?');
  for (const t of tabla) {
    const f = Object.entries(fallos[t.modelo]).sort((a, b) => b[1] - a[1]);
    if (f.length) console.log(`  ${t.modelo}: ${f.map(([k, n]) => `${k}×${n}`).join(' · ')}`);
  }
  console.log('\n  Listón a batir: el parser heurístico actual transcribe 43,7% (formato generación) / 15,3% (impugnaciones).');
  console.log('  Un fallo aquí es BARATO: en producción el gate lo descarta y la pregunta se queda como estaba.\n');
  await sql.end();
})().catch((e) => { console.error(e); process.exit(1); });
