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

function citaAusente(texto, articleContent) {
  const nt = norm(texto);
  const chunk = nt.length > 70 ? nt.slice(0, 70) : nt;
  return chunk ? !norm(articleContent || '').includes(chunk) : false;
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

(async () => {
  const args = process.argv.slice(2);
  const incluirElipsis = args.includes('--incluir-elipsis');
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

  const sql = pg(getUrl(), { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 30 });
  try {
    const filas = await sql`
      SELECT q.id, q.explanation, q.lifecycle_state,
             a.content, a.article_number, l.short_name AS ley,
             (SELECT count(*)::int FROM test_questions tq WHERE tq.question_id = q.id) AS intentos
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.lifecycle_state IN ('approved','tech_approved')
        AND q.explanation LIKE '%>%'`;

    let pretenden = 0, saltadasElipsis = 0;
    const hallazgos = [];
    for (const r of filas) {
      const cita = citaLiteralPretendida(r.explanation);
      if (!cita) continue;
      if (cita.elipsis && !incluirElipsis) { saltadasElipsis++; continue; }
      pretenden++;
      if (citaAusente(cita.texto, r.content)) {
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
