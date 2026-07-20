#!/usr/bin/env node
/**
 * Importa la Ley 3/1982, de 21 de diciembre, sobre el himno y el escudo de Andalucía
 * (BOE-A-1983-4469, texto consolidado) — arts 1,4,7,8,9 verbatim. Añade scope a T6.
 * Genera 6 preguntas draft (símbolos de Andalucía).
 */
'use strict';
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });

const ARTS = [
  { n: '1', c: 'Andalucía tiene escudo propio, que se describe teniendo en cuenta los acuerdos de la Asamblea de Ronda de 1918, como el compuesto por la figura de un Hércules prominente entre dos columnas, expresión de la fuerza eternamente joven del espíritu, sujetando y domando a dos leones que representan la fuerza de los instintos animales, con una inscripción a los pies de una leyenda que dice: «Andalucía por sí, para España y la Humanidad», sobre el fondo de una bandera andaluza. Cierra las dos columnas un arco de medio punto con las palabras latinas «Dominator Hércules Fundator», también sobre el fondo de la bandera andaluza.' },
  { n: '4', c: 'Queda prohibida la utilización del escudo de Andalucía en cualquier símbolo o siglas de partidos políticos, sindicatos, asociaciones empresariales o cualesquiera entidades privadas, así como su uso como distintivo de producto o mercancía alguna.' },
  { n: '7', c: 'El himno de Andalucía habrá de ser interpretado en todos los actos oficiales organizados por la Junta de Andalucía, Corporaciones Provinciales en ella integradas y municipios de su territorio.' },
  { n: '8', c: 'Queda prohibida la utilización del himno de Andalucía en acto, forma, versión o con finalidad que menoscaben su alta significación de insignia de Andalucía.' },
  { n: '9', c: 'El himno y el escudo de Andalucía serán protegidos penalmente en idénticos términos a los que se acuerden por las leyes estatales para los símbolos del Estado.' },
];

const BATCH = 'gen_ley_3_1982_simbolos_2026-07-20';

