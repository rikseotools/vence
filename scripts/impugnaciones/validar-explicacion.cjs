#!/usr/bin/env node
// Guardarraíl determinista para explicaciones de preguntas (manual impugnaciones §5.1).
// Verifica MECÁNICAMENTE lo que Claude tiende a saltarse: formato por opción + saltos de
// línea (no apelotonado) + que la CITA en blockquote existe LITERAL en el artículo vinculado
// (caza citas inventadas). Exit 0 = OK; exit 1 = hay problemas (los lista).
//
// Uso: node scripts/impugnaciones/validar-explicacion.cjs <question_id> <fichero_explicacion>
//   (o pasar la explicación por stdin si no se da fichero)
const fs = require('fs');
// `postgres` está en las deps de la raíz → require normal. Y va LAZY: solo hace falta para leer el
// artículo de la BD, así que las funciones PURAS (checkCorrespondence, explanationBlocks) se pueden
// importar y testear sin arrastrar la dependencia.
//
// ⚠️ Antes era `require('/home/manuel/Documentos/github/vence/backend/node_modules/postgres')` —
// la ruta ABSOLUTA de un disco concreto, y al cargar el módulo. Funcionaba en esa máquina y en el CI
// reventaba con "Cannot find module …/backend/node_modules/postgres", tumbando la suite ENTERA (y con
// ella el gate de CI, que bloquea el deploy de TODAS las sesiones). El test pasaba en local: por eso
// coló. Nunca hardcodear rutas del disco propio en algo commiteado.
const getPg = () => require('postgres');
function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(require('path').join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

function validateFormat(expl, opts, correctLetter) {
  const problems = [];
  const t = expl.trim();
  // 1. arranca afirmando la clave
  if (!/^la respuesta correcta es/i.test(t)) problems.push('No empieza con "La respuesta correcta es …".');
  // 2. análisis por opción: cada opción existente debe aparecer como "**A)" … según nº de opciones
  const letters = ['A', 'B', 'C', 'D'].filter((L) => opts[L] != null && opts[L] !== '');
  const missing = letters.filter((L) => !new RegExp(`\\*\\*${L}\\)`, 'i').test(t));
  if (missing.length) problems.push(`Falta el análisis por opción de: ${missing.join(', ')} (formato "**${missing[0]}) …").`);
  // 3. no apelotonado: al menos 3 bloques separados por línea en blanco
  const blocks = t.split(/\n\s*\n/).filter((b) => b.trim());
  if (blocks.length < 3) problems.push(`Apelotonado: solo ${blocks.length} párrafo(s). Separa cada sección/opción con línea en blanco.`);
  // 4. sin secciones Truco/Consejo/Tip. "truco"/"tip" no salen en texto legal legítimo → se
  //    marcan en cualquier posición. Pero "consejo" es también un ÓRGANO omnipresente en Derecho
  //    (Consejo de Gobierno / de Ministros / de Estado / General del Poder Judicial…), así que solo
  //    se marca cuando es ETIQUETA de sección ("Consejo:" al inicio de línea), no como parte de un
  //    nombre de órgano — si no, false-positiveaba casi toda explicación legal (caso Jesse, 16/07).
  if (/\b(truco|tip)\b/i.test(t) || /(^|\n)\s*[>\-*#]*\s*\**\s*consejos?\s*:/i.test(t)) problems.push('Contiene "Truco/Consejo/Tip" (prohibido §5.1).');
  // 5. COHERENCIA clave↔explicación: la opción SEÑALADA debe ser EXACTAMENTE la clave real.
  //    Caza el error grave de una explicación que da por buena una opción distinta de correct_option.
  //
  //    Dos marcos, y las etiquetas están ACORDADAS con `renderEstiloImpugnacion` (T-212):
  //      · «señale la CORRECTA» (lo normal) → la señalada dice `**X)** CORRECTA`.
  //      · «señale la INCORRECTA»           → la señalada dice `**X)** ES LA INCORRECTA` y las
  //        demás `VERDADERA`. Etiquetarlas «CORRECTA» daría aquí tres marcadas y el validador
  //        tumbaría un texto impecable; y al revés, exigir «CORRECTA» obligaba a escribir
  //        `**A)** CORRECTA — Afirmación falsa: …`, que se contradice sola.
  //    El marco se detecta por el TEXTO (aquí no hay `frame`): manda `ES LA INCORRECTA` si aparece.
  const señaladaFalsa = letters.filter((L) => new RegExp(`\\*\\*${L}\\)\\s*(?:\\*\\*)?\\s*ES LA INCORRECTA`, 'i').test(t));
  const marcoIncorrecta = señaladaFalsa.length > 0;
  const marked = marcoIncorrecta
    ? señaladaFalsa
    : letters.filter((L) => new RegExp(`\\*\\*${L}\\)\\s*(?:\\*\\*)?\\s*CORRECTA`, 'i').test(t));
  const etiq = marcoIncorrecta ? 'ES LA INCORRECTA' : 'CORRECTA';
  if (marked.length === 0) problems.push('Ninguna opción marcada como "CORRECTA" en el análisis por opción.');
  else if (marked.length > 1) problems.push(`Varias opciones marcadas ${etiq} (${marked.join(', ')}) — solo puede haber una.`);
  else if (correctLetter && marked[0] !== correctLetter) problems.push(`La explicación marca ${etiq} la ${marked[0]}, pero la clave real (correct_option) es la ${correctLetter}. Incoherencia grave.`);
  return problems;
}

// AVISO (no bloquea) de posible explicación CRUZADA: bloques que rebaten opciones que no son las
// de esta pregunta. El check de coherencia (5) solo mira la opción marcada CORRECTA, así que una
// explicación con la clave bien pero los distractores importados de otra pregunta pasa limpia:
// es justo lo que ocurrió en `def2efab` (Defensor del Pueblo, impugnación 16/07), sellada
// `explanation_ok=true` por 4 verificaciones seguidas.
//
// Por qué AVISO y no problema: medir solape léxico opción↔su bloque tiene ~20% de precisión
// (barrido 16/07: 442 candidatas por solape ~0 → solo 89 cruzadas reales). Una explicación
// legítima parafrasea ("El umbral no es del 3 %, sino del 5 %" para la opción "Más del 3 por 100")
// o rebate con numerales. Bloquear con esta señal frenaría explicaciones correctas — y un
// guardarraíl que da falsos positivos se acaba ignorando. Decide el humano/agente leyendo.
const STOP_ES = new Set(['para','que','con','por','las','los','del','una','uno','sobre','como','este','esta','sera','sean','ante','entre','desde','hasta','cuando','donde','todo','todos','todas','debe','deben','puede','pueden','correcta','incorrecta','correctas','incorrectas','opcion','articulo','segun','porque','tener','hacer','forma','caso','casos']);
const contentTokens = (s) => new Set(norm(s).split(' ').filter((w) => w.length >= 5 && !STOP_ES.has(w)));

// Trozo de la explicación dedicado a cada letra (desde "**A)" hasta la siguiente letra).
function explanationBlocks(expl) {
  const out = {};
  const re = /(?:^|\n)\s*[-*]?\s*\**([A-D])\)\**\s*([\s\S]*?)(?=(?:\n\s*[-*]?\s*\**[A-D]\)|$))/g;
  let m;
  while ((m = re.exec(expl))) out[m[1]] = (out[m[1]] || '') + ' ' + m[2];
  return out;
}

function checkCorrespondence(expl, opts, correctLetter) {
  const warnings = [];
  const blocks = explanationBlocks(expl);
  const suspect = [];
  for (const L of ['A', 'B', 'C', 'D']) {
    if (!opts[L] || L === correctLetter) continue;   // los distractores son lo que este check mira
    if (!blocks[L]) continue;
    const ot = contentTokens(opts[L]);
    if (ot.size === 0) continue;                     // opción de solo numerales → sin señal fiable
    const bt = contentTokens(blocks[L]);
    let hit = 0;
    ot.forEach((w) => { if (bt.has(w)) hit++; });
    if (hit === 0) suspect.push(L);
  }
  // Señal solo si NINGÚN distractor comparte contenido: uno suelto es parafraseo normal.
  const distractors = ['A', 'B', 'C', 'D'].filter((L) => opts[L] && L !== correctLetter && blocks[L]);
  if (distractors.length >= 2 && suspect.length === distractors.length) {
    warnings.push(`Posible explicación CRUZADA: los bloques de ${suspect.join(', ')} no comparten NADA con el texto de esas opciones. Comprueba a mano que rebaten estas opciones y no las de otra pregunta (§8.1-ter). Si son paráfrasis correctas, ignora este aviso.`);
  }
  return warnings;
}

// Una línea del blockquote que va ENTERA en negrita («**Artículo 4.1 CE**», con `:` opcional) es
// la REFERENCIA de la cita, no texto de la ley: nombrarla es cosa nuestra y jamás va a aparecer
// literal dentro del artículo. Se separa antes de comparar.
//
// Por qué existe esto (T-204): el render de la explicación estructurada compone el blockquote en
// dos líneas —referencia + cita— y este validador, que unía todas y las exigía literales, tumbaba
// como «posible cita inventada» justamente la forma canónica que documenta `aplicar-explicacion.ts`
// y que el manual declara obligatoria. El guardarraíl frenaba lo correcto, que es el peor modo de
// fallar que tiene un verificador (§15.8).
//
// ⚠️ AFINADO el 28/07: «línea entera en negrita» NO basta para llamarla referencia. Medido sobre el
// banco vivo, **2.887 preguntas activas (6,8 % de las que tienen blockquote) escriben la CITA
// COMPLETA en negrita** —`> **«Se entiende por expediente administrativo…»**`—, así que la regla
// laxa las descartaba enteras y el check se quedaba sin nada que verificar: devolvía «sin
// problemas» sobre citas que no estaban en el artículo. Un guardarraíl ciego es peor que no
// tenerlo, porque da una garantía que no existe. Cazado al resolver la impugnación `533cb8db`
// (art. 70 LPAC), cuya cita fusionaba dos apartados y pasaba limpia.
//
// Ahora una referencia tiene que PARECERLO: corta y nombrando la norma o el artículo.
const MAX_REFERENCIA = 120; // caracteres; por encima es cita, no rótulo
const RE_PARECE_REFERENCIA =
  /^(arts?\.?|art[íi]culo|apartado|p[áa]rrafo|disposici[óo]n|ley|l\.?o\.?|real decreto|r\.?d\.?|reglamento|estatuto|constituci[óo]n|c[óo]digo|directiva|orden|decreto)\b/i;
const RE_CONTIENE_CITA_NORMA = /\b(art[íi]?c?u?l?o?\.?|ley|l\.?o\.?|r\.?d\.?)\s*\d/i;

const esLineaDeReferencia = (l) => {
  const t = l.trim();
  if (!/^\*\*[^*]+\*\*\s*:?$/.test(t)) return false;
  const dentro = t.replace(/^\*\*/, '').replace(/\*\*\s*:?$/, '').trim();
  if (dentro.length > MAX_REFERENCIA) return false;
  return RE_PARECE_REFERENCIA.test(dentro) || RE_CONTIENE_CITA_NORMA.test(dentro);
};

// Una cita puede OMITIR tramos legítimamente con «(...)» o «…» — eso no la hace inventada. Se
// parte por esas marcas y cada fragmento se exige literal por separado. Los fragmentos cortos no
// se comprueban: una brizna de 3 palabras aparece en cualquier texto y solo generaría ruido.
const MIN_FRAGMENTO = 25; // caracteres YA normalizados
const partirPorElipsis = (q) => q.split(/\(\s*(?:\.{2,}|…)\s*\)|\[\s*(?:\.{2,}|…)\s*\]|\.{3,}|…/);

// Muchas citas legítimas CIERRAN con su propia referencia dentro del blockquote: «…organización de
// sus instituciones de autogobierno (art. 27 de la LO 1/1981)». Esa coletilla la ponemos nosotros y
// nunca está en el texto del artículo, así que exigirla literal marcaría como inventada una cita
// impecable. Medido el 27/07 sobre 5.000 explicaciones vivas: sin esta poda el check estricto
// levantaba 942 (18,8%), y la mayoría eran exactamente esto.
//
// Se poda SOLO si con ello la cita pasa a casar: si aun sin coletilla sigue sin aparecer, el
// problema es la cita, no la referencia, y se reporta igual.
const MARCA_REFERENCIA = /\s(?:arts?|articulo|articulos|apartado|parrafo|ley|lo|ldo|rd|real decreto|reglamento|estatuto|constitucion|cp|ce)\s+[0-9ivx]/;
function sinReferenciaFinal(fragmento, contenidoNormalizado) {
  if (contenidoNormalizado.includes(fragmento)) return fragmento;
  const m = MARCA_REFERENCIA.exec(fragmento);
  if (!m || m.index < MIN_FRAGMENTO) return fragmento;
  const podado = fragmento.slice(0, m.index).trim();
  return contenidoNormalizado.includes(podado) ? podado : fragmento;
}

function validateQuotes(expl, articleContent) {
  const problems = [];
  const lineas = expl.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('>')).map((l) => l.replace(/^>+\s?/, ''));
  const quoteLines = lineas.filter((l) => l && !esLineaDeReferencia(l));
  const quote = quoteLines.join(' ').trim();
  if (!quote) return problems; // sin cita literal → nada que verificar
  const nc = norm(articleContent || '');

  // La cita debe existir literal en el artículo ENTERA, no solo su arranque.
  //
  // Antes se comparaban los primeros 80 caracteres (`nq.slice(0, 80)`) y el resto no se miraba
  // nunca. Cazado el 27/07 atacando el propio guardarraíl: invertí el final de la cita del art. 4.1
  // CE («siendo la ROJA de doble anchura que cada una de las AMARILLAS», lo contrario de la norma y
  // justo el error que esa pregunta examina) y la aprobó. El arranque de una cita legal suele ser
  // genérico —«El plazo de presentación de solicitudes será de…»— y lo que decide la respuesta
  // (plazos, mayorías, órgano competente) vive al final, o sea, justo en el tramo ciego.
  const fragmentos = partirPorElipsis(quote)
    .map((f) => norm(f))
    .filter((f) => f.length >= MIN_FRAGMENTO);
  // Cita corta (o toda ella por debajo del umbral): se comprueba entera, sin trocear.
  const aComprobar = fragmentos.length ? fragmentos : [norm(quote)].filter(Boolean);

  const fallo = aComprobar.map((f) => sinReferenciaFinal(f, nc)).find((f) => !nc.includes(f));
  if (fallo !== undefined) {
    const troceada = aComprobar.length > 1;
    problems.push(
      `La cita en blockquote NO aparece literal en el artículo vinculado (posible cita inventada o de otro artículo).\n` +
      `     cita: "${quote.slice(0, 90)}…"` +
      (troceada ? `\n     tramo que falla: "${fallo.slice(0, 90)}…"` : '')
    );
  }
  return problems;
}

