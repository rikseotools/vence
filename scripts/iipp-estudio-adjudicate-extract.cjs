// Extrae la pila aparcada (needs_human + needs_review) de estudio IIPP con contexto
// completo (pregunta, opciones, clave marcada, artículo vinculado literal, motivo del
// parking) para la ADJUDICACIÓN Opus (paso 4 del manual v2.1). Blind files de ~20.
const fs = require('fs');
const B = '/home/manuel/Documentos/github/vence/node_modules/';
require(B + 'dotenv').config({ path: '/home/manuel/Documentos/github/vence/.env.local' });
const sql = require(B + 'postgres')(process.env.DATABASE_URL, { ssl: 'require', max: 4 });
const PT = 'ayudante_instituciones_penitenciarias';
const PER = 18;

(async () => {
  const rows = await sql`
    SELECT q.id, q.lifecycle_state, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
           q.correct_option, a.article_number, a.title art_title, a.content art_content,
           l.short_name law, l.is_virtual,
           (SELECT t FROM unnest(q.tags) t WHERE t LIKE 'T%') tema,
           (SELECT notes FROM question_lifecycle_history h WHERE h.question_id=q.id
              ORDER BY h.changed_at DESC LIMIT 1) parked_note
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.tags @> ARRAY[${PT},'opositatest-estudio']::text[]
      AND q.lifecycle_state IN ('needs_human','needs_review')
    ORDER BY q.id`;
  if (!rows.length) { console.log('Pila vacía'); await sql.end(); return; }
  fs.writeFileSync('/tmp/iadj_ledger.json', JSON.stringify(rows, null, 2));
  const blind = rows.map((q, i) => ({
    n: i + 1, id: q.id, tema: q.tema, estado: q.lifecycle_state,
    question_text: q.question_text, option_a: q.option_a, option_b: q.option_b,
    option_c: q.option_c, option_d: q.option_d,
    marked_correct_letter: ['A','B','C','D'][q.correct_option],
    law_short_name: q.law, is_virtual: q.is_virtual, linked_article_number: q.article_number,
    linked_article_title: q.art_title, linked_article_content: q.art_content,
    motivo_parking: q.parked_note,
  }));
  let nf = 0; for (let i = 0; i < blind.length; i += PER) { nf++; fs.writeFileSync(`/tmp/iadj_blind_${nf}.json`, JSON.stringify(blind.slice(i, i + PER), null, 2)); }
  for (let k = nf + 1; k <= 20; k++) { try { fs.unlinkSync(`/tmp/iadj_blind_${k}.json`); } catch (_) {} }
  console.log(`Adjudicación: ${rows.length} aparcadas, ${nf} ficheros (PER=${PER}).`);
  await sql.end();
})().catch(async e => { console.error('ERROR', e.message); try { await sql.end(); } catch (_) {} process.exit(1); });
