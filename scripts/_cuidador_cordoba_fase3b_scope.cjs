// FASE 3b — scope de los temas con banco TCAE reutilizable adicional (T5, T11, T15).
// Verificado por muestreo de contenido real (no solo título).
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });
const PT = 'cuidador_diputacion_cordoba';

const PLAN = {
  5:  ['f36de7ef'],                                     // Comunicacion sanitaria (habilidades/destrezas sociales)
  11: ['15f0eb91'],                                     // Trabajo en equipo sanitario
  15: ['811f6470', '2ded8774', '0dd51a10', '18e6066a']  // Alimentacion y nutricion + Nutrición/Dietoterapia + Higiene y Manip. Alimentos + Reglamento 852/2004
};

(async () => {
  const summary = [];
  for (const [temaN, prefs] of Object.entries(PLAN)) {
    const tp = await sql`SELECT id FROM topics WHERE position_type=${PT} AND topic_number=${Number(temaN)}`;
    if (!tp[0]) throw new Error('topic no encontrado: ' + temaN);
    const topicId = tp[0].id;
    await sql`DELETE FROM topic_scope WHERE topic_id=${topicId}`;
    let total = 0;
    for (const pref of prefs) {
      const lr = await sql`SELECT id FROM laws WHERE id::text LIKE ${pref + '%'} LIMIT 1`;
      if (!lr[0]) throw new Error('law no encontrada: ' + pref);
      const lawId = lr[0].id;
      await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES (${topicId}, ${lawId}, NULL)`;
      const cnt = await sql`SELECT count(DISTINCT q.id)::int n FROM articles a JOIN questions q ON q.primary_article_id=a.id WHERE a.law_id=${lawId} AND q.is_active`;
      total += cnt[0].n;
    }
    await sql`UPDATE topics SET disponible=true WHERE id=${topicId}`;
    summary.push({ tema: Number(temaN), preguntas: total });
  }
  summary.sort((a, b) => a.tema - b.tema).forEach(s => console.log('  T' + s.tema, '→', s.preguntas, 'preguntas'));
  await sql`SELECT public.refresh_topic_question_summary()`;
  console.log('MV refrescada. Pendientes de generación: T9, T10, T12, T14, T17');
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
