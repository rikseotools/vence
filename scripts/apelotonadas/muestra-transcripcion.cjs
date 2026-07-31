#!/usr/bin/env node
// muestra-transcripcion.cjs — muestra CIEGA para calibrar el cubo «la explicación es el artículo
// copiado» (T-409, núcleo `lib/health/explicacionTranscripcion.cjs`).
//
// Coge preguntas activas al azar SIN filtrar por la salida del detector y las clasifica, imprimiendo
// también los NEGATIVOS. Eso es lo que lo hace útil: medir un detector sobre las filas que él mismo
// selecciona no dice nada de lo que se le escapa ni de lo que marca de más. Con esta muestra se fijó
// el corte de cobertura en 0,92 y se midió que el 8,2% del banco cae en el cubo.
//
// Uso:  node scripts/apelotonadas/muestra-transcripcion.cjs [ejemplos-por-clase]
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const { clasificaTranscripcion } = require('../../lib/health/explicacionTranscripcion.cjs');
const sql = postgres(process.env.DATABASE_URL, { ssl: { rejectUnauthorized: false }, max: 2 });

(async () => {
  const n = parseInt(process.argv[2] || '4', 10);
  const filas = await sql`
    SELECT q.id, q.question_text, q.explanation, a.content art, a.article_number, l.short_name ley
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
     WHERE q.is_active AND q.explanation IS NOT NULL AND q.explanation_data IS NULL
     ORDER BY md5(q.id::text) LIMIT 600`;
  const por = { literal: [], casi: [], null: [] };
  for (const f of filas) {
    const r = clasificaTranscripcion({ explanation: f.explanation, articleContent: f.art });
    por[r.clase ?? 'null'].push({ ...f, ...r });
  }
  for (const clase of ['literal', 'casi', 'null']) {
    console.log(`\n═══ ${clase.toUpperCase()} — ${por[clase].length}/${filas.length} de la muestra`);
    for (const f of por[clase].slice(0, n)) {
      console.log(`\n· ${f.id.slice(0, 8)} [${f.ley} art ${f.article_number}] cobertura=${f.cobertura === null ? '-' : f.cobertura.toFixed(2)} (${f.motivo})`);
      console.log(`  P: ${f.question_text.slice(0, 110).replace(/\n/g, ' ')}`);
      console.log(`  E: ${f.explanation.slice(0, 240).replace(/\n/g, ' ⏎ ')}`);
    }
  }
  await sql.end();
})();
