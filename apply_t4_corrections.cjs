const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ============================================================
// T4 "El Poder Judicial" - Corrections
// Total: 37 questions reviewed
// - 24 False Positives → mark as perfect
// - 13 Corrections (7 article changes, 6 explanation-only)
// - 0 Deactivations, 0 Answer changes
// ============================================================

const DRY_RUN = process.argv.includes('--dry-run');

// === FALSE POSITIVES (24) ===
const falsePositives = [
  // Batch 1 (13)
  'f6156db6-e423-4637-9b6f-5712d9a482d4',
  'b3996bc4-83a2-48cf-b594-fe7683d1a088',
  '60305c21-e6e2-458b-b669-0d6a0d09afb9',
  '3cd99c99-d756-435c-977b-ec5ac7d69f15',
  'ef957b1d-21ec-4ece-99d5-769faac770be',
  '51a76dcb-ef30-4a23-81bf-b44b0a368d7e',
  '8ee67b87-a49c-441c-a766-52f2c597a212',
  'b6bf6e70-ff39-4abc-9e60-d312d5257aaa',
  'f3e00125-e2a5-4a78-8b3f-f51534d2e506',
  '28f1d981-b8ba-4bf8-8855-c891fa7cfaec',
  'fc4a3d12-4ce5-48f3-9e4b-90355dcd7b8b',
  'cf2d953a-e57a-45e5-a267-00a0db573b9c',
  '6a7e3ee8-a82d-4ebc-ae06-429577d47ecd',
  // Batch 2 (11)
  'eaa63152-f13a-43c2-91b2-6d22f1fdc44f',
  '73dda456-3b5f-4ede-aaa0-584240443ade',
  '5e22f494-a138-4ada-8b97-f6b50e915077',
  '87b6bbdd-79e9-4676-989e-bc0cb8e0579e',
  '668f925e-52fe-4a13-b57e-406de2bc5d81',
  '5f6f1d45-a7da-447d-84c9-927beee6f5de',
  '155a99fc-b452-4ae3-a43c-585ce7ffa44e',
  'f341e488-f099-4045-a36f-477b0f0599cc',
  '14dc3d54-b437-4591-8520-7efb0fb4fa7b',
  '3f9a3fac-3cd5-413f-8bdb-309cd35792e1',
  '04efb88a-b15f-40ed-88bb-7594aa754a22',
];

