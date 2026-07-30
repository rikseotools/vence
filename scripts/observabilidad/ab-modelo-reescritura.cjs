#!/usr/bin/env node
/**
 * ab-modelo-reescritura.cjs — A/B de MODELOS para la tarea que de verdad tiene volumen: **escribir
 * la explicación desde el ARTÍCULO**, directamente en formato estructurado barajable.
 *
 *   npm run llm:ab-reescritura
 *   npm run llm:ab-reescritura -- --casos 20 --modelos google/gemini-3.5-flash,deepseek/deepseek-chat
 *
 * ## Por qué este banco y no el de transformación
 *
 * De las 119.000 explicaciones sin estructura, **105.094 (88%) son prosa corrida**: no analizan
 * ninguna opción. Ahí no hay nada que reordenar — un modelo no puede reestructurar razones que no
 * existen. Hace falta **razonar sobre el artículo y escribir la respuesta**; y ya que se escribe,
 * se escribe directamente en el formato nuevo.
 *
 * Y no es una idea nueva: es la dirección que el proyecto ya había elegido. La cabecera de
 * `scripts/aplicar-explicacion.ts` lo dice — *«histórico: texto → estructura = PARSE (heurístico, y
 * falla); nuevo: estructura → texto = RENDER (determinista: no puede fallar)»*. El parser es el
 * camino viejo, y por eso transcribe solo el 43,7 % / 15,3 %.
 *
 * ## Lo que cambia respecto al banco de transformación (y es lo importante)
 *
 * **El modelo recibe el ARTÍCULO, no la explicación vieja.** Y con eso cambian los gates, porque ya
 * no hay contenido previo que conservar:
 *
 * | gate | transformar | reescribir |
 * |---|---|---|
 * | una razón por opción | ✅ | ✅ |
 * | narrativa sin letras de opción | ✅ | ✅ |
 * | cita literal (`citaNoLiteral`) | ✅ | ✅ |
 * | reparto sin pérdida ni invención | ✅ | ❌ no aplica |
 * | **anclaje en el artículo** | — | ✅ **lo sustituye** |
 *
 * El **anclaje** mide qué parte de lo que el modelo escribe se apoya en el texto legal que se le dio.
 * No garantiza que lo escrito sea CIERTO —para eso hace falta auditoría por muestra con agente—,
 * pero sí caza al modelo que se inventa doctrina, que es el fallo caro.
 *
 * ## Qué NO mide, dicho claro
 *
 * Que la explicación sea buena pedagógicamente y que sea verdadera. Un modelo puede pasar los cinco
 * gates y escribir una razón floja. Por eso este banco elige **candidatos**, y el paso siguiente es
 * siempre una muestra auditada por agente antes de soltar nada a producción.
 *
 * Estrategia completa y cifras: ficha T-291 en `docs/roadmap/tareas-pendientes.md`.
 */
const path = require('path');
const {
  RAIZ, envVar, normalizar, cobertura, llamarModelo, hacerRegistrador, enTandas, imprimirTabla,
} = require('./lib/ab-llm.cjs');

const KEY = envVar('OPENROUTER_API_KEY');
if (!KEY) { console.error('Falta OPENROUTER_API_KEY'); process.exit(2); }

const argv = process.argv.slice(2);
const val = (n, def) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : def; };
const N_CASOS = Number(val('--casos', '12'));
const CONCURRENCIA = Number(val('--concurrencia', '5'));
const MODELOS = val('--modelos', [
  'mistralai/mistral-small-3.2-24b-instruct',
  'deepseek/deepseek-chat',
  'google/gemini-2.5-flash-lite',
  'google/gemini-3.1-flash-lite',
  'openai/gpt-5.4-nano',
  'google/gemini-3.5-flash',
  'anthropic/claude-haiku-4.5',
].join(',')).split(',');

