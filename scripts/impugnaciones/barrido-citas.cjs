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
  const m = cita.match(RE_ENTRECOMILLADO);
  if (!m) return null;
  return { texto: m[1], elipsis: RE_ELIPSIS.test(m[1]) };
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

/** Nº de artículo que la propia cita declara, si lo declara y NO es el vinculado. */
function refDeclaradaDistinta(explanation, articleNumber) {
  const lineas = explanation.split('\n').map((l) => l.trim())
    .filter((l) => l.startsWith('>')).map((l) => l.replace(/^>+\s?/, ''));
  // La referencia va antes del entrecomillado: se busca en el tramo previo a la primera comilla.
  const bq = lineas.join(' ');
  // Solo cuenta lo que va ANTES de la cita: un artículo nombrado DENTRO del texto citado
  // («…conforme al artículo 30») no significa que la cita sea de ese artículo. Y si el blockquote
  // ARRANCA con la comilla, no hay cabeza donde declarar nada.
  const corte = bq.search(/[«"“]/);
  const cabeza = corte === -1 ? bq : bq.slice(0, corte);
  const m = cabeza.match(RE_REF_ARTICULO);
  if (!m) return null;
  const declarado = m[1].replace(/\s+/g, ' ').trim();
  return String(declarado) === String(articleNumber) ? null : declarado;
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
  module.exports = { refDeclaradaDistinta, citaAusente, solapeConArticulo };
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
        const ref = refDeclaradaDistinta(r.explanation, r.article_number);
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
