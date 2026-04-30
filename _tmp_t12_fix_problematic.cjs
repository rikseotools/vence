require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const T12 = '21d85099-b2ee-45a5-b4de-3042ac8708ed';
const LO_3_2007 = '6e59eacd-9298-4164-9d78-9e9343d9a900';

// LO 3/2007 article IDs (fetched earlier)
const ART_6 = 'd9b0df06-9c6f-46e5-a880-030b18765983';
const ART_7 = 'b73db199-a7a4-46c3-992e-a45ec076f9e7';
const ART_8 = '2e3935d7-b988-4e31-9f7d-3ed4b727b776';

const fixes = [
  {
    id: '1df43799-9be6-47a2-8d3d-98da4cc06378',
    primary_article_id: ART_6,
    explanation: `> **Art. 6.1 LO 3/2007**
> "Se considera discriminación directa por razón de sexo la situación en que se encuentra una persona que sea, haya sido o pudiera ser tratada, en atención a su sexo, de manera menos favorable que otra en situación comparable."

**Por qué C es correcta:** Reproduce literalmente la definición legal: tratamiento menos favorable que otra persona en situación comparable, por razón de sexo.

**Por qué las demás son incorrectas:**
- **A)** Al revés: un mismo trato no es discriminación directa.
- **B)** Describe la justificación objetiva, que es un elemento de la discriminación indirecta (art. 6.2), no directa.
- **D)** La discriminación no depende de la percepción subjetiva, sino del trato objetivamente menos favorable.`,
  },
  {
    id: '7c9ec666-4550-46f8-a66e-6faa2d8302bf',
    primary_article_id: ART_6,
    explanation: `> **Art. 6.2 LO 3/2007**
> "Se considera discriminación indirecta por razón de sexo la situación en que una disposición, criterio o práctica aparentemente neutros pone a personas de un sexo en desventaja particular con respecto a personas del otro, salvo que dicha disposición, criterio o práctica puedan justificarse objetivamente en atención a una finalidad legítima y que los medios para alcanzar dicha finalidad sean necesarios y adecuados."

**Por qué C es correcta:** Reproduce la definición completa: desventaja particular + cláusula de salvaguarda "salvo que pueda justificarse objetivamente".

**Por qué las demás son incorrectas:**
- **A)** Invierte el sentido ("ventaja" en lugar de "desventaja").
- **B)** Omite la cláusula de salvaguarda de justificación objetiva.
- **D)** Describe una norma abiertamente sexista, que sería discriminación directa (art. 6.1), no indirecta.`,
  },
  {
    id: '92d9e217-e989-4bfc-90ec-950617f57888',
    primary_article_id: ART_6,
    explanation: `> **Art. 6.3 LO 3/2007**
> "En cualquier caso, se considera discriminatoria toda orden de discriminar, directa o indirectamente, por razón de sexo."

**Por qué B es correcta:** Reproduce literalmente el art. 6.3: cualquier orden de discriminar —directa o indirectamente— por razón de sexo es discriminatoria.

**Por qué las demás son incorrectas:**
- **A)** El artículo no exige que afecte a más de una persona.
- **C)** No se exigen consecuencias económicas.
- **D)** No se limita al ámbito laboral.`,
  },
  {
    id: '361db1bf-1f5a-4fe9-8311-5fa0b4862200',
    primary_article_id: ART_7,
    explanation: `> **Art. 7.3 LO 3/2007**
> "Se considerarán en todo caso discriminatorios el acoso sexual y el acoso por razón de sexo."

**Por qué B es correcta:** El artículo califica en todo caso como discriminatorios ambos tipos de acoso, sin exigir denuncia ni otras condiciones.

**Por qué las demás son incorrectas:**
- **A)** La denuncia no es condición para la calificación como discriminatorio.
- **C)** No se limita al ámbito laboral.
- **D)** Irrelevante el consentimiento: por definición, el acoso no es consentido, y el art. 7 no contempla esta excepción.`,
  },
  {
    id: '79f70f09-95b3-49c0-8c62-69e48f6c4f6e',
    primary_article_id: ART_7,
    explanation: `> **Art. 7.4 LO 3/2007**
> "El condicionamiento de un derecho o de una expectativa de derecho a la aceptación de una situación constitutiva de acoso sexual o de acoso por razón de sexo se considerará también acto de discriminación por razón de sexo."

**Por qué C es correcta:** Reproduce literalmente el art. 7.4: tanto un derecho como una expectativa de derecho, condicionados a aceptar acoso sexual o por razón de sexo.

**Por qué las demás son incorrectas:**
- **A)** La calificación como discriminación no depende de que se denuncie.
- **B)** Omite "expectativa de derecho" y sustituye "razón de sexo" por "razón de género".
- **D)** La información previa es irrelevante; el mero condicionamiento es discriminatorio.`,
  },
  {
    id: '93ad02b4-1381-4adb-930c-0902e453b260',
    primary_article_id: ART_8,
    explanation: `> **Art. 8 LO 3/2007**
> "Constituye discriminación directa por razón de sexo todo trato desfavorable a las mujeres relacionado con el embarazo o la maternidad."

**Por qué A es correcta:** El artículo señala expresamente como discriminación directa el trato desfavorable a las mujeres relacionado con la maternidad (y el embarazo).

**Por qué las demás son incorrectas:**
- **B)** El estado civil no está contemplado en el art. 8.
- **C)** El art. 8 protege a las mujeres por su condición de tales; el supuesto se refiere a trato desfavorable a mujeres, no a hombres.
- **D)** La paternidad no se menciona en el art. 8, que habla específicamente de embarazo y maternidad.`,
  },
];