(async () => {
  // 1) crear ley (guard idempotente por existencia)
  const existing = await sql`SELECT id FROM laws WHERE slug='ley-himno-escudo-andalucia'`;
  let lawId;
  if (existing.length) { lawId = existing[0].id; console.log('Ley ya existía, reuso'); }
  else {
    lawId = (await sql`
      INSERT INTO laws (name, short_name, type, slug, is_virtual, is_active)
      VALUES ('Ley 3/1982, de 21 de diciembre, sobre el himno y el escudo de Andalucía',
              'Ley 3/1982 Himno y Escudo de Andalucía', 'law', 'ley-himno-escudo-andalucia', false, true)
      RETURNING id`)[0].id;
  }
  console.log('Ley 3/1982 id:', lawId);

  // 2) artículos verbatim
  const artId = {};
  for (const a of ARTS) {
    const ex = await sql`SELECT id FROM articles WHERE law_id=${lawId} AND article_number=${a.n}`;
    if (ex.length) { artId[a.n] = ex[0].id; continue; }
    const r = await sql`
      INSERT INTO articles (law_id, article_number, title, content, is_active)
      VALUES (${lawId}, ${a.n}, ${'Artículo ' + a.n + '. Ley 3/1982 sobre el himno y el escudo de Andalucía'}, ${a.c}, true)
      RETURNING id`;
    artId[a.n] = r[0].id;
  }
  console.log('Artículos insertados:', Object.keys(artId).join(','));

  // 3) scope T6
  const t6 = (await sql`SELECT id FROM topics WHERE position_type='subalterno_parlamento_andalucia' AND topic_number=6`)[0].id;
  await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES (${t6}, ${lawId}, ${['1', '4', '7', '8', '9']}) ON CONFLICT DO NOTHING`;
  console.log('Scope T6 añadido');

  // 4) preguntas (draft). posición uniforme: A,C,B,D,C,A → 2A,1B,2C,1D (6q)
  const Q = [
    { art: '1', correct: 0,
      q: 'Según la Ley 3/1982, de 21 de diciembre, sobre el himno y el escudo de Andalucía, ¿qué leyenda figura a los pies del escudo de Andalucía?',
      a: '«Andalucía por sí, para España y la Humanidad».',
      b: '«Andalucía por sí, para España y para Europa».',
      c: '«Andalucía para sí, por España y la Humanidad».',
      d: '«Dominator Hércules Fundator».',
      exp: '> "...con una inscripción a los pies de una leyenda que dice: «Andalucía por sí, para España y la Humanidad»..." (art. 1 de la Ley 3/1982 sobre el himno y el escudo de Andalucía)\n\n**Por qué A es correcta:** reproduce literalmente la leyenda a los pies del escudo.\n\n- **B)** cambia «la Humanidad» por «Europa».\n- **C)** altera las preposiciones («para sí, por España»).\n- **D)** es la leyenda latina del arco de medio punto, no la de los pies.' },
    { art: '1', correct: 2,
      q: 'Conforme a la Ley 3/1982 sobre el himno y el escudo de Andalucía, ¿qué palabras latinas cierran las dos columnas del escudo en un arco de medio punto?',
      a: '«Andalucía por sí, para España y la Humanidad».',
      b: '«Plus Ultra», sobre el fondo de la bandera andaluza.',
      c: '«Dominator Hércules Fundator», sobre el fondo de la bandera andaluza.',
      d: '«Hercules Fundator Dominator», sobre el fondo del escudo de España.',
      exp: '> "Cierra las dos columnas un arco de medio punto con las palabras latinas «Dominator Hércules Fundator», también sobre el fondo de la bandera andaluza." (art. 1 de la Ley 3/1982 sobre el himno y el escudo de Andalucía)\n\n**Por qué C es correcta:** cita literal de las palabras latinas y del fondo (la bandera andaluza).\n\n- **A)** es la leyenda de los pies, no la del arco.\n- **B)** «Plus Ultra» pertenece al escudo de España.\n- **D)** altera el orden de las palabras y el fondo.' },
    { art: '4', correct: 1,
      q: 'La Ley 3/1982 sobre el himno y el escudo de Andalucía prohíbe la utilización del escudo de Andalucía:',
      a: 'En cualquier símbolo o siglas de entidades privadas, salvo autorización de la Junta de Andalucía.',
      b: 'En cualquier símbolo o siglas de partidos políticos, sindicatos, asociaciones empresariales o cualesquiera entidades privadas, así como su uso como distintivo de producto o mercancía.',
      c: 'Únicamente en las siglas de partidos políticos y sindicatos con representación parlamentaria.',
      d: 'En las publicaciones oficiales y los sellos de las corporaciones locales de su territorio.',
      exp: '> "Queda prohibida la utilización del escudo de Andalucía en cualquier símbolo o siglas de partidos políticos, sindicatos, asociaciones empresariales o cualesquiera entidades privadas, así como su uso como distintivo de producto o mercancía alguna." (art. 4 de la Ley 3/1982 sobre el himno y el escudo de Andalucía)\n\n**Por qué B es correcta:** enumera todos los supuestos prohibidos tal como el artículo.\n\n- **A)** añade una autorización que la ley no prevé.\n- **C)** restringe la prohibición a partidos y sindicatos con representación.\n- **D)** confunde la prohibición con supuestos de uso oficial del escudo.' },
    { art: '7', correct: 3,
      q: 'Según la Ley 3/1982 sobre el himno y el escudo de Andalucía, ¿en qué actos habrá de ser interpretado el himno de Andalucía?',
      a: 'En todos los actos organizados por partidos políticos y entidades culturales de Andalucía.',
      b: 'Únicamente en los actos oficiales organizados por la Junta de Andalucía y el Parlamento.',
      c: 'En los actos oficiales del Estado que se celebren en el territorio de Andalucía.',
      d: 'En todos los actos oficiales organizados por la Junta de Andalucía, Corporaciones Provinciales en ella integradas y municipios de su territorio.',
      exp: '> "El himno de Andalucía habrá de ser interpretado en todos los actos oficiales organizados por la Junta de Andalucía, Corporaciones Provinciales en ella integradas y municipios de su territorio." (art. 7 de la Ley 3/1982 sobre el himno y el escudo de Andalucía)\n\n**Por qué D es correcta:** recoge los tres tipos de actos oficiales previstos (Junta, Corporaciones Provinciales y municipios).\n\n- **A)** extiende la obligación a partidos y entidades culturales.\n- **B)** la limita a la Junta y el Parlamento, omitiendo provincias y municipios.\n- **C)** la traslada a los actos del Estado.' },
    { art: '8', correct: 2,
      q: 'De acuerdo con la Ley 3/1982 sobre el himno y el escudo de Andalucía, ¿qué uso del himno de Andalucía queda prohibido?',
      a: 'Su interpretación en actos oficiales sin autorización previa de la Presidencia de la Junta.',
      b: 'Su interpretación en versiones distintas de la armonizada por José Castillo y Díaz.',
      c: 'Su utilización en acto, forma, versión o con finalidad que menoscaben su alta significación de insignia de Andalucía.',
      d: 'Su reproducción parcial en publicaciones que no sean de titularidad de la Junta de Andalucía.',
      exp: '> "Queda prohibida la utilización del himno de Andalucía en acto, forma, versión o con finalidad que menoscaben su alta significación de insignia de Andalucía." (art. 8 de la Ley 3/1982 sobre el himno y el escudo de Andalucía)\n\n**Por qué C es correcta:** cita literal del supuesto prohibido (acto, forma, versión o finalidad que menoscaben su significación).\n\n- **A)** inventa una autorización previa.\n- **B)** restringe la prohibición a versiones distintas de la armonización.\n- **D)** limita la prohibición a reproducciones en publicaciones ajenas.' },
    { art: '9', correct: 0,
      q: 'Conforme a la Ley 3/1982 sobre el himno y el escudo de Andalucía, el himno y el escudo de Andalucía serán protegidos penalmente:',
      a: 'En idénticos términos a los que se acuerden por las leyes estatales para los símbolos del Estado.',
      b: 'En los términos que establezca el Parlamento de Andalucía mediante ley específica.',
      c: 'Con las mismas sanciones previstas para los símbolos de las demás comunidades autónomas.',
      d: 'Solo cuando el uso indebido tenga finalidad comercial o ánimo de lucro acreditado.',
      exp: '> "El himno y el escudo de Andalucía serán protegidos penalmente en idénticos términos a los que se acuerden por las leyes estatales para los símbolos del Estado." (art. 9 de la Ley 3/1982 sobre el himno y el escudo de Andalucía)\n\n**Por qué A es correcta:** la protección penal se remite a los términos de las leyes estatales para los símbolos del Estado.\n\n- **B)** remite a una ley específica del Parlamento andaluz que el artículo no menciona.\n- **C)** compara con los símbolos de otras comunidades autónomas.\n- **D)** condiciona la protección a una finalidad comercial.' },
  ];
  const dist = [0, 0, 0, 0];
  for (const item of Q) {
    dist[item.correct]++;
    await sql`INSERT INTO questions (question_text, option_a, option_b, option_c, option_d, correct_option, explanation, primary_article_id, difficulty, lifecycle_state, topic_review_status, deactivation_reason, tags)
      VALUES (${item.q}, ${item.a}, ${item.b}, ${item.c}, ${item.d}, ${item.correct}, ${item.exp}, ${artId[item.art]}, 'medium', 'draft', 'pending', 'Pendiente de revisión post-generación IA', ${['ia_generada', BATCH]})`;
  }
  console.log('Preguntas draft insertadas:', Q.length, '· distribución A/B/C/D:', dist.join(','));
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
