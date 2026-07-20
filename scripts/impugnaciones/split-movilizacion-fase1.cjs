#!/usr/bin/env node
// SPLIT del mega-chunk "Movilizacion y posiciones" art.1 (18.023 chars, 507 preguntas activas).
// FASE 1: partir el TEXTO por sus costuras naturales (encabezados ## del propio material) y
// extender el topic_scope. NO se mueve ninguna pregunta todavia (eso es la fase 2).
//
// Por que: 507 preguntas colgando de un solo "articulo" que mezcla 5 materias (posicion anatomica,
// planos/ejes, mecanica corporal, 10 posiciones del paciente, UPP). Con esa granularidad ni la
// pregunta queda bien colocada ni el opositor puede estudiar el punto concreto.
//
// EL TEXTO NO SE REESCRIBE: cada trozo es un corte VERBATIM del original.
//
// Numeracion 1.2 / 1.3 / 1.4: ordena correctamente como texto junto a los arts. 2-7 existentes
// ("1","1.2","1.3","1.4","2",...), cosa que 8/9/10 no haria ("1","10","2",...).
const fs = require('fs'), path = require('path');
const pg = require(path.join(__dirname, '..', '..', 'backend', 'node_modules', 'postgres'));
const url = fs.readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8').match(/^DATABASE_URL=(.*)$/m)[1].trim();
const sql = pg(url, { ssl: { rejectUnauthorized: false }, max: 2 });
const DRY = !process.argv.includes('--apply');
const LEY = 'Movilizacion y posiciones';

// (encabezado donde empieza el bloque, artículo destino, título)
const CORTES = [
  { desde: '## 3. Alineación corporal', hasta: '## 4. Posiciones del paciente', num: '1.2',
    titulo: 'Alineacion corporal, mecanica corporal y ergonomia' },
  { desde: '## 4. Posiciones del paciente', hasta: '## 5. Decúbitos, puntos de presión', num: '1.3',
    titulo: 'Posiciones del paciente' },
  { desde: '## 5. Decúbitos, puntos de presión', hasta: '## 6. Resumen rápido', num: '1.4',
    titulo: 'Decubitos, puntos de presion y ulceras por presion (UPP)' },
];

(async () => {
  const art = (await sql`SELECT a.id, a.law_id, a.content, a.title FROM articles a
    JOIN laws l ON l.id = a.law_id WHERE l.short_name = ${LEY} AND a.article_number = '1'`)[0];
  if (!art) throw new Error('art.1 no encontrado');
  const c = art.content;
  const original = c.length;

  const i3 = c.indexOf(CORTES[0].desde);
  const i4 = c.indexOf(CORTES[1].desde);
  const i5 = c.indexOf(CORTES[2].desde);
  const i6 = c.indexOf('## 6. Resumen rápido');
  if ([i3, i4, i5, i6].some(x => x < 0)) throw new Error('no encuentro alguna costura — ABORTA');

  // La "chuleta" (§6) resume LAS POSICIONES → se queda con el bloque de posiciones (1.3).
  const trozos = {
    '1':   c.slice(0, i3),                       // cabecera + §1 posicion anatomica + §2 planos y ejes
    '1.2': c.slice(i3, i4),                      // §3 mecanica corporal
    '1.3': c.slice(i4, i5) + '\n' + c.slice(i6), // §4 posiciones + §6 chuleta de posiciones
    '1.4': c.slice(i5, i6),                      // §5 UPP
  };

  // INTEGRIDAD: nada de texto perdido ni inventado
  const suma = Object.values(trozos).reduce((s, t) => s + t.length, 0);
  console.log(`art.1 original: ${original} chars | suma de los trozos: ${suma} (+1 por el salto de union)`);
  if (Math.abs(suma - original - 1) > 1) throw new Error('la suma no cuadra — ABORTA, se perderia texto');
  for (const [n, t] of Object.entries(trozos)) console.log(`  ${n.padEnd(4)} ${String(t.length).padStart(6)} chars`);

  if (DRY) {
    console.log('\n— DRY RUN (usa --apply) —');
    for (const [n, t] of Object.entries(trozos)) {
      console.log(`\n=== ${n} ===`);
      console.log(t.slice(0, 180).replace(/\n/g, ' ') + '…');
    }
    await sql.end(); return;
  }

  await sql.begin(async tx => {
    // 1) el art.1 se queda solo con su primer bloque
    await tx`UPDATE articles SET content = ${trozos['1']},
        title = 'Posicion anatomica, planos y ejes' WHERE id = ${art.id}`;
    // 2) los tres bloques nuevos
    for (const co of CORTES)
      await tx`INSERT INTO articles (law_id, article_number, title, content)
               VALUES (${art.law_id}, ${co.num}, ${co.titulo}, ${trozos[co.num]})`;
    // 3) topic_scope: las 26 filas con article_numbers NULL cubren la ley entera y no hay que tocarlas.
    //    Las 2 con lista EXPLICITA ("1".."7") SI: sin esto, las preguntas que se muevan a 1.2/1.3/1.4
    //    en la fase 2 DESAPARECERIAN de esos dos temas.
    const upd = await tx`UPDATE topic_scope ts SET article_numbers = ts.article_numbers || ARRAY['1.2','1.3','1.4']
      FROM laws l WHERE l.id = ts.law_id AND l.short_name = ${LEY}
        AND ts.article_numbers IS NOT NULL AND NOT ('1.3' = ANY(ts.article_numbers))
      RETURNING ts.topic_id`;
    console.log(`\ntopic_scope: ${upd.length} filas con lista explicita ampliadas con 1.2/1.3/1.4`);
  });

  const chk = await sql`SELECT a.article_number n, left(a.title,50) titulo, length(a.content) chars,
      count(q.id) FILTER (WHERE q.is_active)::int preguntas
    FROM articles a JOIN laws l ON l.id = a.law_id LEFT JOIN questions q ON q.primary_article_id = a.id
    WHERE l.short_name = ${LEY} GROUP BY 1,2,3 ORDER BY a.article_number::text`;
  console.table(chk);
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
