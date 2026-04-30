require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // Get article IDs for 44 bis and 53 bis
  const { data: law } = await supabase.from('laws').select('id').eq('short_name', 'Ley 16/2010').single();
  const { data: arts } = await supabase.from('articles').select('id, article_number')
    .eq('law_id', law.id).in('article_number', ['44 bis', '53 bis']);
  const ART_44BIS = arts.find(a => a.article_number === '44 bis').id;
  const ART_53BIS = arts.find(a => a.article_number === '53 bis').id;
  console.log('art 44 bis id:', ART_44BIS);
  console.log('art 53 bis id:', ART_53BIS);

  const now = new Date().toISOString();

  const fixes = [
    // #1 bad_explanation art 25 — "jefaturas" → "departamentos"
    {
      id: '13147e5e-8803-45dd-9d77-d880421f9f99',
      explanation: 'Según el art. 25.2 de la Ley 16/2010, son órganos de **dirección** de la Administración general de la Comunidad Autónoma de Galicia: las secretarías generales técnicas, las **direcciones generales y equivalentes**, las vicesecretarías generales, las subdirecciones generales, las delegaciones territoriales, las secretarías territoriales y los departamentos territoriales. La respuesta correcta es la D. Las opciones A (Presidencia de la Xunta), B (Consejerías) y C (Secretarías Generales) son órganos **superiores** según el art. 25.1, no órganos de dirección.',
    },
    // #2 wrong_article 44 → 44 bis
    { id: '4374e055-51c4-41a8-a056-9902e28c569c', primary_article_id: ART_44BIS },
    // #3 wrong_article 44 → 44 bis
    { id: '54b6f12e-3316-4d44-a7de-f6fbd1b942a4', primary_article_id: ART_44BIS },
    // #4 bad_explanation art 16.1 — presidente vs secretario, "efectuar" vs "acordar"
    {
      id: '8aab4715-c095-4e7e-9a25-92812d02f701',
      explanation: 'Según el art. 16.1 de la Ley 16/2010, al presidente del órgano colegiado le corresponde **acordar** la convocatoria de las sesiones (art. 16.1.b), **presidir** las sesiones y moderar los debates (art. 16.1.c) y **visar** las actas y certificaciones (art. 16.1.g). La opción C dice "**efectuar** la convocatoria", que es una función distinta atribuida al secretario del órgano colegiado (art. 17.1.a: "Efectuar la convocatoria de las sesiones del órgano por orden de su presidenta o presidente"). Por tanto, la opción C es la que NO corresponde al presidente y es la respuesta correcta.',
    },
    // #5 bad_explanation art 34 — secretaría territorial
    {
      id: '97e0432a-d6ee-455d-8550-dea1b690a01f',
      question_text: 'Según el artículo 34 de la Ley 16/2010 de Galicia, en cada delegación territorial existirá una secretaría territorial con nivel orgánico de subdirección general. ¿Cuál de las siguientes NO es una función que le corresponda a dicha secretaría territorial?',
      explanation: 'Según el art. 34.1 de la Ley 16/2010, son funciones de la secretaría territorial: a) el apoyo y asesoramiento a la persona titular de la delegación territorial (opción A); b) la sustitución de esta en caso de vacante, ausencia o enfermedad (opción B); c) cuantas otras competencias le sean atribuidas o delegadas (opción D). La opción C ("la elaboración de los programas de actuación específicos de la subdirección") NO figura entre las funciones del art. 34.1, por lo que es la respuesta correcta (la que NO corresponde).',
    },
    // #6 wrong_article 53 → 53 bis
    { id: 'aad5eb51-0c35-4df4-ad81-f69a97ed6792', primary_article_id: ART_53BIS },
    // #7 bad_explanation art 20 — actas (secretario levanta, colegiado aprueba)
    {
      id: 'd759f505-8c2a-4464-aabb-a43d05086672',
      question_text: '¿A quién corresponde levantar las actas de las sesiones del órgano colegiado, según el artículo 20 de la Ley 16/2010?',
      explanation: 'Según el art. 20.1 de la Ley 16/2010, "de cada sesión que celebre el órgano colegiado el secretario levantará el acta". La opción C (el secretario del órgano colegiado) es por tanto la correcta. La aprobación del acta corresponde al propio órgano colegiado en la misma o siguiente sesión (art. 20.5), pero el levantamiento del acta es competencia exclusiva del secretario.',
    },
    // #8 wrong_article 44 → 44 bis
    { id: 'ee298a20-a291-4b6c-973d-e31819e057ce', primary_article_id: ART_44BIS },
  ];

  let ok = 0, fail = 0;
  for (const f of fixes) {
    const { id, ...updates } = f;
    updates.topic_review_status = 'perfect';
    updates.verification_status = 'ok';
    updates.verified_at = now;
    updates.is_active = true;
    updates.deactivation_reason = null;
    const { error } = await supabase.from('questions').update(updates).eq('id', id);
    if (error) { console.error('❌', id, error.message); fail++; }
    else {
      const summary = [];
      if (updates.primary_article_id) summary.push('article');
      if (updates.question_text) summary.push('question_text');
      if (updates.explanation) summary.push('explanation');
      summary.push('perfect');
      console.log('✅', id, summary.join(', '));
      ok++;
    }
  }
  console.log('\nTotal: ' + ok + ' OK, ' + fail + ' fallos');

  // Also mark the 37 perfect as perfect + reactivate
  const consolidated = JSON.parse(fs.readFileSync('t6_galicia_consolidated.json', 'utf8'));
  const perfectIds = consolidated.filter(r => r.status === 'perfect').map(r => r.id);
  const { error } = await supabase.from('questions').update({
    topic_review_status: 'perfect',
    verification_status: 'ok',
    verified_at: now,
    is_active: true,
    deactivation_reason: null,
  }).in('id', perfectIds);
  console.log(error ? '❌ perfect update error' : '✅ ' + perfectIds.length + ' perfect actualizadas');

  // Verify final state (all imported ids)
  const importedIds = JSON.parse(fs.readFileSync('t6_galicia_imported_ids.json', 'utf8'));
  const { data: finalState } = await supabase.from('questions')
    .select('id, is_active, topic_review_status')
    .in('id', importedIds);
  const active = finalState.filter(q => q.is_active).length;
  const inactive = finalState.filter(q => !q.is_active).length;
  const pending = finalState.filter(q => q.topic_review_status === 'pending').length;
  console.log('\nFinal: ' + active + ' activas / ' + inactive + ' inactivas / ' + pending + ' pending');
  const notProcessed = finalState.filter(q => q.topic_review_status === 'pending');
  if (notProcessed.length > 0) {
    console.log('Preguntas sin procesar por agente:');
    notProcessed.forEach(q => console.log('  ' + q.id));
  }
})();
