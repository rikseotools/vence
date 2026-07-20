/**
 * Importa el Decreto 77/2002, de 26 de febrero, por el que se regula el régimen de
 * precedencias y tratamientos en el ámbito de la Junta de Andalucía.
 *
 * FUENTE OFICIAL (verbatim): BOJA núm. 25, de 27/02/2002, págs. 3.251-3.253
 *   https://www.juntadeandalucia.es/boja/2002/25/d1.pdf   (PDF oficial, pdftotext -layout)
 *   HTML: https://www.juntadeandalucia.es/boja/2002/25/1
 *
 * SUBCONJUNTO DELIBERADO:
 *  - IMPORTADOS: arts. 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13 (artículos de CONCEPTO:
 *    reglas, definiciones y tratamientos).
 *  - EXCLUIDOS: arts. 7 y 8 (enumeraciones concretas de autoridades, consejerías,
 *    instituciones y corporaciones en orden de precedencia). Dependen de la estructura
 *    de gobierno vigente, reorganizada por el Decreto del Presidente 9/2026, de 9 de julio.
 *
 * ART. 13: se importa la redacción ORIGINAL de 2002, que es la VIGENTE.
 *   Verificado: la Ley 5/2010, de 11 de junio, de Autonomía Local de Andalucía NO modifica
 *   este Decreto. Su disposición final segunda modifica el art. 13 de la Ley 6/2003, de 9
 *   de octubre, de símbolos, tratamientos y registro de las Entidades Locales de Andalucía
 *   (norma DISTINTA, y sobre materia distinta: "Información de existencia de símbolos
 *   idénticos o que induzcan a error o confusión"). El texto consolidado de la Ley 5/2010
 *   (BOE-A-2010-11491) no contiene ninguna mención a "77/2002".
 */
require('dotenv').config({ path: '.env.local' });
const sql = require('postgres')(process.env.DATABASE_URL, { prepare: false, max: 1, ssl: { rejectUnauthorized: false } });

const LAW = {
  name: 'Decreto 77/2002, de 26 de febrero, por el que se regula el régimen de precedencias y tratamientos en el ámbito de la Junta de Andalucía',
  short_name: 'Decreto 77/2002 Precedencias y Tratamientos JA',
  slug: 'decreto-77-2002-precedencias-tratamientos-ja',
  type: 'regulation',
  scope: 'regional',
  year: 2002,
  boe_url: 'https://www.juntadeandalucia.es/boja/2002/25/d1.pdf',
};

