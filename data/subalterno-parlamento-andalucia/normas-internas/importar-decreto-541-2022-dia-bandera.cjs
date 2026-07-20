#!/usr/bin/env node
/**
 * Decreto 541/2022, de 8 de noviembre, por el que se declara oficialmente el 4 de
 * diciembre Día de la Bandera de Andalucía (BOJA núm. 217, de 11/11/2022).
 * Cierra el concepto "Otras fechas relevantes para la Comunidad Autónoma" del
 * epígrafe del T6. Parte dispositiva íntegra (6 apartados) + 3 preguntas draft.
 */
'use strict';
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });

const BATCH = 'gen_decreto_541_2022_dia_bandera_2026-07-20';
const SLUG = 'decreto-541-2022-dia-bandera-andalucia';
const ARTS = [
  { n: '1', t: 'Apartado primero', c: 'Declarar oficialmente el 4 de diciembre Día de la Bandera de Andalucía.' },
  { n: '2', t: 'Apartado segundo', c: 'Instar a los órganos administrativos de la Junta de Andalucía a la adecuada conmemoración de esta fecha mediante las actuaciones que correspondan para el izado y homenaje a la Bandera de Andalucía, que se acompañarán con el Himno de Andalucía.' },
  { n: '3', t: 'Apartado tercero', c: 'Promover que el resto de administraciones públicas del ámbito de la Comunidad Autónoma de Andalucía conmemoren esta fecha.' },
  { n: '4', t: 'Apartado cuarto', c: 'Impulsar, en el ámbito de competencias de la Junta de Andalucía, el desarrollo de cuantas iniciativas en todos los órdenes y, en particular, en el educativo, social e institucional, contribuyan a garantizar la máxima difusión de los valores y significados que encarna la Bandera de Andalucía.' },
  { n: '5', t: 'Apartado quinto', c: 'Facultar a la Consejería de la Presidencia, Interior, Diálogo Social y Simplificación Administrativa para llevar a cabo en el ámbito de sus competencias cuantas actuaciones sean precisas para la adecuada conmemoración del Día de la Bandera de Andalucía.' },
  { n: '6', t: 'Apartado sexto', c: 'Publicar el presente decreto en el Boletín Oficial de la Junta de Andalucía.' },
];

const Q = [
  { art: '1', correct: 1,
    q: 'El Decreto 541/2022, de 8 de noviembre, de la Junta de Andalucía, declara oficialmente:',
    a: 'El 28 de febrero como Día de la Bandera de Andalucía, coincidiendo con el Día de Andalucía.',
    b: 'Oficialmente, el 4 de diciembre como Día de la Bandera de Andalucía.',
    c: 'El 4 de diciembre como Día de los Símbolos de la Comunidad Autónoma de Andalucía.',
    d: 'El 21 de diciembre como Día de la Bandera de Andalucía, fecha de la Ley 3/1982.',
    exp: '> "Declarar oficialmente el 4 de diciembre Día de la Bandera de Andalucía." (apartado primero del Decreto 541/2022, de 8 de noviembre)\n\n**Por qué B es correcta:** la fecha declarada es el 4 de diciembre y la denominación oficial es Día de la Bandera de Andalucía.\n\n- **A)** confunde la fecha con el 28 de febrero, que es el Día de Andalucía.\n- **C)** altera la denominación oficial, que se refiere a la Bandera y no al conjunto de los símbolos.\n- **D)** cambia la fecha y la vincula a la Ley 3/1982, que regula el himno y el escudo.' },
  { art: '2', correct: 3,
    q: 'Según el Decreto 541/2022, de la Junta de Andalucía, las actuaciones de izado y homenaje a la Bandera de Andalucía en la conmemoración de esa fecha:',
    a: 'Se acompañarán con la lectura pública del Estatuto de Autonomía para Andalucía.',
    b: 'Se acompañarán con el izado simultáneo de la bandera de España y de la Unión Europea.',
    c: 'Se realizarán exclusivamente en la sede del Parlamento de Andalucía y en las Delegaciones.',
    d: 'Se llevarán a cabo mediante las actuaciones que correspondan y se acompañarán con el Himno de Andalucía.',
    exp: '> "Instar a los órganos administrativos de la Junta de Andalucía a la adecuada conmemoración de esta fecha mediante las actuaciones que correspondan para el izado y homenaje a la Bandera de Andalucía, que se acompañarán con el Himno de Andalucía." (apartado segundo del Decreto 541/2022)\n\n**Por qué D es correcta:** el izado y homenaje se acompañan con el Himno de Andalucía.\n\n- **A)** sustituye el himno por una lectura del Estatuto que el decreto no prevé.\n- **B)** añade el izado de otras banderas, no contemplado en el apartado.\n- **C)** restringe la conmemoración a determinadas sedes, cuando el decreto insta a los órganos administrativos de la Junta en general.' },
  { art: '5', correct: 0,
    q: 'El Decreto 541/2022 faculta para llevar a cabo cuantas actuaciones sean precisas para la adecuada conmemoración del Día de la Bandera de Andalucía a:',
    a: 'La Consejería de la Presidencia, Interior, Diálogo Social y Simplificación Administrativa.',
    b: 'La Consejería de Cultura y Patrimonio Histórico de la Junta de Andalucía.',
    c: 'La Mesa del Parlamento de Andalucía, oída la Junta de Portavoces de la Cámara.',
    d: 'El Consejo de Gobierno de la Junta de Andalucía, a propuesta de su Presidencia.',
    exp: '> "Facultar a la Consejería de la Presidencia, Interior, Diálogo Social y Simplificación Administrativa para llevar a cabo en el ámbito de sus competencias cuantas actuaciones sean precisas para la adecuada conmemoración del Día de la Bandera de Andalucía." (apartado quinto del Decreto 541/2022)\n\n**Por qué A es correcta:** la facultada es la Consejería de la Presidencia, Interior, Diálogo Social y Simplificación Administrativa.\n\n- **B)** atribuye la facultad a una Consejería distinta.\n- **C)** la traslada a un órgano del Parlamento, ajeno a este decreto del Consejo de Gobierno.\n- **D)** la sitúa en el Consejo de Gobierno, cuando el decreto faculta expresamente a una Consejería.' },
];