const sql = require(path.join(RAIZ, 'backend', 'node_modules', 'postgres'))(envVar('DATABASE_URL'), {
  ssl: { rejectUnauthorized: false }, max: 3, connect_timeout: 60,
});
const registrar = hacerRegistrador(sql, 'script:ab-modelo-reescritura', 'ab_reescritura');
const { citaNoLiteral } = require(path.join(RAIZ, 'scripts/impugnaciones/validar-explicacion.cjs'));

/**
 * Umbral de anclaje, CALIBRADO (30/07) contra explicaciones escritas a mano y verificadas contra el
 * BOE — las de las impugnaciones resueltas ese día. Medido sobre sus 26 razones:
 *
 *   percentil 10 = 13 %   ·   mediana = 36 %   ·   percentil 90 = 73 %
 *
 * El umbral estaba puesto en 0,35 «a ojo» y **suspendía 13 de esas 26 razones**: es decir, mi propio
 * trabajo verificado no pasaba mi propio examen. Explicar bien es PARAFRASEAR («el precepto exige
 * que la identidad esté garantizada antes de usar el sistema» no comparte casi vocabulario con el
 * artículo y es exactamente lo que hay que escribir). Bajado al percentil 10 de lo humano: por
 * debajo de eso ya no hay relación con el texto legal.
 *
 * ⚠️ Este gate caza al que se INVENTA doctrina, no al que parafrasea. Que lo escrito sea CIERTO no
 * lo dice ningún número: eso es la auditoría por muestra con agente.
 */
const ANCLAJE_MINIMO = 0.12;

const PROMPT = (c) => `Escribe la explicación de esta pregunta de test de oposición, apoyándote en el artículo que te doy.

CÓMO SE EXPLICA UNA PREGUNTA DE OPOSICIÓN:
· Cada razón dice POR QUÉ esa opción es correcta o incorrecta CONTRA EL TEXTO DE LA NORMA, no repite el enunciado de la opción.
· Si una opción falla por una palabra (un plazo, un órgano, «previo» frente a «previo o posterior»), señala esa palabra: es lo que el opositor tiene que retener.
· No inventes doctrina ni datos que no estén en el artículo. Si el artículo no da para justificar una opción, dilo en su razón con lo que sí se pueda afirmar.

REGLA DEL BARAJADO: las opciones se sirven en orden aleatorio, así que la letra que ve el opositor NO es fija. Cada razón va referida al CONTENIDO de su opción, nunca a su letra ni a su posición. La introducción y el cierre NO pueden nombrar ninguna letra de opción. (Las letras de la NORMA sí valen: «el apartado b) del artículo 21».)

PREGUNTA: ${c.question_text}
A) ${c.option_a}
B) ${c.option_b}
${c.option_c ? `C) ${c.option_c}` : ''}
${c.option_d ? `D) ${c.option_d}` : ''}
RESPUESTA CORRECTA: ${'ABCD'[c.correct_option]}

ARTÍCULO ${c.articulo_num ? `(art. ${c.articulo_num} · ${c.ley})` : ''}:
${c.articulo}

Devuelve SOLO este JSON (el campo "v" es obligatorio y vale 1):
{"v":1,"intro":"contexto: qué regula el artículo y dónde está la clave de la pregunta","cita":{"ref":"Artículo N de la norma","texto":"copia LITERAL del fragmento que decide"},"options":{"0":"por qué la opción A es correcta o incorrecta","1":"...","2":"...","3":"..."},"outro":"**Clave:** la idea que hay que retener"}
Una entrada en "options" por CADA opción que exista (0=A, 1=B, 2=C, 3=D). Si no puedes citar literalmente, omite "cita" — nunca la inventes.`;