// === CORRECTIONS (13) ===
const corrections = [
  // --- Article changes to "bis" versions (5) ---
  {
    id: '79f11f9d-1e3d-435b-b951-96ad8e09c5a8',
    newArticleId: 'aaa9c4ff-42b4-4913-8fad-51b848811592', // art 61 bis LOPJ
    explanation: `La respuesta correcta es B).

Según el artículo 61 bis, apartado 5, de la LOPJ: "El Ministerio de Justicia, oída la Sala de Gobierno del Tribunal Supremo y previo informe del Consejo General del Poder Judicial e informe favorable del Ministerio de Hacienda y Administraciones Públicas, determinará la composición y plantilla del Gabinete Técnico."

Por tanto, es el Ministerio competente en materia de Justicia quien determina la composición y plantilla del Gabinete Técnico del Tribunal Supremo, no el CGPJ (A), ni la Sala de Gobierno del TS (C), ni el Presidente del TS (D).`,
  },
  {
    id: '1fd451c1-2dd2-4fbe-8007-3e2016190d10',
    newArticleId: '8745c1c3-012b-459b-83e3-7b258eb5e2da', // art 64 bis LOPJ
    explanation: `La respuesta correcta es A).

Según el artículo 64 bis, apartado 1, de la LOPJ: "La Sala de Apelación de la Audiencia Nacional conocerá de los recursos de esta clase que establezca la ley contra las resoluciones de la Sala de lo Penal."

La Sala de Apelación de la Audiencia Nacional conoce de los recursos contra las resoluciones de la Sala de lo Penal, no de la Sala de lo Social (B), ni de la Sala de lo Contencioso-Administrativo (C), ni de la propia Sala de Apelación (D).`,
  },
  {
    id: 'a2895199-b6e8-43a0-8ffd-d855e407e97a',
    newArticleId: '8745c1c3-012b-459b-83e3-7b258eb5e2da', // art 64 bis LOPJ
    explanation: `La respuesta correcta es C).

Según el artículo 64 bis, apartado 2, de la LOPJ, cuando los magistrados de la Sala de Apelación de la Audiencia Nacional sean adscritos a otra Sala de diferente orden, se valorarán: la antigüedad en el escalafón, la especialidad o experiencia de los magistrados afectados y, a ser posible, sus preferencias. Se especifica que la adscripción se hará "sin que ello signifique incremento retributivo alguno".

Las retribuciones (opción C) NO son un criterio de valoración para la adscripción, sino una restricción (no habrá incremento retributivo). Las demás opciones sí se valoran: antigüedad (B), especialidad o experiencia (A) y preferencias (D).`,
  },
  {
    id: 'd301d70f-c065-40d0-bde1-8cf33f6a10da',
    newArticleId: 'f070045e-cf85-4120-a68e-73e660720fae', // art 89 bis LOPJ
    explanation: `La respuesta correcta es B).

Según el artículo 89 bis, apartado 3, de la LOPJ: "No obstante lo anterior, excepcionalmente, el Gobierno podrá establecer por real decreto, a propuesta del Consejo General del Poder Judicial y, en su caso, con informe de la comunidad autónoma con competencias en materia de Justicia, las Secciones de Violencia contra la Infancia y la Adolescencia que extiendan su jurisdicción a dos o más partidos dentro de la misma provincia."

Es decir, excepcionalmente, el Gobierno puede establecer por real decreto Secciones que extiendan su jurisdicción a dos o más partidos judiciales, siempre a propuesta del CGPJ y con informe de la comunidad autónoma competente.`,
  },
  {
    id: '42efeefb-e2bb-45d7-9a38-6332e5296c0b',
    newArticleId: '9aae6993-31e2-49d2-ae5d-5b6ec421b233', // art 570 bis LOPJ
    explanation: null, // keep existing explanation, just fix the article link
  },

  // --- Article changes to correct law/article (2) ---
  {
    id: 'deaeda3b-dd7e-46b0-96af-cb32d4e891f5',
    newArticleId: '9c001c33-1d90-40a7-bd3a-4715aeafde31', // art 480 LOPJ
    explanation: `La respuesta correcta es D).

El Instituto Nacional de Toxicología y Ciencias Forenses (INTCF) es un órgano técnico adscrito orgánicamente al Ministerio de Justicia, cuya misión principal es auxiliar a la Administración de Justicia y colaborar con ella mediante la práctica de pruebas periciales, análisis e investigaciones toxicológicas y de ciencias forenses.

Esta adscripción al Ministerio de Justicia se establece en el artículo 480 de la LOPJ y se desarrolla en el Real Decreto 862/1998.

Las demás opciones son incorrectas: el INTCF no depende del CGPJ (A), ni del Ministerio de Sanidad (B), ni de los Tribunales Superiores de Justicia (C).`,
  },
  {
    id: '28cc208e-2678-4988-b526-c1fde9f011ec',
    newArticleId: 'd676147e-e072-4774-9cbd-d3c38aa74f41', // art 22 Ley 40/2015
    explanation: `La respuesta correcta es A).

Según el artículo 22.2 de la Ley 40/2015, de 1 de octubre, de Régimen Jurídico del Sector Público:

"Los órganos colegiados de la Administración General del Estado y de sus Organismos públicos y entidades de derecho público vinculados o dependientes de ella, por su composición, se clasifican en:
a) Órganos colegiados interministeriales, si sus miembros proceden de diferentes Ministerios.
b) Órganos colegiados ministeriales, si sus componentes proceden de los órganos de un solo Ministerio."

La clasificación por composición es: interministeriales y ministeriales.`,
  },

  // --- Explanation-only corrections (4) ---
  {
    id: '95b3724b-37ce-4b47-a008-ecd79e63e1b7',
    explanation: `La respuesta correcta es D) porque es la afirmación INCORRECTA.

Según el artículo 118 de la Constitución Española: "Es obligado cumplir las sentencias y demás resoluciones firmes de los Jueces y Tribunales, así como prestar la colaboración requerida por éstos en el curso del proceso y en la ejecución de lo resuelto."

La opción D omite la palabra "firmes" al decir solo "sentencias y demás resoluciones de los Jueces y Tribunales". Esta omisión es jurídicamente significativa porque la obligación de cumplimiento se refiere específicamente a las resoluciones firmes, no a cualquier resolución.

Las demás opciones son correctas:
- Opción A: El art. 119 CE establece que "La justicia será gratuita cuando así lo disponga la ley".
- Opción B: Corresponde a la segunda parte del art. 118 CE: "prestar la colaboración requerida por éstos en el curso del proceso y en la ejecución de lo resuelto".
- Opción C: El art. 120.1 CE establece que "Las actuaciones judiciales serán públicas, con las excepciones que prevean las leyes de procedimiento".`,
  },
  {
    id: '891a1415-c820-4423-ad87-93bec6fb7a54',
    explanation: `La respuesta correcta es B).

Según el artículo 121 de la Constitución Española: "Los daños causados por error judicial, así como los que sean consecuencia del funcionamiento anormal de la Administración de Justicia, darán derecho a una indemnización a cargo del Estado, conforme a la ley."

La CE establece dos causas de indemnización: (1) error judicial, y (2) funcionamiento anormal de la Administración de Justicia.

La opción B ("Los que sean consecuencia del funcionamiento anormal de la Administración de Justicia") recoge correctamente una de las dos causas reconocidas en el art. 121 CE.

La opción A dice "Solo los daños causados por error judicial", lo cual es incorrecto por la palabra "solo" (falta la segunda causa). La opción C es falsa. La opción D ("En todos los casos anteriores") es incorrecta porque incluiría la opción C.`,
  },
  {
    id: '6bc13156-9834-45cb-8e89-87df0398c9b1',
    explanation: `La respuesta correcta es D).

La tramitación de los expedientes de extradición pasiva corresponde a los Juzgados Centrales de Instrucción (actual Sección de Instrucción del Tribunal Central de Instancia tras la reforma de la LO 1/2025).

Según el artículo 95.a) de la LOPJ, los jueces de la Sección de Instrucción del Tribunal Central de Instancia conocen de la tramitación de los expedientes de extradición pasiva. Es importante distinguir entre la tramitación (instrucción), que compete a estos juzgados, y la resolución de los procedimientos de extradición pasiva, que corresponde a la Sala de lo Penal de la Audiencia Nacional (art. 65.4 LOPJ).

Las demás opciones son incorrectas: ni la Audiencia Nacional como órgano genérico (A), ni las Audiencias Provinciales (B), ni los Juzgados de Primera Instancia e Instrucción (C) tienen atribuida esta competencia.`,
  },
  {
    id: 'f8a3fb73-0fd5-44c9-9a5e-bf507d11b3d8',
    explanation: `La respuesta correcta es C).

Según el artículo 82.3 de la LOPJ, la Sección o Secciones de la Audiencia Provincial de Alicante especializadas en materia mercantil ejercen competencias como Tribunales de Marca de la Unión Europea en segunda instancia. En el ejercicio de esta competencia extienden su jurisdicción a todo el territorio nacional.

En primera instancia, según el artículo 87.10 de la LOPJ, es la Sección de lo Mercantil del Tribunal de Instancia de Alicante quien conoce de estos asuntos como Tribunal de Marca de la Unión Europea, extendiendo igualmente su jurisdicción a todo el territorio nacional.

Las demás opciones son incorrectas porque ni el Tribunal Supremo (A), ni la Audiencia Nacional (B), ni el Tribunal de Justicia de la Unión Europea (D) actúan como Tribunales de Marca de la UE en el ordenamiento español.`,
  },

  // --- Explanation-only, article not fixable (law not in DB) (2) ---
  {
    id: '0a29d9a8-cc19-4663-a2f5-108ad4704229',
    explanation: `La respuesta correcta es B).

Según el artículo 38 del Real Decreto 796/2005, de 1 de julio, por el que se aprueba el Reglamento general de régimen disciplinario del personal al servicio de la Administración de Justicia:

"La duración del procedimiento disciplinario no excederá de doce meses desde la fecha del acuerdo de incoación hasta la de la resolución sancionadora."

Este plazo de 12 meses es un límite máximo legal para garantizar que los procedimientos disciplinarios se resuelvan en un tiempo razonable.`,
  },
  {
    id: 'a917f6f9-73a9-45f9-9460-d5c42e44c0a0',
    explanation: `La respuesta correcta es D).

Según el apartado 4 de la Carta de Derechos de los Ciudadanos ante la Justicia (aprobada como Proposición no de Ley por el Pleno del Congreso de los Diputados el 16 de abril de 2002):

"El ciudadano tiene derecho a formular reclamaciones, quejas y sugerencias relativas al incorrecto funcionamiento de la Administración de Justicia, así como a recibir respuesta a las mismas con la mayor celeridad y, en todo caso, dentro del plazo de un mes."

Este plazo de un mes garantiza una respuesta ágil a las reclamaciones ciudadanas sobre el funcionamiento del servicio público de justicia.`,
  },
];

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN ===' : '=== APPLYING CORRECTIONS ===');
  console.log(`False positives: ${falsePositives.length}`);
  console.log(`Corrections: ${corrections.length}`);
  console.log(`Total: ${falsePositives.length + corrections.length}\n`);

  let fpOk = 0, fpFail = 0;
  let corrOk = 0, corrFail = 0;
  let articleChanges = 0, explanationChanges = 0;

  // ============================================================
  // STEP 1: Verify all IDs exist and have error status
  // ============================================================
  console.log('--- STEP 1: Verifying all IDs ---');
  const allIds = [...falsePositives, ...corrections.map(c => c.id)];

  for (let i = 0; i < allIds.length; i += 50) {
    const batch = allIds.slice(i, i + 50);
    const { data, error } = await supabase
      .from('questions')
      .select('id, topic_review_status')
      .in('id', batch);

    if (error) {
      console.error('VERIFICATION ERROR:', error.message);
      return;
    }

    const found = new Set((data || []).map(q => q.id));
    for (const id of batch) {
      if (!found.has(id)) {
        console.error(`NOT FOUND: ${id}`);
        return;
      }
    }

    // Check all have error status
    for (const q of (data || [])) {
      const errorStates = [
        'bad_answer', 'bad_explanation', 'bad_answer_and_explanation',
        'wrong_article', 'wrong_article_bad_explanation', 'wrong_article_bad_answer', 'all_wrong',
        'tech_bad_answer', 'tech_bad_explanation', 'tech_bad_answer_and_explanation'
      ];
      if (!errorStates.includes(q.topic_review_status)) {
        console.error(`UNEXPECTED STATUS: ${q.id} has status "${q.topic_review_status}"`);
        return;
      }
    }
  }
  console.log(`All ${allIds.length} IDs verified.\n`);

  // ============================================================
  // STEP 2: Verify target articles exist
  // ============================================================
  console.log('--- STEP 2: Verifying target articles ---');
  const targetArticleIds = [...new Set(corrections.filter(c => c.newArticleId).map(c => c.newArticleId))];

  for (const artId of targetArticleIds) {
    const { data } = await supabase
      .from('articles')
      .select('id, article_number, law_id, laws(short_name)')
      .eq('id', artId)
      .single();

    if (!data) {
      console.error(`TARGET ARTICLE NOT FOUND: ${artId}`);
      return;
    }
    console.log(`  OK: ${artId} → Art ${data.article_number} ${data.laws?.short_name}`);
  }
  console.log('');

  // ============================================================
  // STEP 3: Apply false positives
  // ============================================================
  console.log('--- STEP 3: False Positives → perfect ---');
  for (const id of falsePositives) {
    if (DRY_RUN) {
      console.log(`  [DRY] ${id} → perfect`);
      fpOk++;
      continue;
    }

    const { error } = await supabase
      .from('questions')
      .update({ topic_review_status: 'perfect' })
      .eq('id', id);

    if (error) {
      console.error(`  FAIL ${id}: ${error.message}`);
      fpFail++;
    } else {
      console.log(`  OK ${id}`);
      fpOk++;
    }
  }
  console.log(`FPs: ${fpOk} OK, ${fpFail} FAIL\n`);

  // ============================================================
  // STEP 4: Apply corrections
  // ============================================================
  console.log('--- STEP 4: Corrections ---');
  for (const c of corrections) {
    const update = { topic_review_status: 'perfect' };
    const changes = [];

    if (c.newArticleId) {
      update.primary_article_id = c.newArticleId;
      changes.push('article');
      articleChanges++;
    }
    if (c.explanation) {
      update.explanation = c.explanation;
      changes.push('explanation');
      explanationChanges++;
    }

    if (DRY_RUN) {
      console.log(`  [DRY] ${c.id} → ${changes.join('+') || 'status only'}`);
      corrOk++;
      continue;
    }

    const { error } = await supabase
      .from('questions')
      .update(update)
      .eq('id', c.id);

    if (error) {
      console.error(`  FAIL ${c.id}: ${error.message}`);
      corrFail++;
    } else {
      console.log(`  OK ${c.id} [${changes.join('+')}]`);
      corrOk++;
    }
  }
  console.log(`Corrections: ${corrOk} OK, ${corrFail} FAIL`);

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n=== SUMMARY ===');
  console.log(`False positives: ${fpOk}/${falsePositives.length} OK`);
  console.log(`Corrections: ${corrOk}/${corrections.length} OK`);
  console.log(`  Article changes: ${articleChanges}`);
  console.log(`  Explanation updates: ${explanationChanges}`);
  console.log(`Total: ${fpOk + corrOk}/${allIds.length} OK`);
  console.log(`Failures: ${fpFail + corrFail}`);
}

main().catch(console.error);
