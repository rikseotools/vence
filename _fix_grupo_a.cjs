#!/usr/bin/env node
'use strict';
require('dotenv').config({path: '.env.local'});
const { createClient } = require('@supabase/supabase-js');
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const CHANGED_BY = '2fc60bc8-1f9a-42c8-9c60-845c00af4a1f';

async function transition(qid, notes) {
  const { data, error } = await s.rpc('transition_question_state', {
    p_question_id: qid,
    p_expected_state: 'needs_human',
    p_new_state: 'approved',
    p_reason_code: 'ai_verified_perfect',
    p_changed_by: CHANGED_BY,
    p_ai_verification_id: null,
    p_notes: notes,
  });
  if (error) throw new Error('transition error: ' + error.message);
  return data;
}

async function verify(qid, notes) {
  const { error } = await s.from('ai_verification_results').insert({
    question_id: qid,
    ai_provider: 'claude_code',
    article_ok: true,
    answer_ok: true,
    explanation_ok: true,
    options_ok: true,
    confidence: 'alta',
    explanation: notes,
    verified_at: new Date().toISOString(),
    is_correct: true,
  });
  if (error) throw new Error('verify error: ' + error.message);
}

async function main() {
  const now = new Date().toISOString();

  // ================================================================
  // Q1: bcac1b7d - cuñado/recusación tras resolución
  // Art 24 Ley 40/2015 (995cbeb2) → CORRECTO, mantener
  // ================================================================
  const exp1 = `> El art. 24.1 de la Ley 40/2015 dispone que la recusación puede promoverse «en cualquier momento de la **tramitación** del procedimiento». Una vez notificada la resolución que pone fin al procedimiento, la tramitación ha concluido y ya no cabe promover recusación.

**Por qué D es correcta:** Ramón recibió la resolución denegatoria, es decir, el procedimiento ya terminó. El momento procesal impide cualquier incidente de recusación: las opciones A (amistad íntima, art. 23.2.c), B (segundo grado de afinidad, art. 23.2.b) y C (enemistad manifiesta, art. 23.2.c) describirían causas válidas durante la tramitación, pero al haberse dictado ya resolución, ninguna de ellas es procesalmente admisible. La respuesta correcta es D porque ninguna procede.

**Por qué las demás son incorrectas:** La causa material —parentesco por afinidad de segundo grado— podría dar lugar a recusación durante la tramitación. Sin embargo, la pregunta sitúa el hecho tras la notificación de la resolución, momento en que las opciones A, B y C quedan sin posibilidad de ejercicio. Solo D refleja correctamente que la recusación es improcedente en ese momento procesal.`;

  const { error: e1 } = await s.from('questions').update({
    primary_article_id: '995cbeb2-a790-4558-82ec-8c3db37d17e2',
    exam_position: 'administrativo_carm',
    explanation: exp1,
    updated_at: now,
  }).eq('id', 'bcac1b7d-618d-4ce0-8206-4c923c6c7f33');
  if (e1) throw new Error('Q1 update: ' + e1.message);
  console.log('Q1 update: OK');

  await verify('bcac1b7d-618d-4ce0-8206-4c923c6c7f33',
    'Art 24 Ley 40/2015 correcto. Recusacion improcedente tras resolucion notificada. Cunado = 2 grado afinidad pero ya no hay tramitacion.');
  console.log('Q1 verify: OK');

  const t1 = await transition('bcac1b7d-618d-4ce0-8206-4c923c6c7f33',
    'Art 24 Ley 40/2015 correcto. exam_position=administrativo_carm. Explicacion reescrita 2 secciones.');
  console.log('Q1 transition:', JSON.stringify(t1));

  // ================================================================
  // Q2: fdca40da - Decreto 236/2010, info sin acreditacion
  // Art 9 (c7cd787f) → CORRECTO (información general, primary)
  // ================================================================
  const exp2 = `> El Decreto n.º 236/2010 de la Región de Murcia regula la atención a los ciudadanos y el suministro de información administrativa. El art. 9 define la **información general** como aquella que «no requiere la acreditación de legitimación alguna». El art. 10, por su parte, establece el mismo régimen para la **información especializada**: también se facilita sin exigir acreditación de la legitimación.

**Por qué D es correcta:** La opción D señala que son correctas tanto la a) como la b). Tanto la información general (art. 9) como la especializada (art. 10) se facilitan sin exigir acreditación, mientras que la información **particular** (art. 11) sí requiere la identificación y legitimación del interesado que la solicita.

**Por qué las demás son incorrectas:** La opción A indica solo la información general: es correcta pero incompleta. La opción B indica solo la especializada: también correcta pero incompleta. La opción C (información particular) sí exige acreditación de legitimación y es incorrecta para la pregunta planteada. Solo D recoge correctamente ambas modalidades que no requieren acreditación.`;

  const { error: e2 } = await s.from('questions').update({
    exam_position: 'administrativo_carm',
    explanation: exp2,
    updated_at: now,
  }).eq('id', 'fdca40da-a52b-4d5f-8938-3bd98aa22e0a');
  if (e2) throw new Error('Q2 update: ' + e2.message);
  console.log('Q2 update: OK');

  await verify('fdca40da-a52b-4d5f-8938-3bd98aa22e0a',
    'Art 9 Decreto 236/2010 correcto como primary (informacion general sin acreditacion). Respuesta D correcta: art 9 (general) + art 10 (especializada) no exigen acreditacion.');
  console.log('Q2 verify: OK');

  const t2 = await transition('fdca40da-a52b-4d5f-8938-3bd98aa22e0a',
    'Art 9 Decreto 236/2010 correcto. exam_position=administrativo_carm. Explicacion reescrita 2 secciones.');
  console.log('Q2 transition:', JSON.stringify(t2));

  // ================================================================
  // Q3: 1e87d371-4dcc - plazo recurso via administrativa
  // Art 112 → CORREGIR a art 124 Ley 39/2015 (bdcb4b25)
  // ================================================================
  const exp3 = `> El art. 124 de la Ley 39/2015 establece que el plazo para interponer el **recurso potestativo de reposición** contra un acto expreso es de **un mes** desde el día siguiente a su notificación. Del mismo modo, el art. 122.1 dispone que el plazo del **recurso de alzada** también es de un mes desde la notificación. Ambos son los recursos que caben «en vía administrativa».

**Por qué A es correcta:** Sea recurso de alzada —art. 122— o de reposición —art. 124—, el plazo para interponer el recurso administrativo contra un acto expreso es siempre de **un mes**. La opción A es la única que lo recoge correctamente.

**Por qué las demás son incorrectas:** Las opciones B (dos meses), C (tres meses) y D (seis meses) no se corresponden con el plazo establecido en la Ley 39/2015 para los recursos ordinarios en vía administrativa contra actos expresos. El plazo de dos meses aplica al recurso contencioso-administrativo ante los tribunales, no a los recursos administrativos.`;

  const { error: e3 } = await s.from('questions').update({
    primary_article_id: 'bdcb4b25-6688-49cd-9fd5-fddcc1bbb7db', // art 124 Ley 39/2015
    exam_position: 'administrativo_carm',
    explanation: exp3,
    updated_at: now,
  }).eq('id', '1e87d371-4dcc-4d1f-85c9-d79eaaaaf83e');
  if (e3) throw new Error('Q3 update: ' + e3.message);
  console.log('Q3 update: OK (art 112 -> art 124)');

  await verify('1e87d371-4dcc-4d1f-85c9-d79eaaaaf83e',
    'Corregido primary_article_id: art 112 -> art 124 Ley 39/2015. Art 124: plazo 1 mes recurso reposicion. Respuesta A correcta.');
  console.log('Q3 verify: OK');

  const t3 = await transition('1e87d371-4dcc-4d1f-85c9-d79eaaaaf83e',
    'Corregido primary_article_id art 112->art 124 Ley 39/2015. exam_position=administrativo_carm.');
  console.log('Q3 transition:', JSON.stringify(t3));

  // ================================================================
  // Q4: a45ad045 - notificacion electronica art 41 Ley 39/2015
  // Art 41 (d757d1a8) → CORRECTO
  // ================================================================
  const exp4 = `> El art. 41.1 de la Ley 39/2015 establece que las notificaciones se practicarán **preferentemente por medios electrónicos** y, en todo caso, cuando el interesado resulte obligado a recibirlas por esta vía. El art. 14.2 obliga a las **personas jurídicas** a relacionarse electrónicamente con las Administraciones Públicas en todo caso.

**Por qué C es correcta:** La empresa de Don Ramón es una persona jurídica y, por tanto, está obligada a relacionarse electrónicamente con la Administración conforme al art. 14.2. En consecuencia, el órgano concedente le notificará la resolución **mediante notificación electrónica**, que es el canal legal obligatorio para este tipo de interesados.

**Por qué las demás son incorrectas:** La opción A (carta certificada) y la B (notificación en papel) no son el medio previsto para personas jurídicas, que tienen obligación de recibir notificaciones electrónicas. La opción D queda reservada para personas físicas no obligadas a la vía electrónica, que pueden elegir el medio en su solicitud; no aplica a las personas jurídicas.`;

  const { error: e4 } = await s.from('questions').update({
    exam_position: 'administrativo_carm',
    explanation: exp4,
    updated_at: now,
  }).eq('id', 'a45ad045-b8ef-467d-9473-91efd5683674');
  if (e4) throw new Error('Q4 update: ' + e4.message);
  console.log('Q4 update: OK');

  await verify('a45ad045-b8ef-467d-9473-91efd5683674',
    'Art 41 Ley 39/2015 correcto. Notificacion electronica obligatoria para personas juridicas (art 14.2). Respuesta C correcta.');
  console.log('Q4 verify: OK');

  const t4 = await transition('a45ad045-b8ef-467d-9473-91efd5683674',
    'Art 41 Ley 39/2015 correcto. exam_position=administrativo_carm. Explicacion reescrita 2 secciones.');
  console.log('Q4 transition:', JSON.stringify(t4));

  console.log('\n=== GRUPO A COMPLETADO: 4/4 aprobadas ===');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
