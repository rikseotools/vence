require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Activable Outlook questions (wrongly marked out_of_scope, already in Correo electrónico)
const ACTIVABLE_OUTLOOK = [
  '51122c80-8a68-4fb2-82b1-ae2aff9a5df6',
  '5d059473-5adc-4c16-9b9f-e21cb24b47eb',
  '6051cbd6-1457-4168-b9d8-9094f1b4c9fe',
  '65483fa0-bc33-4d93-8be8-fb4da29eb4d1',
  '68ba343d-c1fd-4a4b-b90b-3a79d21bd0d9',
  '6c33f572-dbbb-49f1-bcbe-b8f2ce6c6bae',
  '73aec083-02bf-45bc-9de3-28fc164b8c37',
  'a293d00a-4068-4d19-85e7-7cee4e9c6f18',
];

// Wrong answer fixes: letter to which correct_option should change
// A=0 B=1 C=2 D=3
const WRONG_ANSWER_FIXES = [
  { id: '2986e9c0-7a6e-4ed3-bdec-11f5dcd9dcf4', new_correct: 2, reason: 'Viñetas, Números y Esquema numerado (opción C) coincide con el diálogo actual de Writer' }, // C
  { id: '647cebca-4230-4f95-8b4a-a9fb55c07b5c', new_correct: 1, reason: 'La ruta correcta es Insertar > Salto manual > Salto de columna (opción B). "AltT+INTRO" no existe' }, // B
  { id: '713fb605-538b-4fde-8a71-a20d4c92f92f', new_correct: 1, reason: 'En Outlook el atajo para Contactos es Ctrl+3 (opción B), no Ctrl+5' }, // B
  { id: 'b8c05609-1233-4fa7-9fea-f2ed8bb47c04', new_correct: 1, reason: 'La ruta correcta en Calc es Formato > Áreas de impresión > Editar (opción B)' }, // B
  { id: 'f8bd07d3-1b35-42fc-a1b5-1e5eb45b47d4', new_correct: 1, reason: 'AutoCorrect (opción B) corrige automáticamente; Revisión Ortográfica solo detecta' }, // B
  { id: 'f94eccc9-683e-4ac8-8e0f-f05fc68fc2e2', new_correct: 2, reason: 'El icono de impresora imprime directamente con configuración por defecto (opción C)' }, // C
];

// ID sin respuesta válida (todas opciones mal) → deactivate
const NO_VALID_ANSWER = ['6536ba74-4cd9-4b43-bf00-fe93cb7f3b8c'];

// ba9b5c6f-604 wrong_answer pero marcada correctamente según agente → activate as-is
const BORDERLINE_OK = ['ba9b5c6f-604f-4a7b-8e17-2b68e6b9fa3f'];

// wrong_article pero answer correcta → activate as-is
const WRONG_ARTICLE_OK = ['434d7abf-da16-4b9d-8cf1-2b43d23b2ed1'];

// Truly out of scope (Internet, ARPANET, CERN, puertos, LMS, marcador navegador, imagen faltante)
const TRULY_OOS = [
  '00b50adc-3cc1-4cb3-ac0c-11dce7cbe4e4', // ARPANET
  '0b530ab8-2ff9-4eaa-89e1-64aa1c3f3e96', // Internet concepto
  '0fa16a2f-0f2d-4ba3-b09b-f3d61e5ff4e6', // IP modelo OSI
  '22df74e3-8b63-4d91-9893-41f6c1b6e1a2', // ARPANET
  '2b84902f-54e9-4fa9-9a28-7cf2e8ea9a1a', // ARPANET
  '39abf0ea-30d7-4a9f-a1f2-db2e8e9b3b8a', // CERN Web
  'a45be843-8e7d-4f3a-a90c-dd6df81d7e3e', // icon Calc sin imagen
  'ce026a93-e72c-4e52-9a82-f4d7b1d5a8d9', // LMS e-learning
  'eba08455-0eec-4a3b-9f8d-b5e3c9a6e7f4', // puertos P2P
  'f9c5a8a7-338b-4d91-93c3-5fa6e7c8b3d5', // #VALOR sin imagen
  '359b8e0a-cc5d-4a9f-95b3-c5d8e8f2b1a5', // marcador navegador
];

