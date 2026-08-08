#!/usr/bin/env node
/**
 * audit-literalidad-clave.cjs — mide, sobre TODO el banco activo, si el artículo vinculado
 * responde LITERALMENTE la opción correcta. [T-672]
 *
 * ## La premisa que esto mide (Manuel, 07/08/2026, manual de impugnaciones §7.3.PREMISA)
 *
 * «Las preguntas deben ser literales y el artículo debe responderla sin ambigüedad. Lo no
 * literal y ambiguo debe o reformularse o desactivarse.»
 *
 * ## Qué mide, y qué NO
 *
 * Solo `recall(opción correcta, artículo PROPIO)` — la misma señal que ya calcula el check (b)
 * del dossier de impugnaciones (`revisar-impugnacion.cjs`) y que reutiliza
 * `lib/health/vinculoArticuloVecino.cjs` para su propio caso particular (¿un VECINO responde
 * mejor?). Aquí NO se busca vecino: la pregunta es más simple y más general — ¿el artículo del
 * que la pregunta cuelga la responde, sí o no? Por eso reutiliza `esExaminable`/`recall` de ese
 * módulo (mismas dos exclusiones ya calibradas: negación y meta-opción) en vez de reinventar un
 * tercer tokenizador.
 *
 * ## Por qué es BAJO DEMANDA y da un HISTOGRAMA, no una lista de arreglos
 *
 * La ficha lo pide explícito: «NO empezar por un umbral inventado» y «leer una muestra de cada
 * banda antes de creerse el número». Un recall bajo puede ser una clave correcta con sinónimos
 * o una cifra en letra, no un defecto — el precedente de esta casa (`vinculo_articulo_vecino`)
 * midió 29/07 que incluso tras las dos exclusiones la precisión rondaba 1 de cada 3. Este script
 * por tanto:
 *   1. Calcula el recall de CADA pregunta examinable y lo agrupa en bandas.
 *   2. Cruza con el DAÑO (exposición sim. servida vía `test_questions`, tasa de fallo) SOLO para
 *      poder priorizar la lectura manual — nunca como criterio de desactivación automática.
 *   3. Vuelca los candidatos de baja banda a JSON para revisión manual (--json / --out).
 * NO decide nada, no escribe nada. La adjudicación (reformular/desactivar) es de una persona con
 * la fuente oficial delante, como ya exige el propio manual de impugnaciones.
 *
 * ## Alcance
 *
 * Solo leyes REALES (`laws.boe_url IS NOT NULL`, mismo filtro que `audit-vinculo-articulo-vecino.cjs`):
 * excluye psicotécnicos (viven en otra tabla), ofimática/contenedores editoriales sin BOE
 * (ODM, Agenda 2030… ver T-144) y cualquier "ley" sin fuente oficial registrada — ahí «literal»
 * no se puede juzgar de la misma forma.
 *
 * Uso:
 *   npm run audit:literalidad-clave                          # histograma + top por daño
 *   npm run audit:literalidad-clave -- --ley "CE"             # una ley
 *   npm run audit:literalidad-clave -- --banda 0-25 --json    # candidatos de una banda, en JSON
 *   npm run audit:literalidad-clave -- --out /tmp/cola.json   # vuelca TODOS los candidatos <25% a fichero
 */
const fs = require('fs');
const path = require('path');
const { esExaminable, recall } = require('../lib/health/vinculoArticuloVecino.cjs');
const { BANDAS, bandaDe } = require('../lib/health/bandasLiteralidad.cjs');

// ⚠️ La credencial de lectura se elige en UN SOLO SITIO ([T-624]) y este script la reescribía a
// mano — el guardarraíl `credencialLectura` lo caza, y solo saltó AL MERGEAR: en la rama, aislado,
// no había con qué chocar. `urlLecturaNegocio` ya hace exactamente esto (preferir el rol lector,
// caer a la conexión completa y leer `.env.local` si hace falta), y además sabe de casos que una
// copia nueva no conoce.
const { urlLecturaNegocio } = require('../lib/db/negocioSoloLectura.cjs');
const sql = require('postgres')(urlLecturaNegocio(), {
  ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60,
});

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const LEY = arg('--ley');
const BANDA = arg('--banda'); // "lo-hi" en % enteros, p.ej. "0-25"
const OUT = arg('--out');
const JSON_OUT = argv.includes('--json');


