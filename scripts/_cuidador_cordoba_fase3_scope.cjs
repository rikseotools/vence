// FASE 3 — topic_scope Cuidador/a Diputación Córdoba (temas con banco reutilizable).
// Mapea cada tema a leyes/artículos existentes según su epígrafe. Idempotente.
// Los temas editoriales (5,9,11,12,14,15) NO se escopan aquí (van en fase de generación).
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });
const PT = 'cuidador_diputacion_cordoba';

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

// law_id (prefijo) → uuid completo se resuelve en runtime
const LAWPREF = {
  CE: '6ad91a6c', LPRL: '8b1ae300', L39: '02a0a8db', EAND: '5238bdc9',
  HIGIENE: '18cbfae7', ULCERAS: 'e840d65f', PROCESO: 'cd19b6f4',
  COMUNIC: 'be947ea8', ESTERIL: 'b239fadb', URGENCIAS: 'c2bdfd5b', RD486: '04fa5f20',
  LO3: '6e59eacd', L12: '1c53e192'
};

// tema → [{ lawKey|lawShort, arts }] (arts NULL = ley entera)
const PLAN = {
  1: [{ law: 'CE', arts: [...range(0, 65), '116'] }],                 // estructura+derechos+garantías+suspensión+Corona
  2: [{ law: 'CE', arts: range(66, 127) }],                            // Cortes+Gobierno+relaciones+PJ+leyes
  3: [{ law: 'CE', arts: range(137, 158) }, { law: 'EAND', arts: range(0, 14) }], // territorial + Estatuto Andalucía (disp. generales)
  4: [{ law: 'LO3', arts: null }, { law: 'L12', arts: null }], // igualdad estatal + andaluza
  6: [{ law: 'HIGIENE', arts: null }],                                 // higiene del dependiente
  7: [{ law: 'ULCERAS', arts: null }, { law: 'PROCESO', arts: null }], // eliminación/piel/muestras/constantes
  8: [{ law: 'COMUNIC', arts: null }],                                 // comunicación
  13: [{ law: 'ESTERIL', arts: null }, { law: 'HIGIENE', arts: null }],// infecciones/aislamiento
  16: [{ law: 'URGENCIAS', arts: null }],                              // primeros auxilios
  18: [{ law: 'L39', arts: null }],                                    // recursos dependencia
  19: [{ law: 'RD486', arts: null }, { law: 'LPRL', arts: ['1','2','3','4','14','15','16','17'] }], // lugares de trabajo + cargas/emergencias
  20: [{ law: 'LPRL', arts: ['0','1','2','3','4','14','15','16','17','18','19','20','21','22','23','24','25'] }] // LPRL objeto/principios/plan/formación/vigilancia
};

(async () => {
  // resolver law uuids
  const lawIds = {};
  for (const [k, pref] of Object.entries(LAWPREF)) {
    const r = await sql`SELECT id FROM laws WHERE id::text LIKE ${pref + '%'} LIMIT 1`;
    if (!r[0]) throw new Error('law no encontrada: ' + k + ' (' + pref + ')');
    lawIds[k] = r[0].id;
  }
  // Ley 12/2007 Andalucía por short_name
  const l12 = await sql`SELECT id FROM laws WHERE short_name='Ley 12/2007 Igualdad de Género' LIMIT 1`;
  const shortIds = { 'Ley 12/2007 Igualdad de Género': l12[0] && l12[0].id };

  const summary = [];
  for (const [temaN, entries] of Object.entries(PLAN)) {
    const tp = await sql`SELECT id FROM topics WHERE position_type=${PT} AND topic_number=${Number(temaN)}`;
    if (!tp[0]) throw new Error('topic no encontrado: ' + temaN);
    const topicId = tp[0].id;
    await sql`DELETE FROM topic_scope WHERE topic_id=${topicId}`;
    let total = 0;
    for (const e of entries) {
      const lawId = e.law ? lawIds[e.law] : shortIds[e.short];
      if (!lawId) throw new Error('law sin id para tema ' + temaN + ': ' + (e.law || e.short));
      await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers)
                VALUES (${topicId}, ${lawId}, ${e.arts})`;
      // contar preguntas activas servidas
      const cnt = await sql`
        SELECT count(DISTINCT q.id)::int n
        FROM articles a JOIN questions q ON q.primary_article_id=a.id
        WHERE a.law_id=${lawId} AND q.is_active
          AND (${e.arts}::text[] IS NULL OR a.article_number = ANY(${e.arts}::text[]))`;
      total += cnt[0].n;
    }
    // activar el tema (tiene banco)
    await sql`UPDATE topics SET disponible=true WHERE id=${topicId}`;
    summary.push({ tema: Number(temaN), preguntas: total });
  }
  console.log('=== SCOPE aplicado (disponible=true) ===');
  summary.sort((a, b) => a.tema - b.tema).forEach(s => console.log('  T' + s.tema, '→', s.preguntas, 'preguntas activas'));
  console.log('TOTAL servido:', summary.reduce((a, s) => a + s.preguntas, 0));
  console.log('Editoriales pendientes de generación (disponible=false): T5, T9, T10, T11, T12, T14, T15, T17');
  await sql.end();
})().catch(e => { console.error('❌', e.message); process.exit(1); });
