#!/usr/bin/env node
// SPLIT "Movilizacion y posiciones" — FASE 2: repartir las 507 preguntas del antiguo art.1
// entre los 4 bloques creados en la fase 1.
//
// GUARDARRAIL PRINCIPAL: se cuenta, POR TEMA, cuantas preguntas de esta ley se sirven ANTES y
// DESPUES. Si algun tema pierde una sola pregunta, se aborta y se revierte: el split no puede
// tener regresion de contenido (mismo criterio que el split de Instituciones Internacionales GC).
//
// No se toca ninguna clave. Las clasificadas como OTRO se quedan en el art.1 (no se fuerzan).
const fs = require('fs'), path = require('path');
const pg = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres'));
const url = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql = pg(url, { ssl: { rejectUnauthorized: false }, max: 2 });
const DRY = !process.argv.includes('--apply');
const LEY = 'Movilizacion y posiciones';

// Cuenta, por tema, las preguntas activas de esta ley que el tema sirve segun su topic_scope.
// article_numbers NULL = ley entera.
async function porTema(s) {
  const r = await s`
    SELECT ts.topic_id, count(DISTINCT q.id)::int n
    FROM topic_scope ts
    JOIN laws l ON l.id = ts.law_id
    JOIN articles a ON a.law_id = l.id
      AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
    JOIN questions q ON q.primary_article_id = a.id AND q.is_active
    WHERE l.short_name = ${LEY}
    GROUP BY 1`;
  return Object.fromEntries(r.map(x => [x.topic_id, x.n]));
}

(async () => {
  const clas = JSON.parse(fs.readFileSync(path.join(__dirname, 'clasificacion-final.json'), 'utf8'));
  const mueven = clas.filter(c => ['1.2', '1.3', '1.4'].includes(c.bloque));
  const quedan = clas.filter(c => ['1', 'OTRO'].includes(c.bloque));
  console.log(`clasificadas: ${clas.length} | se mueven: ${mueven.length} | se quedan en art.1: ${quedan.length}`);

  const destinos = Object.fromEntries((await sql`SELECT a.article_number n, a.id FROM articles a
    JOIN laws l ON l.id = a.law_id WHERE l.short_name = ${LEY} AND a.article_number IN ('1.2','1.3','1.4')`)
    .map(r => [r.n, r.id]));
  if (Object.keys(destinos).length !== 3) throw new Error('faltan articulos destino — corre la fase 1 primero');

  const antes = await porTema(sql);
  const totalAntes = Object.values(antes).reduce((a, b) => a + b, 0);
  console.log(`\ntemas que sirven esta ley: ${Object.keys(antes).length} | suma de preguntas servidas: ${totalAntes}`);

  if (DRY) {
    const g = {}; for (const m of mueven) g[m.bloque] = (g[m.bloque] || 0) + 1;
    console.log('\n— DRY RUN (usa --apply) —'); console.table(g);
    await sql.end(); return;
  }

  // Snapshot para revertir
  const snap = await sql`SELECT id, primary_article_id FROM questions WHERE id = ANY(${mueven.map(m => m.id)})`;
  fs.writeFileSync(path.join(__dirname, 'backup-split-fase2.json'), JSON.stringify(snap, null, 1));

  let n = 0;
  for (const m of mueven) {
    await sql`UPDATE questions SET primary_article_id = ${destinos[m.bloque]}, updated_at = now() WHERE id = ${m.id}`;
    n++;
  }
  console.log(`\n${n} preguntas re-vinculadas`);

  // ---- GUARDARRAIL: ningun tema puede perder preguntas ----
  const despues = await porTema(sql);
  const perdidas = [];
  for (const [topic, v] of Object.entries(antes)) {
    const d = despues[topic] || 0;
    if (d < v) perdidas.push({ topic, antes: v, despues: d, delta: d - v });
  }
  const totalDespues = Object.values(despues).reduce((a, b) => a + b, 0);
  console.log(`suma servida ANTES: ${totalAntes} | DESPUES: ${totalDespues}`);
  if (perdidas.length) {
    console.error(`\n❌ REGRESION: ${perdidas.length} temas pierden preguntas. REVIRTIENDO…`);
    console.table(perdidas.slice(0, 10));
    for (const s of snap) await sql`UPDATE questions SET primary_article_id = ${s.primary_article_id} WHERE id = ${s.id}`;
    console.error('revertido. No se ha dejado nada a medias.');
    process.exit(1);
  }
  console.log('✅ ningun tema pierde preguntas — split sin regresion');

  const chk = await sql`SELECT a.article_number n, left(a.title,48) titulo,
      count(q.id) FILTER (WHERE q.is_active)::int preguntas
    FROM articles a JOIN laws l ON l.id = a.law_id LEFT JOIN questions q ON q.primary_article_id = a.id
    WHERE l.short_name = ${LEY} GROUP BY 1,2 ORDER BY a.article_number::text`;
  console.table(chk);
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