/** Los cinco gates. Devuelve el primero que falla, o null si pasa todo. */
function evaluar(V, caso, data) {
  if (!data || typeof data !== 'object') return 'json_invalido';
  const nOpts = [caso.option_a, caso.option_b, caso.option_c, caso.option_d].filter(Boolean).length;

  if (!V.isStructuredExplanation(data, nOpts)) return 'estructura_incompleta';

  for (const t of [data.intro, data.outro]) {
    if (t && V.explanationReferencesLetters(String(t))) return 'narrativa_con_letras';
  }

  try {
    V.renderStructuredExplanation(data, { correctOption: caso.correct_option, optionOrder: null, nOptions: nOpts });
  } catch { return 'render_peta'; }

  // Cita: si la declara, tiene que estar de verdad en el artículo.
  if (data.cita?.texto && citaNoLiteral(String(data.cita.texto), caso.articulo)) return 'cita_inventada';

  // ANCLAJE: lo que escribe tiene que apoyarse en el artículo que se le dio. Se mide sobre las
  // RAZONES (que son lo que afirma), no sobre intro/outro, que son contexto y pueden ser más libres.
  const art = normalizar(caso.articulo);
  const razones = Object.values(data.options || {}).map((x) => normalizar(String(x)));
  const flojas = razones.filter((r) => r.length > 40 && cobertura(r, art) < ANCLAJE_MINIMO).length;
  // Se toleran hasta dos razones flojas: un distractor puede ser ajeno a la norma y hay que explicar
  // por qué lo es, sin poder apoyarse en ella. A partir de tres, el modelo escribe de su cosecha.
  if (flojas >= 3) return 'sin_anclaje_en_el_articulo';

  return null;
}

(async () => {
  const V = {
    ...(await import(path.join(RAIZ, 'lib/shuffle/structuredExplanation.ts'))),
    ...(await import(path.join(RAIZ, 'lib/shuffle/classifyShuffleMode.ts'))),
  };

  // Muestra: PROSA corrida (la población de verdad), con artículo REAL y exposición. Y verificadas:
  // escribir razones sobre una pregunta cuya clave nadie ha comprobado es construir sobre arena.
  const casos = await sql`
    SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option,
           left(a.content, 3000) AS articulo, a.article_number AS articulo_num, l.short_name AS ley,
           (SELECT count(*) FROM test_questions t WHERE t.question_id = q.id)::int AS servidas
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE q.is_active = true AND q.explanation_data IS NULL
       AND l.boe_url IS NOT NULL AND length(a.content) > 300
       AND position('**A)' in coalesce(q.explanation, '')) = 0
       AND EXISTS (SELECT 1 FROM ai_verification_results v WHERE v.question_id = q.id)
       AND (SELECT count(*) FROM test_questions t WHERE t.question_id = q.id) >= 30
     ORDER BY q.id
     LIMIT ${N_CASOS}`;
  console.error(`muestra: ${casos.length} preguntas de PROSA, con artículo real y ya verificadas\n`);

  const tabla = [];
  const fallos = {};
  await enTandas(MODELOS, CONCURRENCIA, async (modelo) => {
    let ok = 0, ms = 0, coste = 0;
    fallos[modelo] = {};
    for (const c of casos) {
      let r;
      try { r = await llamarModelo({ key: KEY, modelo, prompt: PROMPT(c), registrar }); }
      catch { r = { ms: 0, coste: 0, tokens: 0, data: null }; }
      ms += r.ms; coste += r.coste;
      const fallo = evaluar(V, c, r.data);
      if (!fallo) ok++; else fallos[modelo][fallo] = (fallos[modelo][fallo] || 0) + 1;
    }
    tabla.push({ modelo, ok, total: casos.length, segundos: +(ms / 1000).toFixed(1), coste: +coste.toFixed(5) });
    console.error(`  ${modelo} → ${ok}/${casos.length}`);
  });

  imprimirTabla(tabla, fallos, 'pasa gates');
  console.log('\n  ⚠️  Esto elige CANDIDATOS, no aprueba contenido: los gates miden forma y anclaje,');
  console.log('      no que lo escrito sea cierto. Antes de soltar nada, muestra auditada por agente.\n');
  await sql.end();
})().catch((e) => { console.error(e); process.exit(1); });