// Exporta los helpers puros para test (sin BD). Si se requiere como módulo, no ejecuta el CLI.
if (require.main !== module) {
  module.exports = { validateFormat, validateQuotes, checkCorrespondence, explanationBlocks };
  return;
}

(async () => {
  const [qid, file] = process.argv.slice(2);
  if (!qid) { console.error('Uso: validar-explicacion.cjs <question_id> <fichero>'); process.exit(2); }
  const expl = file ? fs.readFileSync(file, 'utf8') : fs.readFileSync(0, 'utf8');
  const s = getPg()(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const [q] = await s`SELECT option_a, option_b, option_c, option_d, correct_option, q.explanation_data, a.content acontent
      FROM questions q LEFT JOIN articles a ON a.id = q.primary_article_id WHERE q.id = ${qid}`;
    if (!q) { console.error('Pregunta no encontrada:', qid); process.exit(2); }
    const opts = { A: q.option_a, B: q.option_b, C: q.option_c, D: q.option_d };
    const correctLetter = ['A', 'B', 'C', 'D'][q.correct_option];
    const problems = [...validateFormat(expl, opts, correctLetter), ...validateQuotes(expl, q.acontent)];
    const warnings = checkCorrespondence(expl, opts, correctLetter);

    // ── ¿Esta explicación podrá BARAJARSE? (Fase 2 de T-080, 27/07/2026) ────────────────────
    //
    // Una explicación que cita las opciones por letra impide barajar esa pregunta PARA SIEMPRE:
    // 47.388 preguntas activas están bloqueadas hoy solo por eso. La salida es transcribirla al
    // formato estructurado (`explanation_data`), donde la razón va keada a la opción y la letra
    // la pone el render.
    //
    // Se comprueba AQUÍ porque este guardarraíl es el ÚNICO paso obligatorio antes de aplicar una
    // explicación (manual §5.1). Ponerlo solo en el manual sería confiar en que alguien se
    // acuerde — que es exactamente por lo que este script existe.
    //
    // Es AVISO, no bloqueo: el 74% del histórico de impugnaciones está en prosa libre sin
    // análisis por opción, así que bloquear hoy convertiría el gate en ruido que se ignora (la
    // lección del gate de cabecera que salía rojo en el 100% de los batches buenos).
    let transcribible = false;
    try {
      // El núcleo de la explicación estructurada es TypeScript y este guardarraíl es CommonJS
      // puro (se invoca con `node`, como dice el manual). En vez de duplicar los parsers en .cjs
      // —dos copias de un criterio que DEBE ser uno— se registra el cargador de TS que ya trae el
      // proyecto. Si no estuviera, el catch de abajo lo degrada a aviso y el guardarraíl sigue.
      require('tsx/cjs');
      const { parseLetterFormatExplanation, parseImpugnacionFormatExplanation } = require('../../lib/shuffle/structuredExplanation');
      const nOptions = ['A', 'B', 'C', 'D'].filter((L) => opts[L]).length;
      transcribible = !!(
        parseLetterFormatExplanation(expl, { correctOption: q.correct_option, nOptions }) ||
        parseImpugnacionFormatExplanation(expl, { correctOption: q.correct_option, nOptions })
      );
    } catch (e) {
      warnings.push(`no se pudo comprobar si es barajable: ${e.message}`);
    }
    if (q.explanation_data) {
      // La pregunta YA tiene explicación estructurada: es barajable POR CONSTRUCCIÓN y el texto
      // se renderiza desde la estructura. Preguntarle al parser del HISTÓRICO si sabría
      // transcribir ese texto no dice nada útil —y con el marco «señale la INCORRECTA» (T-212)
      // dice que NO, porque sus etiquetas no son las que el parser conoce—. Avisar ahí de que
      // «no se podrá barajar» era falso y, peor, ruido en un guardarraíl obligatorio: así es
      // como se acaba ignorando un guardarraíl (§15.8).
      console.log('🔀 Ya estructurada: barajable por construcción (explanation_data presente).');
    } else if (transcribible) {
      console.log('🔀 Barajable: la explicación se puede transcribir al formato estructurado.');
      console.log(`   Tras aplicarla:  npx tsx --env-file=.env.local scripts/backfill-explanation-data.ts --pregunta ${qid} --apply`);
    } else {
      warnings.push(
        'NO se podrá transcribir al formato barajable (§8.2): la pregunta seguirá sin poder ' +
        'barajar sus opciones. Suele ser por explicar en prosa sin una razón por opción, o por ' +
        'referirse a las opciones por su posición. Ver docs/maintenance/impugnaciones-claude-code.md.',
      );
    }
    if (problems.length === 0) {
      console.log('✅ Explicación VÁLIDA (formato §5.1 + cita literal verificada).');
      warnings.forEach((w) => console.log(`⚠️  AVISO (no bloquea): ${w}`));
      process.exit(0);
    }
    console.log('❌ Explicación con PROBLEMAS:');
    problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));
    warnings.forEach((w) => console.log(`⚠️  AVISO (no bloquea): ${w}`));
    process.exit(1);
  } finally { await s.end(); }
})();