(async () => {
  const leyes = await sql`
    SELECT l.id, l.short_name, count(*)::int n
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE q.is_active = true AND a.is_active = true
       AND l.boe_url IS NOT NULL
       AND length(coalesce(a.content, '')) > 50
       ${LEY ? sql`AND l.short_name = ${LEY}` : sql``}
     GROUP BY 1, 2 HAVING count(*) >= 1
     ORDER BY n DESC`;

  if (!leyes.length) { console.error(LEY ? `Sin preguntas para la ley "${LEY}".` : 'Sin leyes que examinar.'); process.exit(2); }
  if (!JSON_OUT && !OUT) console.error(`examinando ${leyes.length} ley(es) reales…`);

  const excluidos = { enunciado_de_negacion: 0, meta_opcion: 0, opcion_demasiado_corta: 0 };
  const histograma = {}; // banda -> count
  const candidatos = []; // solo <25% (UMBRAL_PROPIO ya calibrado en vinculoArticuloVecino.cjs), con daño

  for (const L of leyes) {
    const qs = await sql`
      SELECT q.id, q.question_text, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
             q.is_official_exam, a.article_number AS art, a.content AS art_content,
             (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id)::int AS servidas,
             (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id AND tq.is_correct = false)::int AS fallos
        FROM questions q JOIN articles a ON a.id = q.primary_article_id
       WHERE q.is_active = true AND a.law_id = ${L.id} AND a.is_active = true
         AND length(coalesce(a.content, '')) > 50`;

    for (const q of qs) {
      const correctText = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option];
      if (!correctText) continue;
      const ex = esExaminable({ questionText: q.question_text, correctText });
      if (!ex.ok) { excluidos[ex.motivo] = (excluidos[ex.motivo] || 0) + 1; continue; }

      const r = recall(correctText, q.art_content);
      const pct = Math.round(r * 100);
      const banda = bandaDe(pct);
      histograma[banda] = (histograma[banda] || 0) + 1;

      if (r < 0.25) {
        candidatos.push({
          id: q.id, ley: L.short_name, art: String(q.art), recall: pct, banda,
          servidas: q.servidas, fallos: q.fallos,
          tasaFallo: q.servidas > 0 ? Math.round((q.fallos / q.servidas) * 100) : null,
          oficial: q.is_official_exam,
          enunciado: String(q.question_text).replace(/\s+/g, ' ').slice(0, 140),
          claveCorrecta: String(correctText).replace(/\s+/g, ' ').slice(0, 140),
        });
      }
    }
    if (!JSON_OUT && !OUT) process.stderr.write('.');
  }

  // Prioridad de lectura: DAÑO primero (exposición × tasa de fallo), no recall más bajo — la
  // ficha lo pide explícito ("cruzar con el daño, que es lo que prioriza").
  candidatos.sort((a, b) => (b.servidas * (b.tasaFallo || 0)) - (a.servidas * (a.tasaFallo || 0)));

  if (BANDA) {
    const filtrados = candidatos.filter((c) => c.banda === BANDA || (BANDA === '0-25' && c.recall < 25));
    console.log(JSON.stringify(filtrados, null, 1));
    await sql.end();
    return;
  }

  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify(candidatos, null, 1));
    console.error(`\n${candidatos.length} candidato(s) <25% volcados a ${OUT}`);
    await sql.end();
    return;
  }

  if (JSON_OUT) { console.log(JSON.stringify({ histograma, excluidos, candidatos }, null, 1)); await sql.end(); return; }

  const totalExaminadas = Object.values(histograma).reduce((a, b) => a + b, 0);
  const totalExcluidas = Object.values(excluidos).reduce((a, b) => a + b, 0);
  console.log(`\n\n📊 ${totalExaminadas} pregunta(s) examinada(s) (${totalExcluidas} excluidas: ` +
    `${excluidos.enunciado_de_negacion} negación · ${excluidos.meta_opcion} meta-opción · ` +
    `${excluidos.opcion_demasiado_corta} opción corta)\n`);
  console.log('recall clave↔artículo propio, distribución:');
  for (const [lo, hi] of BANDAS) {
    const b = `${lo}-${hi === 101 ? 100 : hi}`;
    const n = histograma[b] || 0;
    const barra = '█'.repeat(Math.min(60, Math.round((n / totalExaminadas) * 300)));
    console.log(`  ${b.padStart(6)}%  ${String(n).padStart(6)}  ${barra}`);
  }

  console.log(`\n🔎 ${candidatos.length} candidato(s) bajo el 25% (umbral ya calibrado en vinculoArticuloVecino.cjs),`);
  console.log(`   ordenados por DAÑO (servidas × % fallo), top 40:\n`);
  for (const c of candidatos.slice(0, 40)) {
    console.log(`  ${String(c.servidas).padStart(4)}×serv ${c.tasaFallo === null ? '  —' : String(c.tasaFallo).padStart(3) + '%'} fallo · ` +
      `${c.id.slice(0, 8)} ${c.ley} art.${c.art} (recall ${c.recall}%)${c.oficial ? ' [OFICIAL]' : ''}`);
    console.log(`         P: ${c.enunciado}`);
    console.log(`         R: ${c.claveCorrecta}`);
  }
  if (candidatos.length > 40) console.log(`\n  … y ${candidatos.length - 40} más (usa --out <fichero.json> para todos).`);
  console.log('\n⚠️  CANDIDATOS, no defectos confirmados: leer cada uno contra la fuente oficial antes de');
  console.log('    reformular/desactivar. Precisión NO calibrada todavía sobre este universo — ver ficha T-672.\n');
  await sql.end();
})().catch((e) => { console.error(e); process.exit(1); });