// Texto VERBATIM del BOJA núm. 25 de 27/02/2002 (PDF oficial d1.pdf).
const ARTICLES = [
  {
    n: '1',
    title: 'Objeto',
    content: 'Por el presente Decreto se regula, con carácter general y en el ámbito de la Comunidad Autónoma de Andalucía, los actos oficiales organizados por la Junta de Andalucía, sus Instituciones y Organismos y las Corporaciones Locales, determinándose la clasificación de los actos oficiales, la presidencia de los mismos, el orden de prelación de las Autoridades y Corporaciones asistentes y sus tratamientos.',
  },
  {
    n: '2',
    title: 'Principios generales',
    content: `1. Los principios generales que rigen las precedencias y ordenación de Autoridades y Corporaciones son los siguientes:

a) La presidencia de los actos será unipersonal.

b) La persona que represente en su cargo a una autoridad superior a la de su propio rango no gozará de la precedencia reconocida a la autoridad que representa y ocupará el lugar que le corresponda por su propio rango, salvo que ostente expresamente la representación del Presidente de la Junta de Andalucía o la del Presidente del Parlamento Andaluz.

c) La precedencia de Corporaciones y Organismos e Instituciones en cuanto concurran como tales tiene carácter colectivo y no se extiende a sus miembros en particular.

d) Debe ser norma general de conducta que la precedencia no confiere por sí honor de jerarquía, sino que significa mera ordenación.

2. En el régimen de precedencias se establecen dos rangos de ordenación:

a) El personal, que regula el orden singular de autoridades y titulares de cargos públicos.

b) El colegiado, que regula la prelación entre las Instituciones, Organismos y Corporaciones cuando asistan como tales a actos oficiales.`,
  },
  {
    n: '3',
    title: 'Clases de actos oficiales',
    content: `A los efectos de este Decreto, los actos oficiales que se celebren en Andalucía se clasificarán en:

a) Actos oficiales de carácter general. Son los que con motivo de la celebración de festividades, acontecimientos y conmemoraciones sean organizados por las autoridades competentes.

b) Actos oficiales de carácter especial. Son los organizados por determinadas Instituciones y Organismos, con ocasión de conmemoraciones o acontecimientos propios del ámbito específico de sus respectivos servicios, funciones y actividades.`,
  },
  {
    n: '4',
    title: 'Presidencia',
    content: `La presidencia de los actos oficiales, cualquiera que sea el lugar donde se celebren, corresponderá a la Autoridad que los organice, salvo que asista al acto otra Autoridad a la que se encuentre subordinada jerárquicamente, en cuyo caso esta última asumirá la presidencia.

En caso de que la Autoridad que organice el acto no ostentase la presidencia, ocupará lugar inmediato a la misma. La distribución de los puestos de las demás Autoridades se hará según las precedencias que regula el presente Decreto, alternándose de derecha a izquierda del lugar ocupado por la presidencia.`,
  },
  {
    n: '5',
    title: 'Prelación en actos oficiales de carácter especial',
    content: 'La prelación de Autoridades, Instituciones y Corporaciones en los actos oficiales de carácter especial será dispuesta por la Autoridad que los organice, de acuerdo con el carácter especial de su naturaleza.',
  },
  {
    n: '6',
    title: 'Ordenación de los miembros del Consejo de Gobierno de la Junta de Andalucía',
    content: 'La ordenación de los miembros del Consejo de Gobierno de la Junta de Andalucía será la que establezca el orden de prelación de las Consejerías vigente en cada momento.',
  },
  {
    n: '9',
    title: 'Ex-Presidentes de la Junta de Andalucía y del Parlamento Andaluz',
    content: `1. Cuando a los actos oficiales asistan ex-Presidentes de la Junta de Andalucía se situarán a continuación del último miembro del Consejo de Gobierno ordenándose de acuerdo con la fecha de su cese comenzando por la más antigua.

2. El mismo criterio de ordenación se aplicará a los ex-Presidentes del Parlamento andaluz, que se situarán a continuación del último miembro de la Mesa de la Cámara.`,
  },
  {
    n: '10',
    title: 'Costumbres',
    content: 'Se respetarán las costumbres del lugar cuando en determinados actos oficiales existan puestos reservados según tradición inveterada a favor de determinadas autoridades.',
  },
  {
    n: '11',
    title: 'Concurrencia de Autoridades y Corporaciones',
    content: 'Cuando sean convocados conjuntamente Autoridades y Corporaciones a los actos oficiales de carácter general tendrán precedencia las autoridades según el orden establecido en el artículo 7, situándose las Corporaciones a continuación de la última de aquéllas y por el orden establecido en el artículo 8.',
  },
  {
    n: '12',
    title: 'Otros criterios de ordenación',
    content: `1. Cualquier Autoridad o Corporación de la Comunidad Autónoma Andaluza no comprendida en los artículos 7 y 8 que asista a un acto oficial de carácter general será ordenada por la autoridad que organice el acto situándola en el lugar que estime procedente. Se atenderá en las Corporaciones para su ordenación la antigüedad de su creación o fundación.

2. En los actos que organice la Junta de Andalucía, los Hijos Predilectos de Andalucía, los titulares de la Medalla de Andalucía y los titulares de la Medalla del Parlamento que asistan a los mismos serán ordenados por la autoridad que organice el acto, situándolos en el lugar preferente que estime procedente.`,
  },
  {
    n: '13',
    title: 'Tratamientos',
    content: `El tratamiento del Presidente de la Junta de Andalucía, del Presidente del Parlamento Andaluz y de los miembros del Consejo de Gobierno es de «Excelentísimos Señores».

Los de los ex-Presidentes de la Junta de Andalucía y del Parlamento de Andalucía, el del Presidente del Consejo Consultivo de Andalucía, el del Defensor del Pueblo Andaluz, el del Consejero Mayor de la Cámara de Cuentas de Andalucía y el de los Hijos Predilectos de Andalucía es de «Excelentísimos Señores».

El de los Diputados del Parlamento Andaluz de «Ilustrísimos Señores».

El de los Presidentes de Diputación Provincial y Alcaldes de capitales de provincia es de «Ilustrísimos Señores». El del resto de los Alcaldes, el de Señoría. Se respetan, no obstante, los tratamientos que respondan a tradiciones reconocidas por disposiciones legales.

El tratamiento de los Rectores de Universidad será el de «Excelentísimo Señor, Rector Magnífico».

El de los Viceconsejeros, Secretarios Generales Técnicos, Directores Generales y asimilados de la Junta de Andalucía «Ilustrísimos Señores».

El de los Delegados Provinciales de las Consejerías de la Junta de Andalucía de «Ilustrísimos Señores».

El de los titulares de Medallas de Andalucía o Medallas del Parlamento de Andalucía «Ilustrísimos Señores».

El tratamiento de las Corporaciones Locales será el tradicional.`,
  },
];