(async () => {
  const ex = await sql`SELECT id FROM laws WHERE slug=${SLUG}`;
  let lawId;
  if (ex.length) { lawId = ex[0].id; console.log('ley ya existía'); }
  else {
    lawId = (await sql`
      INSERT INTO laws (name, short_name, type, slug, is_virtual, is_active)
      VALUES ('Decreto 541/2022, de 8 de noviembre, por el que se declara oficialmente el 4 de diciembre Día de la Bandera de Andalucía',
              'Decreto 541/2022 Día de la Bandera de Andalucía', 'regulation', ${SLUG}, false, true) RETURNING id`)[0].id;
  }
  console.log('law_id:', lawId);
  const artId = {};
  for (const a of ARTS) {
    const e = await sql`SELECT id FROM articles WHERE law_id=${lawId} AND article_number=${a.n}`;
    if (e.length) { artId[a.n] = e[0].id; continue; }
    artId[a.n] = (await sql`INSERT INTO articles (law_id, article_number, title, content, is_active) VALUES (${lawId},${a.n},${a.t},${a.c},true) RETURNING id`)[0].id;
  }
  console.log('apartados importados:', Object.keys(artId).length);
  const summary = { deliberate_subset: true, is_ok: true, db_count: 6, source: 'BOJA núm. 217, de 11/11/2022', note: 'Parte dispositiva integra del decreto (6 apartados). No se importan preambulo ni exposicion de motivos.', verified_at: '2026-07-20T00:00:00.000Z' };
  await sql`UPDATE laws SET boe_url='https://www.juntadeandalucia.es/boja/2022/217/1', last_verification_summary=${sql.json(summary)} WHERE id=${lawId}`;
  const t6 = (await sql`SELECT id FROM topics WHERE position_type='subalterno_parlamento_andalucia' AND topic_number=6`)[0].id;
  await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES (${t6}, ${lawId}, NULL) ON CONFLICT DO NOTHING`;
  console.log('scope T6 enlazado');
  // guardrail: la cita del blockquote debe estar literal en el articulo
  for (const item of Q) {
    const cita = item.exp.match(/^> "([^"]+)"/)[1];
    const cont = ARTS.find(a => a.n === item.art).c;
    if (!cont.includes(cita)) { console.error('❌ cita no literal en art', item.art); process.exit(1); }
  }
  const dist = [0, 0, 0, 0];
  for (const item of Q) {
    dist[item.correct]++;
    await sql`INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty, lifecycle_state, topic_review_status, deactivation_reason, tags)
      VALUES (${item.q},${item.a},${item.b},${item.c},${item.d},${item.correct},${item.exp},${artId[item.art]},'medium','draft','pending','Pendiente de revisión post-generación IA',${['ia_generada', BATCH]})`;
  }
  console.log('preguntas draft:', Q.length, '· posiciones A/B/C/D:', dist.join(','), '· citas literales verificadas 3/3');
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
