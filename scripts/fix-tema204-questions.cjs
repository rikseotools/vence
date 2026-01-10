const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  console.log('=== CORRECCIONES TEMA 204 ===\n');

  // 1. Corregir artículo vinculado de la pregunta sobre apoderamiento apud acta
  console.log('1. Corrigiendo pregunta 8e1f3025 (artículo incorrecto)...');

  const newExplanation8e = `**Art. 6.5 Ley 39/2015 - Apoderamiento apud acta**

El apoderamiento «apud acta» puede otorgarse de DOS formas:
• **Comparecencia electrónica** en la sede electrónica, usando sistemas de FIRMA electrónica
• **Comparecencia personal** en las oficinas de asistencia en materia de registros

La opción A es correcta: comparecencia personal en oficinas de asistencia en materia de registros.

La opción C es incorrecta porque menciona "sello electrónico" cuando el artículo dice "firma electrónica".
Las opciones B y D son incorrectas porque mencionan "oficinas de correos", que no están contempladas en el artículo.`;

  const { error: err1 } = await supabase
    .from('questions')
    .update({
      primary_article_id: 'b7186672-daef-4a21-baee-24d708c58a73', // Art. 6 Ley 39/2015
      explanation: newExplanation8e,
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString()
    })
    .eq('id', '8e1f3025-1608-424e-8ed3-20436c9851ac');

  if (err1) console.log('  Error:', err1.message);
  else console.log('  ✅ Artículo y explicación actualizados');

  // 2. Mejorar explicación Art. 21 RGPD (13a2ed61)
  console.log('\n2. Mejorando explicación pregunta 13a2ed61 (Art. 21 RGPD)...');

  const newExplanation21 = `**Art. 21 RGPD - Derecho de oposición**

El interesado tiene derecho a oponerse al tratamiento de sus datos cuando este se base en:
• Art. 6.1.e) Misión realizada en interés público
• Art. 6.1.f) Interés legítimo del responsable

Requisitos para ejercer el derecho:
• Debe alegar **motivos relacionados con su situación particular**
• Incluye el derecho a oponerse a la **elaboración de perfiles**

La opción C es correcta porque menciona la oposición a la elaboración de perfiles cuando el tratamiento es necesario para una misión de interés público o ejercicio de poderes públicos (art. 6.1.e).

El responsable deberá cesar el tratamiento SALVO que acredite motivos legítimos imperiosos que prevalezcan sobre los intereses del interesado.`;

  const { error: err2 } = await supabase
    .from('questions')
    .update({
      explanation: newExplanation21,
      topic_review_status: 'perfect',
      verified_at: new Date().toISOString()
    })
    .eq('id', '13a2ed61-d873-47c3-9adb-9a855cb61d20');

  if (err2) console.log('  Error:', err2.message);
  else console.log('  ✅ Explicación actualizada');

  // 3. Mejorar explicación Art. 18 RGPD (996037f3)
  console.log('\n3. Mejorando explicación pregunta 996037f3 (Art. 18 RGPD)...');

  const newExplanation18 = `**Art. 18 RGPD - Derecho a la limitación del tratamiento**

El interesado tiene derecho a obtener la limitación del tratamiento cuando concurra ALGUNA de estas circunstancias:
• a) Impugne la exactitud de los datos (durante verificación)
• b) Tratamiento ilícito y se oponga a la supresión
• c) Responsable ya no necesita los datos, pero el interesado sí (para reclamaciones)
• d) Se haya opuesto al tratamiento (mientras se verifica)

La pregunta pide señalar qué condición NO es necesaria. Analizando las opciones:
• A) El interesado necesita los datos para reclamaciones → SÍ está en art. 18.1.c
• B) El responsable ya no necesita los datos → SÍ está en art. 18.1.c
• C) Impugne la inexactitud durante plazo de verificación → SÍ está en art. 18.1.a
• D) Tratamiento ilícito y se oponga a la supresión → SÍ está en art. 18.1.b

NOTA: Las 4 opciones aparecen en el artículo. La opción C se considera la respuesta porque añade "durante un plazo que permita al responsable verificar", lo cual es correcto pero complementa la condición.`;

  const { error: err3 } = await supabase
    .from('questions')
    .update({
      explanation: newExplanation18,
      topic_review_status: 'bad_explanation', // Mantener como problemática porque la pregunta en sí puede ser confusa
      verified_at: new Date().toISOString()
    })
    .eq('id', '996037f3-61f5-47d6-8bdc-c4ac42d0c186');

  if (err3) console.log('  Error:', err3.message);
  else console.log('  ✅ Explicación actualizada');

  // 4. Marcar las 3 preguntas de Art. 4 como "perfect" (Haiku se equivocó)
  console.log('\n4. Corrigiendo estado de preguntas Art. 4 LO 3/2018 (Haiku se equivocó)...');

  const art4Questions = [
    'e8211275-e7f5-44f3-9c55-85f4b3fe76d2',
    '4fec736b-9187-4d80-bd0f-969817bce67d',
    'f6ca2391-27fa-469a-8418-d6c243807a85'
  ];

  const newExplanationArt4 = `**Art. 4 LO 3/2018 - Exactitud de los datos**

El art. 4.2 establece cuándo NO es imputable la inexactitud al responsable:
• a) Datos obtenidos directamente del afectado
• b) Datos de un mediador/intermediario
• c) Datos de otro responsable (portabilidad)
• d) Datos de un registro público
• e) Datos de otra Administración pública

"Materia clasificada" NO aparece en esta lista de excepciones.

Por lo tanto, si los datos se obtienen de una "materia clasificada", la inexactitud SÍ SERÁ IMPUTABLE al responsable del tratamiento.

La respuesta correcta es la opción que menciona "materia clasificada" porque es el único supuesto donde SÍ es imputable.`;

  for (const qId of art4Questions) {
    const { error } = await supabase
      .from('questions')
      .update({
        explanation: newExplanationArt4,
        topic_review_status: 'perfect',
        verified_at: new Date().toISOString()
      })
      .eq('id', qId);

    if (error) console.log(`  Error en ${qId.substring(0,8)}:`, error.message);
    else console.log(`  ✅ ${qId.substring(0,8)} marcada como perfect`);
  }

  // 5. Actualizar ai_verification_results para las preguntas Art. 4
  console.log('\n5. Actualizando ai_verification_results...');

  for (const qId of art4Questions) {
    const { error } = await supabase
      .from('ai_verification_results')
      .update({
        answer_ok: true,
        explanation_ok: true,
        explanation: 'Verificación corregida: La respuesta "materia clasificada" es CORRECTA porque no está en las excepciones del art. 4.2 LO 3/2018. Haiku interpretó mal la lógica de la pregunta.',
        verified_at: new Date().toISOString()
      })
      .eq('question_id', qId);

    if (error) console.log(`  Error en ${qId.substring(0,8)}:`, error.message);
    else console.log(`  ✅ ${qId.substring(0,8)} resultado corregido`);
  }

  // 6. Actualizar ai_verification_results para 8e1f3025
  console.log('\n6. Actualizando ai_verification_result para 8e1f3025...');

  const { error: err6 } = await supabase
    .from('ai_verification_results')
    .update({
      article_ok: true,
      answer_ok: true,
      explanation_ok: true,
      article_id: 'b7186672-daef-4a21-baee-24d708c58a73',
      explanation: 'Artículo corregido de RD 203/2021 Art. 38 a Ley 39/2015 Art. 6. La pregunta trata sobre apoderamiento apud acta (art. 6.5).',
      verified_at: new Date().toISOString()
    })
    .eq('question_id', '8e1f3025-1608-424e-8ed3-20436c9851ac');

  if (err6) console.log('  Error:', err6.message);
  else console.log('  ✅ Resultado actualizado');

  // 7. Actualizar ai_verification_results para 13a2ed61
  console.log('\n7. Actualizando ai_verification_result para 13a2ed61...');

  const { error: err7 } = await supabase
    .from('ai_verification_results')
    .update({
      explanation_ok: true,
      explanation: 'Explicación mejorada para incluir los requisitos del art. 21 RGPD: motivos relacionados con situación particular.',
      verified_at: new Date().toISOString()
    })
    .eq('question_id', '13a2ed61-d873-47c3-9adb-9a855cb61d20');

  if (err7) console.log('  Error:', err7.message);
  else console.log('  ✅ Resultado actualizado');

  console.log('\n=== CORRECCIONES COMPLETADAS ===');

  // Resumen
  console.log('\nResumen:');
  console.log('• 8e1f3025: Artículo cambiado a Art. 6 Ley 39/2015');
  console.log('• 13a2ed61: Explicación mejorada (Art. 21 RGPD)');
  console.log('• 996037f3: Explicación mejorada (Art. 18 RGPD)');
  console.log('• e8211275, 4fec736b, f6ca2391: Marcadas como perfect (Haiku se equivocó)');
})();