const VERIFICATION_SUMMARY = {
  deliberate_subset: true,
  is_ok: true,
  source: 'BOJA núm. 25, de 27/02/2002',
  source_url: 'https://www.juntadeandalucia.es/boja/2002/25/d1.pdf',
  note: 'Importados los artículos de concepto (reglas y definiciones) y el art. 13 (Tratamientos) en su redacción vigente, que es la ORIGINAL de 2002: se ha verificado contra el texto consolidado de la Ley 5/2010, de 11 de junio, de Autonomía Local de Andalucía (BOE-A-2010-11491) que ésta NO modifica el Decreto 77/2002 (cero menciones a "77/2002"); su disposición final segunda modifica el art. 13 de la Ley 6/2003, de 9 de octubre, de símbolos, tratamientos y registro de las Entidades Locales de Andalucía, norma y materia distintas. EXCLUIDOS deliberadamente los arts. 7 y 8 (enumeraciones de autoridades/organismos en orden de precedencia), por depender de la estructura de gobierno vigente, reorganizada por el Decreto del Presidente 9/2026.',
  verified_at: '2026-07-20T00:00:00.000Z',
};

(async () => {
  // 1. Ley (sin ON CONFLICT: no hay constraint único en slug)
  const existing = await sql`SELECT id FROM laws WHERE slug = ${LAW.slug}`;
  let lawId;
  if (existing.length) {
    lawId = existing[0].id;
    console.log('Ley ya existía:', lawId);
  } else {
    const ins = await sql`
      INSERT INTO laws (name, short_name, slug, type, scope, year, is_virtual, is_active, boe_url, last_verification_summary)
      VALUES (${LAW.name}, ${LAW.short_name}, ${LAW.slug}, ${LAW.type}, ${LAW.scope}, ${LAW.year},
              false, true, ${LAW.boe_url}, ${sql.json(VERIFICATION_SUMMARY)})
      RETURNING id`;
    lawId = ins[0].id;
    console.log('Ley creada:', lawId);
  }

  // 2. Artículos verbatim
  const artIds = {};
  for (const a of ARTICLES) {
    const ex = await sql`SELECT id FROM articles WHERE law_id = ${lawId} AND article_number = ${a.n}`;
    if (ex.length) {
      artIds[a.n] = ex[0].id;
      console.log(`  art ${a.n}: ya existía`);
      continue;
    }
    const r = await sql`
      INSERT INTO articles (law_id, article_number, title, content, is_active, is_verified, verification_date)
      VALUES (${lawId}, ${a.n}, ${a.title}, ${a.content}, true, true, CURRENT_DATE)
      RETURNING id`;
    artIds[a.n] = r[0].id;
    console.log(`  art ${a.n}: insertado (${a.content.length} chars)`);
  }

  // 3. Fuente + subconjunto deliberado (NO tocar verification_status: tiene check constraint)
  await sql`UPDATE laws SET boe_url = ${LAW.boe_url}, last_verification_summary = ${sql.json(VERIFICATION_SUMMARY)}, updated_at = now() WHERE id = ${lawId}`;
  console.log('Fuente + subconjunto deliberado registrados.');

  // 4. topic_scope → tema 6
  const t6 = (await sql`SELECT id FROM topics WHERE position_type = 'subalterno_parlamento_andalucia' AND topic_number = 6`)[0].id;
  await sql`INSERT INTO topic_scope (topic_id, law_id, article_numbers) VALUES (${t6}, ${lawId}, NULL) ON CONFLICT DO NOTHING`;
  console.log('topic_scope → tema 6:', t6);

  console.log('\nLAW_ID=' + lawId);
  console.log('ART_IDS=' + JSON.stringify(artIds));
  await sql.end();
})().catch(e => { console.error(e); process.exit(1); });
