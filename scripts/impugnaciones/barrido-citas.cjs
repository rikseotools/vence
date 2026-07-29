#!/usr/bin/env node
// Barrido masivo del check de CITAS de validar-explicacion.cjs sobre el banco VISIBLE.
// Caza explicaciones que atribuyen a un artículo una cita textual que ese artículo NO contiene.
// Cada hallazgo es una de dos cosas, ambas defecto: cita inventada, o pregunta mal vinculada.
//
// El guardarraíl solo corre sobre explicaciones NUEVAS (al atender una impugnación); esto lo
// apunta al banco ya publicado. Mismo criterio de cita que validar-explicacion.cjs (norm + chunk).
//
// Uso:
//   node scripts/impugnaciones/barrido-citas.cjs                 # informe (top 40 por tráfico)
//   node scripts/impugnaciones/barrido-citas.cjs --out f.json    # + volcado completo
//   node scripts/impugnaciones/barrido-citas.cjs --json           # resumen para health-sweep
//   node scripts/impugnaciones/barrido-citas.cjs --incluir-elipsis
//     (por defecto se EXCLUYEN las citas con "…"/"...": el recorte impide comparar texto contiguo,
//      así que darían falso positivo. Con el flag se incluyen, marcadas `elipsis:true`, para revisión
//      manual — suben el recuento pero no son concluyentes.)
const fs = require('fs');
const path = require('path');
// postgres.js: deps raíz; backend/node_modules como respaldo (scripts CLI, no corren en CI)
const pg = (() => { try { return require('postgres'); } catch { return require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres')); } })();

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}

// Idéntico a validar-explicacion.cjs: un solo criterio de normalización para todo el sistema.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9ñ]+/g, ' ').replace(/\s+/g, ' ').trim();

const RE_ARTICULO = /\bart[íi]?c?u?l?o?\.?\s*\d/i;
const RE_ELIPSIS = /\.\.\.|…|\[\.\.\.\]/;
const RE_ENTRECOMILLADO = /[«"“]([^»"”]{60,})[»"”]/;

function extraerCita(explanation) {
  const lineas = explanation.split('\n').map((l) => l.trim())
    .filter((l) => l.startsWith('>')).map((l) => l.replace(/^>+\s?/, ''));
  return lineas.join(' ').trim();
}

// Devuelve null si la explicación no pretende citar literalmente (blockquote de énfasis/paráfrasis:
// no es defecto). Devuelve {texto, elipsis} cuando sí invoca un artículo y entrecomilla.
function citaLiteralPretendida(explanation) {
  const cita = extraerCita(explanation);
  if (!cita || !RE_ARTICULO.test(cita)) return null;
  // De TODOS los entrecomillados del blockquote, la cita es el MÁS LARGO **que no sea una
  // rúbrica**. Coger el primero confundía el rótulo con la cita: «CP art. 405 (Capítulo I, "De la
  // prevaricación de los funcionarios públicos…"): "A la autoridad o funcionario público que…"».
  //
  // Quedarse con el más largo NO bastaba, y el caso lo enseña la nº1 del cubo por tráfico:
  // `1d68ed6e` (CE art. 43, **357 exposiciones**) usa el blockquote como ESQUEMA del Título I y
  // TODO lo que entrecomilla son rúbricas de secciones — la más larga sigue siendo una rúbrica. La
  // pregunta es correcta y el barrido la acusaba. Si no queda ningún entrecomillado que pretenda
  // ser articulado, aquí no hay cita que juzgar.
  const citas = citasAtribuidas(explanation).filter((x) => !x.rubrica);
  if (!citas.length) return null;
  const texto = citas.map((x) => x.texto).filter((t) => t.length >= 60).reduce((a, b) => (b.length > a.length ? b : a), '');
  if (!texto) return null;
  return { texto, elipsis: RE_ELIPSIS.test(texto) };
}

// El criterio de "¿la cita está literal en el artículo?" es UNO y vive en el guardarraíl
// (`validar-explicacion.cjs`). Aquí había una COPIA que comparaba solo `slice(0, 70)`: la campaña
// de julio inventarió únicamente las citas que divergen en sus primeras 70 letras, y el arranque de
// un precepto es genérico —lo que decide la respuesta (plazos, mayorías, órgano competente) vive al
// final, justo en el tramo que la copia no miraba—. Dos implementaciones del mismo criterio
// divergen siempre; el barrido y el guardarraíl tienen que decir lo MISMO de la misma pregunta.
const { citaNoLiteral } = require('./validar-explicacion.cjs');

// ── Cita de OTRO artículo, DECLARADO por la propia explicación ────────────────────────────────
//
// Una explicación puede citar legítimamente un artículo distinto del que cuelga la pregunta, y
// decirlo: «Art. 56.3: "La persona del Rey es inviolable…"» en una pregunta colgada del art. 65
// (actos exceptuados de refrendo), o «Art. 48.2 (anulabilidad por defecto de forma)» en una de
// nulidad. Comparar esa cita contra el artículo VINCULADO la declara falsa cuando es correcta.
//
// Medido el 28/07 sobre las 39 «ajenas» del inventario: 19 citaban otro artículo de la misma ley,
// y las dos de más tráfico revisadas a mano resultaron legítimas. Un cubo lleno de aciertos
// marcados como defectos es un cubo que nadie drena.
const RE_REF_ARTICULO = /\bart[íi]?c?u?l?o?\.?\s*(\d+\s*(?:bis|ter|quater)?)/i;

/**
 * Trocea el blockquote en pares (cita, artículo que la propia explicación le atribuye).
 *
 * POR QUÉ HACE FALTA TROCEAR (28/07/2026, T-207). Antes se miraba el blockquote como si fuera UNA
 * cita con UNA atribución, y las explicaciones apilan varias:
 *
 *     > **Art. 166:** "La iniciativa de reforma constitucional se ejercerá…"
 *     > **Art. 87.2:** "Las Asambleas de las Comunidades Autónomas podrán solicitar…"
 *
 * `citaLiteralPretendida` se queda con el entrecomillado **más largo** (el del 87.2) y la
 * atribución se leía del tramo previo a la PRIMERA comilla (el «Art. 166»). Resultado: se juzgaba
 * el texto del 87.2 como si pretendiera ser del 166, no estaba, y la pregunta —correcta— se
 * acusaba de cita inventada. Las dos «ajenas» de más tráfico del cubo eran esto (222 y 86
 * exposiciones). La atribución de en medio no caía ni en la cabeza ni en la cola: quedaba en
 * tierra de nadie.
 *
 * Cada entrecomillado se queda con la referencia MÁS CERCANA que lo precede; si no la tiene, se
 * mira el tramo que va detrás y hasta la cita siguiente, porque parte de la doctrina atribuye
 * después («"…" (Art. 121.1 RP)»). Nunca se mira DENTRO del entrecomillado: un artículo nombrado
 * en el texto citado («…conforme al artículo 30») no convierte la cita en suya.
 *
 * @returns {Array<{texto:string, ref:string|null}>}
 */
function citasAtribuidas(explanation) {
  const bq = String(explanation || '').split('\n').map((l) => l.trim())
    .filter((l) => l.startsWith('>')).map((l) => l.replace(/^>+\s?/, '')).join(' ');
  // OJO: para TROCEAR vale cualquier entrecomillado, por corto que sea. `RE_ENTRECOMILLADO` exige
  // 60+ caracteres porque decide qué cita se JUZGA, no cómo se parte el blockquote; usarlo aquí
  // dejaba sin atribución a las citas cortas («Art. 56.3: "La persona del Rey es inviolable"»).
  const trozos = [...bq.matchAll(/[«"“]([^»"”]+)[»"”]/g)];

  // PRIMERA PASADA — atribuciones que van DETRÁS y PEGADAS a su cita: «…» (Art. 74 Ley 39/2015).
  // Hay que resolverlas antes que nada, porque si no el tramo que separa esta cita de la siguiente
  // se lee como cabecera de la SIGUIENTE y cada cita hereda la referencia de la anterior. Ese
  // desplazamiento de uno se vio en `4ddc6a7e` (Ley 39/2015 art. 74), donde las cuatro citas
  // llevaban su referencia detrás y salieron corridas: 74, 74, 71, 73 en vez de 74, 71, 73, 53.
  // El PARÉNTESIS es lo que distingue una atribución trasera de la cabecera de la cita siguiente:
  //   «…» (Art. 74 Ley 39/2015)   → trasera, es de ESTA cita
  //   «…»  Art. 57.5: "…"         → cabecera, es de la SIGUIENTE
  // Sin exigirlo, el desplazamiento de uno solo cambia de sentido: se lo come la vecina de al lado.
  // El hueco admite marcas de MARKDOWN (`*`, `_`): las explicaciones escriben la atribución en
  // cursiva —`*(Art. 576.1 LEC)*`— y sin contemplarlas la cola no se consumía, así que la cita
  // siguiente volvía a heredar la referencia de la anterior. Caso real `1336a5eb`: la cita del
  // art. 576 salía atribuida al 816 y se acusaba a una pregunta correcta.
  const RE_PEGADA_DETRAS = /^[\s.,;:\-—*_]{0,8}\(\s*art[íi]?c?u?l?o?\.?\s*(\d+\s*(?:bis|ter|quater)?)/i;
  const finDe = (i) => trozos[i].index + trozos[i][0].length;
  const iniSiguiente = (i) => (i + 1 < trozos.length ? trozos[i + 1].index : bq.length);
  const detras = trozos.map((_, i) => {
    const tail = bq.slice(finDe(i), iniSiguiente(i));
    const m = tail.match(RE_PEGADA_DETRAS);
    return m ? { ref: m[1], consumido: m[0].length } : null;
  });

  // ¿Lo entrecomillado es la RÚBRICA de una división (Capítulo/Sección/Título) en vez de una cita
  // del articulado? Manda la referencia MÁS PEGADA a la comilla: en «CP art. 405 (Capítulo I, "De
  // la prevaricación…")» lo último antes de abrir comillas es «Capítulo I», así que eso es una
  // rúbrica — un rótulo, que por definición NO aparece dentro del texto de ningún artículo.
  // Juzgarlo como cita acusa de inventado un texto copiado letra por letra.
  const RE_DIVISION_O_ART = /(art[íi]?c?u?l?o?\.?\s*\d+|cap[íi]tulo|secci[óo]n|t[íi]tulo|libro)/gi;
  const esRubrica = (cabeza) => {
    const ultima = [...String(cabeza).matchAll(RE_DIVISION_O_ART)].pop();
    return !!ultima && !/^art/i.test(ultima[1]);
  };

  const out = [];
  for (let i = 0; i < trozos.length; i++) {
    const desde0 = i === 0 ? 0 : finDe(i - 1) + (detras[i - 1] ? detras[i - 1].consumido : 0);
    const rubrica = esRubrica(bq.slice(desde0, trozos[i].index));
    if (detras[i]) { out.push({ texto: trozos[i][1], ref: String(detras[i].ref).replace(/\s+/g, ' ').trim(), rubrica }); continue; }
    // La cabecera empieza donde acaba la cita anterior MÁS lo que su atribución trasera consumió,
    // para no volver a leer la referencia de la vecina.
    const cabeza = bq.slice(desde0, trozos[i].index);
    const cola = bq.slice(finDe(i), iniSiguiente(i));
    // De la cabeza manda la ÚLTIMA referencia (la pegada a la cita), no la primera.
    const enCabeza = [...cabeza.matchAll(new RegExp(RE_REF_ARTICULO.source, 'gi'))].pop();
    const enCola = cola.match(RE_REF_ARTICULO);
    const ref = enCabeza ? enCabeza[1] : (enCola ? enCola[1] : null);
    out.push({ texto: trozos[i][1], ref: ref === null ? null : String(ref).replace(/\s+/g, ' ').trim(), rubrica });
  }
  return out;
}

/**
 * Nº de artículo que la propia cita declara, si lo declara y NO es el vinculado.
 *
 * `citaTexto` identifica CUÁL de las citas del blockquote se está juzgando. Sin él se mira la más
 * larga, que es la que elige `citaLiteralPretendida` — pero pasarlo explícitamente es lo correcto:
 * juzgar una cita con la atribución de otra es el fallo que esto vino a arreglar.
 */
function refDeclaradaDistinta(explanation, articleNumber, citaTexto) {
  const citas = citasAtribuidas(explanation);
  if (!citas.length) return null;
  const elegida = citaTexto
    ? (citas.find((c) => c.texto === citaTexto) || citas.find((c) => c.texto.includes(citaTexto) || citaTexto.includes(c.texto)))
    : citas.reduce((a, b) => (b.texto.length > a.texto.length ? b : a));
  if (!elegida || elegida.ref === null) return null;
  return String(elegida.ref) === String(articleNumber) ? null : elegida.ref;
}

function citaAusente(texto, articleContent) {
  return citaNoLiteral(texto, articleContent) !== null;
}

// "No es literal" NO significa "está mal": hay tres familias muy distintas y solo una es grave.
// Las separa el solape de vocabulario entre la cita y el artículo vinculado:
//   ALTA  → el artículo dice lo mismo con otra puntuación/formato  = cita RETOCADA (estilo)
//   BAJA  → el artículo no habla de eso                            = cita AJENA (inventada o mal vinculada)
// Se comparan palabras de ≥5 letras para no puntuar con conectores ("de", "la", "que"...).
function solapeConArticulo(texto, articleContent) {
  const palabras = [...new Set(norm(texto).split(' ').filter((w) => w.length >= 5))];
  if (!palabras.length) return 1; // sin léxico propio → no concluyente, no acusar
  const art = norm(articleContent || '');
  return palabras.filter((w) => art.includes(w)).length / palabras.length;
}

const UMBRAL_AJENA = 0.5;    // < 50% del vocabulario de la cita está en el artículo → ajena
const UMBRAL_RETOCADA = 0.8; // ≥ 80% → el artículo dice lo mismo, la cita solo está reformateada

function clasificar(solape) {
  if (solape < UMBRAL_AJENA) return 'ajena';
  if (solape >= UMBRAL_RETOCADA) return 'retocada';
  return 'dudosa';
}

// Exporta los helpers puros para test (sin BD). Si se requiere como módulo, no ejecuta el CLI.
if (require.main !== module) {
  module.exports = { refDeclaradaDistinta, citasAtribuidas, citaLiteralPretendida, citaAusente, solapeConArticulo };
  return;
}

(async () => {
  const args = process.argv.slice(2);
  const incluirElipsis = args.includes('--incluir-elipsis');
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const filas = await sql`
      SELECT q.id, q.explanation, q.lifecycle_state,
             a.content, a.article_number, a.law_id, l.short_name AS ley,
             (SELECT count(*)::int FROM test_questions tq WHERE tq.question_id = q.id) AS intentos
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.lifecycle_state IN ('approved','tech_approved')
        AND q.explanation LIKE '%>%'`;

    let pretenden = 0, saltadasElipsis = 0, declaradas = 0;
    const hallazgos = [];
    for (const r of filas) {
      const cita = citaLiteralPretendida(r.explanation);
      if (!cita) continue;
      if (cita.elipsis && !incluirElipsis) { saltadasElipsis++; continue; }
      pretenden++;
      if (citaAusente(cita.texto, r.content)) {
        // ¿La cita declara otro artículo de la MISMA ley y allí sí es literal? Entonces no hay
        // defecto: es una cita de apoyo correctamente atribuida.
        const ref = refDeclaradaDistinta(r.explanation, r.article_number, cita.texto);
        if (ref) {
          const [otro] = await sql`
            SELECT content FROM articles
             WHERE law_id = ${r.law_id} AND article_number = ${ref} AND is_active LIMIT 1`;
          if (otro && !citaAusente(cita.texto, otro.content)) { declaradas++; continue; }
        }
        const solape = solapeConArticulo(cita.texto, r.content);
        hallazgos.push({
          question_id: r.id,
          articulo: `${r.ley} art ${r.article_number}`,
          intentos: r.intentos,
          elipsis: cita.elipsis,
          solape: Number(solape.toFixed(2)),
          familia: clasificar(solape),
          cita: cita.texto.slice(0, 120),
        });
      }
    }
    hallazgos.sort((a, b) => b.intentos - a.intentos);
    const ajenas = hallazgos.filter((h) => h.familia === 'ajena');
    const dudosas = hallazgos.filter((h) => h.familia === 'dudosa');
    const retocadas = hallazgos.filter((h) => h.familia === 'retocada');

    // Modo máquina para el barrido de salud: SOLO el recuento y una muestra de las AJENAS, que
    // son las únicas accionables. Las `retocadas` (el artículo dice lo mismo, la cita solo está
    // reformateada) no son defecto y meterlas en el badge lo dejaría gritando para siempre —
    // exactamente lo que este repo lleva documentado que hace que se deje de mirar una bandeja.
    if (process.argv.includes('--json')) {
      process.stdout.write(JSON.stringify({
        analizadas: filas.length,
        no_literales: hallazgos.length,
        ajenas: ajenas.length,
        ajenas_vistas: ajenas.filter((h) => h.intentos > 0).length,
        dudosas: dudosas.length,
        retocadas: retocadas.length,
        sample: ajenas.slice(0, 10).map((h) => ({ id: h.question_id, articulo: h.articulo, intentos: h.intentos, solape: h.solape })),
      }));
      await sql.end();
      return;
    }

    console.log('═══ BARRIDO DE CITAS (banco visible) ═══');
    console.log(`Explicaciones con blockquote analizadas : ${filas.length}`);
    console.log(`Citas que PRETENDEN ser literales       : ${pretenden}${incluirElipsis ? ' (incluye elipsis)' : ''}`);
    if (!incluirElipsis) console.log(`Saltadas por elipsis (no concluyentes)  : ${saltadasElipsis}  → verlas con --incluir-elipsis`);
    console.log(`Citas de OTRO artículo, declarado y correcto: ${declaradas}  ← NO son defecto`);
    console.log(`Citas NO literales                      : ${hallazgos.length}`);
    console.log('\n─── Desglose por familia (solo la 1ª es el fallo grave) ───');
    console.log(`🔴 AJENA    (solape <${UMBRAL_AJENA})  : ${ajenas.length}  → el artículo NO habla de eso: cita inventada o pregunta mal vinculada`);
    console.log(`🟠 DUDOSA   (${UMBRAL_AJENA}–${UMBRAL_RETOCADA})     : ${dudosas.length}  → revisión manual`);
    console.log(`🟡 RETOCADA (solape ≥${UMBRAL_RETOCADA}) : ${retocadas.length}  → el artículo dice lo mismo; la cita solo está reformateada (estilo)`);
    console.log(`\nAJENAS que ya ha visto algún usuario    : ${ajenas.filter((h) => h.intentos > 0).length}`);
    console.log('\n─── AJENAS: top 40 por tráfico (los que más daño hacen) ───');
    console.table(ajenas.slice(0, 40).map((h) => ({
      question_id: h.question_id.slice(0, 8), articulo: h.articulo,
      intentos: h.intentos, solape: h.solape, cita: h.cita.slice(0, 46),
    })));

    if (out) {
      fs.writeFileSync(out, JSON.stringify(hallazgos, null, 1));
      console.log(`\nVolcado completo (${hallazgos.length}) → ${out}`);
    }
    console.log('\nCada hallazgo es: cita inventada  O  pregunta mal vinculada. Verificar contra la fuente');
    console.log('antes de tocar nada, y NUNCA auto-corregir la clave.');
  } finally {
    await sql.end();
  }
})();