// Permanent discard — question is badly formed, no option correctly describes "interseccional"
const IRRECOVERABLE_ID = 'fd6c9e4d-8145-4777-94e0-ce3d1c71ee6e';

(async () => {
  const now = new Date().toISOString();

  // --- 1) Extend topic_scope to include LO 3/2007 arts 6, 7, 8 ---
  console.log('=== 1. Extendiendo topic_scope T12 con LO 3/2007 ===');
  const { data: existingScope } = await supabase
    .from('topic_scope')
    .select('*')
    .eq('topic_id', T12)
    .eq('law_id', LO_3_2007)
    .maybeSingle();

  if (existingScope) {
    const newArts = Array.from(new Set([...(existingScope.article_numbers || []), '6', '7', '8'])).sort((a,b) => +a - +b);
    const { error } = await supabase.from('topic_scope').update({ article_numbers: newArts }).eq('id', existingScope.id);
    if (error) { console.error('❌ scope update:', error.message); process.exit(1); }
    console.log('✅ topic_scope LO 3/2007 actualizado con arts:', newArts.join(','));
  } else {
    const { error } = await supabase.from('topic_scope').insert({
      topic_id: T12, law_id: LO_3_2007, article_numbers: ['6', '7', '8'],
    });
    if (error) { console.error('❌ scope insert:', error.message); process.exit(1); }
    console.log('✅ topic_scope nueva entrada LO 3/2007 arts 6,7,8 creada');
  }

  // --- 2) Remap + activate 6 questions ---
  console.log('\n=== 2. Remapeando preguntas a LO 3/2007 y activando ===');
  let ok = 0;
  for (const f of fixes) {
    const { id, ...upd } = f;
    upd.topic_review_status = 'perfect';
    upd.verification_status = 'ok';
    upd.verified_at = now;
    upd.is_active = true;
    upd.deactivation_reason = null;
    const { error } = await supabase.from('questions').update(upd).eq('id', id);
    if (error) { console.error('❌', id, error.message); continue; }
    ok++;
    console.log('  ✅', id, '→ art.', f.primary_article_id === ART_6 ? '6' : f.primary_article_id === ART_7 ? '7' : '8');

    // Also update ai_verification_results to reflect fix
    await supabase.from('ai_verification_results').update({
      fix_applied: true, fix_applied_at: now,
      new_explanation: f.explanation,
      article_id: f.primary_article_id, law_id: LO_3_2007,
    }).eq('question_id', id).eq('ai_provider', 'claude_code');
  }
  console.log('✅ Remapeadas:', ok, '/', fixes.length);

  // --- 3) Deactivate fd6c9e4d permanently ---
  console.log('\n=== 3. Desactivando pregunta irrecuperable ===');
  const { error: discErr } = await supabase.from('questions').update({
    topic_review_status: 'discarded',
    verification_status: 'fail',
    verified_at: now,
    is_active: false,
    deactivation_reason: 'Pregunta mal formulada: ninguna opción recoge correctamente la definición de discriminación sexista interseccional del art. 11 Ley 7/2023 Galicia. La opción B describe la "múltiple" y la C dice "sin interacción", opuesto a interseccional.',
  }).eq('id', IRRECOVERABLE_ID);
  if (discErr) console.error('❌', discErr.message);
  else console.log('✅', IRRECOVERABLE_ID, 'desactivada permanentemente');

  await supabase.from('ai_verification_results').update({
    discarded: true, discarded_at: now,
  }).eq('question_id', IRRECOVERABLE_ID).eq('ai_provider', 'claude_code');

  // --- 4) Final check ---
  console.log('\n=== 4. Estado final T12 Galicia ===');
  const fs = require('fs');
  const ids = JSON.parse(fs.readFileSync('/home/manuel/Documentos/github/vence/t12_galicia_imported_ids.json'));
  const { data: final } = await supabase.from('questions').select('is_active, topic_review_status, deactivation_reason').in('id', ids);
  const active = final.filter(q => q.is_active).length;
  const byStatus = {};
  for (const q of final) byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  console.log('Total:', ids.length);
  console.log('Activas:', active);
  console.log('Por status:', byStatus);
  const inactive = final.filter(q => !q.is_active);
  if (inactive.length) {
    console.log('\nDesactivadas:');
    for (const q of inactive) console.log('  -', q.topic_review_status, '|', q.deactivation_reason?.slice(0, 100));
  }
})();