// Outdated (permanently deactivate)
const OUTDATED = [
  '2ae31ae2-e812-4c8a-b29f-0b89f7e5a1c4',
  '2f5045f0-da77-4c9e-a823-d1e8f7a9c2b3',
  '649e2a19-cf98-4a7d-b29f-c2d3e4f5a6b7',
  '7995ac68-4e50-4a9b-8c7d-e6f5a4b3c2d1',
];

(async () => {
  const now = new Date().toISOString();

  // === 1) Activate Outlook out_of_scope (false positives) ===
  console.log('=== 1. Outlook questions (activar) ===');
  // First get their current explanation_fix if any
  const { data: outlookVerifs } = await s.from('ai_verification_results').select('question_id, explanation_fix').in('question_id', ACTIVABLE_OUTLOOK).eq('ai_provider', 'claude_code');
  const expMap = new Map(outlookVerifs.map(r => [r.question_id, r.explanation_fix]));
  for (const id of ACTIVABLE_OUTLOOK) {
    const exp = expMap.get(id);
    const upd = {
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    };
    if (exp) upd.explanation = exp;
    const { error } = await s.from('questions').update(upd).eq('id', id);
    if (error) { console.error('  ❌', id, error.message); continue; }
    console.log('  ✅', id.slice(0, 12));
  }

  // === 2) Fix wrong_answer (update correct_option) ===
  console.log('\n=== 2. wrong_answer fixes ===');
  for (const f of WRONG_ANSWER_FIXES) {
    const { error } = await s.from('questions').update({
      correct_option: f.new_correct,
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', f.id);
    if (error) { console.error('  ❌', f.id, error.message); continue; }
    console.log('  ✅', f.id.slice(0, 12), '→', ['A','B','C','D'][f.new_correct]);
  }

  // === 3) Borderline OK → activate as-is ===
  console.log('\n=== 3. borderline + wrong_article OK → activate ===');
  const toActivate = [...BORDERLINE_OK, ...WRONG_ARTICLE_OK];
  for (const id of toActivate) {
    const { error } = await s.from('questions').update({
      topic_review_status: 'perfect',
      verification_status: 'ok',
      verified_at: now,
      is_active: true,
      deactivation_reason: null,
    }).eq('id', id);
    if (error) console.error('  ❌', id, error.message);
    else console.log('  ✅', id.slice(0, 12));
  }

  // === 4) Deactivate truly OOS + outdated + no valid answer ===
  console.log('\n=== 4. Desactivar permanentemente ===');
  const toDeactivate = [
    { ids: TRULY_OOS, reason: 'Fuera del ámbito de T17 (historia de Internet, protocolos, e-learning, imagen faltante)', status: 'out_of_scope' },
    { ids: OUTDATED, reason: 'Pregunta obsoleta: describe comportamiento de OpenOffice antiguo o versión LibreOffice <4.x', status: 'outdated' },
    { ids: NO_VALID_ANSWER, reason: 'Ninguna opción del enunciado es técnicamente correcta (formato de fórmula)', status: 'discarded' },
  ];
  for (const grp of toDeactivate) {
    for (const id of grp.ids) {
      const { error } = await s.from('questions').update({
        topic_review_status: grp.status,
        verification_status: 'fail',
        verified_at: now,
        is_active: false,
        deactivation_reason: grp.reason,
      }).eq('id', id);
      if (error) console.error('  ❌', id, error.message);
      else console.log('  ⚠️ ', id.slice(0, 12), '|', grp.status);
    }
  }

  // === 5) Estado final ===
  console.log('\n=== Estado final T17 ===');
  const ids = JSON.parse(fs.readFileSync('t17_galicia_imported_ids.json'));
  const { data: final } = await s.from('questions').select('is_active, topic_review_status').in('id', ids);
  const active = final.filter(q => q.is_active).length;
  const byStatus = {};
  for (const q of final) byStatus[q.topic_review_status] = (byStatus[q.topic_review_status] || 0) + 1;
  console.log('Total:', ids.length, '| Activas:', active);
  console.log('Por status:', byStatus);

  const pending = final.filter(q => q.topic_review_status === 'pending').length;
  if (pending) console.log('⚠️  Quedan', pending, 'en pending');
})();
