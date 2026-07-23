// AUDITORÍA post-go-live — correcciones de scope (mis-fit + cross-tema dup).
// T6: Higiene de CENTROS (ambiental) → Higiene del PACIENTE (personal). Resuelve dup con T13.
// T7: quita "Proceso de atención de enfermería" (NANDA/PAE, off-nivel) → Eliminación+Constantes+Muestras (+Úlceras=piel).
// T19: quita LPRL grales 1-4/14-17 (solapan con T20) → LPRL 20 (emergencias) + RD 487/1997 + Guía INSST cargas (+RD 486/1997).
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });
const PT = 'cuidador_diputacion_cordoba';

// tema → [{pref, arts|null}]
const FIX = {
  6:  [{ p: 'c50356ee', a: null }],                                   // Higiene del paciente
  7:  [{ p: 'e840d65f', a: null }, { p: 'bf443efe', a: null }, { p: '15370683', a: null }, { p: '9712d340', a: null }], // Úlceras+Eliminación+Constantes+Muestras
  19: [{ p: '04fa5f20', a: null }, { p: '7c20a555', a: null }, { p: 'b1a1af88', a: null }, { p: '8b1ae300', a: ['20'] }] // RD486 + RD487 + Guía INSST + LPRL 20
};

(async () => {
  const summary = [];
  for (const [tn, entries] of Object.entries(FIX)) {
    const tp = await sql`SELECT id FROM topics WHERE position_type=${PT} AND topic_number=${Number(tn)}`;
    const topicId = tp[0].id;
    await sql`DELETE FROM topic_scope WHERE topic_id=${topicId}`;
    let total = 0;
    for (const e of entries) {
      const lr = await sql`SELECT id, short_name FROM laws WHERE id::text LIKE ${e.p + '%'} LIMIT 1`;
      if (!lr[0]) throw new Error('law no encontrada: ' + e.p);
      await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES (${topicId}, ${lr[0].id}, ${e.a})`;
      const cnt = await sql`SELECT count(DISTINCT q.id)::int n FROM articles a JOIN questions q ON q.primary_article_id=a.id WHERE a.law_id=${lr[0].id} AND q.is_active AND (${e.a}::text[] IS NULL OR a.article_number=ANY(${e.a}::text[]))`;
      total += cnt[0].n;
    }
    summary.push({ tema: Number(tn), preguntas: total });
  }
  await sql`SELECT public.refresh_topic_question_summary()`;
  summary.sort((a, b) => a.tema - b.tema).forEach(s => console.log('  T' + s.tema, '→', s.preguntas, 'preguntas (corregido)'));
  console.log('MV refrescada.');
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
