#!/usr/bin/env node
/**
 * audit-vinculo-articulo-vecino.cjs — busca preguntas colgadas de un artículo que NO las responde,
 * teniendo un artículo VECINO de la misma ley que sí. **Solo informa: no toca nada.**
 *
 * ## Por qué es BAJO DEMANDA y no un hallazgo del barrido nocturno
 *
 * La precisión medida el 29/07/2026 ronda **1 de cada 3** incluso después de excluir las preguntas de
 * negación y las meta-opciones (ver el porqué en `lib/health/vinculoArticuloVecino.cjs`). Un detector
 * así en el panel enseña a ignorar el panel. Se corre cuando se quiere triar esta cola, se adjudica a
 * mano contra el BOE y se re-vincula lo confirmado. Mismo criterio que la frontera de títulos del
 * scope.
 *
 * ## Uso
 *
 *   npm run audit:vinculo-vecino                    # todas las leyes reales, ordenado por exposición
 *   npm run audit:vinculo-vecino -- --ley "CE"      # una ley concreta
 *   npm run audit:vinculo-vecino -- --min-servidas 50
 *   npm run audit:vinculo-vecino -- --json > /tmp/cola.json
 *
 * ## Qué hacer con lo que saca (NO es una lista de arreglos)
 *
 * Cada línea es una SOSPECHA. Para cada una: abrir el artículo vinculado y el sugerido en el BOE, ver
 * cuál responde LITERALMENTE la opción correcta, y solo entonces re-vincular. Ojo con las preguntas
 * que abarcan varios artículos a la vez («¿en qué sección de la Constitución se reconoce…?»): ahí el
 * vínculo actual suele ser tan defendible como el sugerido. NUNCA re-vincular por el número.
 *
 * Origen: impugnación de un usuario el 29/07/2026 («estaría bien considerada en el artículo 37, no en
 * este que es el 36»). Tenía razón, y la cazó él.
 */
const fs = require('fs');
const path = require('path');
const { clasificarVinculo, words } = require('../lib/health/vinculoArticuloVecino.cjs');

function getUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
  return env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
}
const sql = require(path.join(__dirname, '..', 'backend', 'node_modules', 'postgres'))(getUrl(), {
  ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 60,
});

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const LEY = arg('--ley');
const MIN = Number(arg('--min-servidas') || 0);
const JSON_OUT = argv.includes('--json');

(async () => {
  const leyes = await sql`
    SELECT l.id, l.short_name, count(*)::int n
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE q.is_active = true AND l.boe_url IS NOT NULL
       ${LEY ? sql`AND l.short_name = ${LEY}` : sql``}
     GROUP BY 1, 2 HAVING count(*) >= 20
     ORDER BY n DESC`;

  if (!leyes.length) { console.error(LEY ? `Sin preguntas para la ley "${LEY}".` : 'Sin leyes que examinar.'); process.exit(2); }
  if (!JSON_OUT) console.error(`examinando ${leyes.length} ley(es) reales…`);

  const hits = [];
  for (const L of leyes) {
    // Se cargan los artículos de la ley UNA vez y se pre-calculan sus bolsas de palabras: sin esto,
    // cada pregunta re-tokeniza sus 7 vecinos y el barrido entero se va de memoria (pasó el 29/07).
    const arts = await sql`
      SELECT article_number, left(content, 5000) AS c
        FROM articles WHERE law_id = ${L.id} AND is_active AND content IS NOT NULL`;
    const mapa = new Map();
    for (const a of arts) mapa.set(String(a.article_number), words(a.c));

    const qs = await sql`
      SELECT q.id, q.question_text, q.correct_option, q.option_a, q.option_b, q.option_c, q.option_d,
             q.is_official_exam, a.article_number AS art,
             (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id)::int AS servidas
        FROM questions q JOIN articles a ON a.id = q.primary_article_id
       WHERE q.is_active = true AND a.law_id = ${L.id}`;

    for (const q of qs) {
      const correctText = [q.option_a, q.option_b, q.option_c, q.option_d][q.correct_option];
      if (!correctText) continue;
      const v = clasificarVinculo({
        questionText: q.question_text, correctText, articleNumber: q.art, articulosDeLaLey: mapa,
      });
      if (!v.sospechoso) continue;
      if (q.servidas < MIN) continue;
      hits.push({
        id: q.id, ley: L.short_name, art: String(q.art), sugerido: v.sugerido,
        recallPropio: Math.round(v.recallPropio * 100), recallSugerido: Math.round(v.recallSugerido * 100),
        servidas: q.servidas, oficial: q.is_official_exam,
        enunciado: String(q.question_text).replace(/\s+/g, ' ').slice(0, 110),
      });
    }
    if (!JSON_OUT) process.stderr.write('.');
  }

  hits.sort((a, b) => b.servidas - a.servidas);
  if (JSON_OUT) { console.log(JSON.stringify(hits, null, 1)); await sql.end(); return; }

  console.log(`\n\n🔎 ${hits.length} sospecha(s) · ${hits.reduce((a, b) => a + b.servidas, 0)} exposiciones · ${hits.filter((h) => h.oficial).length} de examen oficial\n`);
  for (const h of hits.slice(0, 40)) {
    console.log(`  ${String(h.servidas).padStart(4)} × ${h.id.slice(0, 8)} ${h.ley} · art ${h.art} (${h.recallPropio}%) → art ${h.sugerido} (${h.recallSugerido}%)`);
    console.log(`         ${h.enunciado}`);
  }
  if (hits.length > 40) console.log(`\n  … y ${hits.length - 40} más (usa --json para la lista entera).`);
  console.log('\n⚠️  SOSPECHAS, no arreglos: verifica cada una contra el BOE antes de re-vincular.');
  console.log('    Precisión medida ≈ 1 de cada 3. Ver lib/health/vinculoArticuloVecino.cjs.\n');
  await sql.end();
})().catch((e) => { console.error(e); process.exit(1); });
