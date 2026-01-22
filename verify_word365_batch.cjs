require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const VERIFICADOR_ID = '00000000-0000-0000-0000-000000000001';

const verificaciones = [
  {
    question_id: 'f1a1f51d-9475-4bea-a71c-1a240b60d51a',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: No se encontró documentación oficial de Microsoft en español que confirme que hacer doble clic en "Copiar formato" permite aplicarlo a múltiples fragmentos no consecutivos. Aunque esta funcionalidad existe, falta fuente oficial en ES.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: 'd9165445-b880-4035-bdc6-b651c2675336',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: Aunque es correcto que para conservar la plantilla original hay que cambiar el nombre del archivo, no se encontró documentación oficial de Microsoft en español que lo confirme explícitamente.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: '13d9573a-41bf-45db-b599-24c7716ab8cb',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La respuesta es correcta (Archivo > Guardar como > Tipo), pero no se encontró fuente oficial de Microsoft en español que lo documente específicamente.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_answer',
    needs_source_review: true
  },
  {
    question_id: '567965ce-1a69-4a0b-a13a-e09a1065d7ec',
    is_verified: true,
    has_official_source: true,
    verification_notes: 'VERIFICADO PARCIALMENTE: La fuente oficial (https://support.microsoft.com/es-es/office/realizar-un-seguimiento-de-los-cambios-en-word-197ba630-0f5f-4a8e-9a77-3712475e806a) menciona "Imprimir marcas" en Archivo > Configuración de impresión, pero la pregunta habla de "Imprimir documento con revisiones" que es una nomenclatura ligeramente diferente.',
    verification_sources: '["https://support.microsoft.com/es-es/office/realizar-un-seguimiento-de-los-cambios-en-word-197ba630-0f5f-4a8e-9a77-3712475e806a"]',
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: '517f353e-14eb-45e5-a33c-3dbb3392c2aa',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La respuesta correcta (D - Comentarios del autor) es lógicamente correcta, ya que los comentarios no son marcas de formato sino elementos de revisión. Sin embargo, no se encontró documentación oficial de Microsoft en español que liste explícitamente qué elementos NO se muestran.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: '279f019e-edef-41a5-859d-979bee15cd62',
    is_verified: true,
    has_official_source: true,
    verification_notes: 'VERIFICADO: La fuente oficial (https://learn.microsoft.com/es-es/deployoffice/compat/office-file-format-reference) confirma que .dotm es "Plantilla habilitada para macros de Word" para Word 2019, 2016, 2013, 2010 y Office Word 2007 que contiene macros. Respuesta A CORRECTA.',
    verification_sources: '["https://learn.microsoft.com/es-es/deployoffice/compat/office-file-format-reference"]',
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'verified',
    needs_source_review: false
  },
  {
    question_id: 'cb35f5f1-34f1-4fec-a535-9b15a9280bf1',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La explicación menciona "Archivo > Guardar como > Este PC > Plantilla de Word" pero no se encontró fuente oficial de Microsoft en español que confirme este procedimiento exacto.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: '508a950d-4da5-40ad-94d1-c70ce162584a',
    is_verified: false,
    has_official_source: true,
    verification_notes: 'ERROR DETECTADO: La fuente oficial (https://support.microsoft.com/es-es/office/seleccionar-texto-5ae24034-1c93-4805-bc2d-00aaf6235c97) menciona Ctrl+E como método principal para seleccionar todo, pero NO menciona el triple clic en margen izquierdo. La respuesta D podría ser incorrecta.',
    verification_sources: '["https://support.microsoft.com/es-es/office/seleccionar-texto-5ae24034-1c93-4805-bc2d-00aaf6235c97"]',
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_answer',
    needs_source_review: true,
    flagged_for_review: true
  },
  {
    question_id: '649e3bde-71d8-4260-b6cd-1876f0ca601d',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La respuesta D menciona hacer clic en el nombre del archivo > Historial de versiones, pero no se encontró fuente oficial de Microsoft en español que confirme este procedimiento específico para Word 365 con autoguardado.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_answer',
    needs_source_review: true
  },
  {
    question_id: 'c9b61be9-2aa3-4067-b52a-b5378f9d8a9c',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La explicación sobre qué se conserva y pierde al guardar como RTF es técnicamente correcta, pero no se encontró documentación oficial de Microsoft en español que liste específicamente estas limitaciones del formato RTF.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: '210e1284-9bb2-4ce3-ac57-96e0979dfcb3',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La explicación sobre cómo Word redistribuye los espacios al justificar y ajustar el ancho de columna es correcta conceptualmente, pero no se encontró fuente oficial de Microsoft en español que lo confirme.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: 'd27ebf50-6040-401f-b86e-8f3544657441',
    is_verified: true,
    has_official_source: true,
    verification_notes: 'VERIFICADO: La fuente oficial (https://learn.microsoft.com/es-es/deployoffice/compat/office-file-format-reference) confirma que .dotm puede contener y ejecutar macros VBA, mientras que .dotx no. Respuesta D CORRECTA.',
    verification_sources: '["https://learn.microsoft.com/es-es/deployoffice/compat/office-file-format-reference"]',
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'verified',
    needs_source_review: false
  },
  {
    question_id: '0583b605-7650-45a7-9543-3fcc2b9e3904',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La respuesta B es correcta (Word no puede abrir .xlsx directamente), pero la fuente citada en la explicación es sobre EXCEL, no sobre Word. Se necesita fuente sobre formatos compatibles con WORD.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_answer',
    needs_source_review: true,
    flagged_for_review: true
  },
  {
    question_id: 'd353e414-6773-40d0-adde-d9065ece7937',
    is_verified: true,
    has_official_source: false,
    verification_notes: 'PROBLEMA: La respuesta D es correcta conceptualmente (el Comprobador de accesibilidad ayuda a detectar problemas para personas con discapacidad), pero no se encontró fuente oficial de Microsoft en español específica sobre esta herramienta en Word.',
    verification_sources: null,
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'tech_bad_explanation',
    needs_source_review: true
  },
  {
    question_id: '72604863-46e6-45b2-ba87-b11ffbf71095',
    is_verified: true,
    has_official_source: true,
    verification_notes: 'VERIFICADO: La fuente oficial (https://support.microsoft.com/es-es/office/buscar-y-reemplazar-texto-c6728c16-469e-43cd-afe4-7708c6c779b7) confirma que < marca "el principio de una palabra" y * representa "cualquier cadena de caracteres". <anti* es CORRECTO.',
    verification_sources: '["https://support.microsoft.com/es-es/office/buscar-y-reemplazar-texto-c6728c16-469e-43cd-afe4-7708c6c779b7"]',
    verified_by: VERIFICADOR_ID,
    topic_review_status: 'verified',
    needs_source_review: false
  }
];

async function main() {
  console.log('🔍 Iniciando verificación de 15 preguntas de Word 365...\n');

  let insertados = 0;
  let actualizados = 0;
  let errores = 0;

  for (const verificacion of verificaciones) {
    try {
      // Adaptar a los campos existentes de ai_verification_results usando UPSERT
      const { data: verificationData, error: verificationError } = await supabase
        .from('ai_verification_results')
        .upsert({
          question_id: verificacion.question_id,
          is_correct: verificacion.is_verified,
          confidence: verificacion.has_official_source ? 'alta' : 'media',
          explanation: verificacion.verification_notes,
          article_quote: verificacion.verification_sources,
          ai_provider: 'anthropic',
          ai_model: 'claude-sonnet-4-5',
          article_ok: null,
          answer_ok: verificacion.is_verified,
          explanation_ok: verificacion.has_official_source,
          verified_at: new Date().toISOString()
        }, {
          onConflict: 'question_id,ai_provider'
        })
        .select('id')
        .single();

      if (verificationError) {
        console.error('❌ Error insertando:', verificationError.message);
        errores++;
        continue;
      }

      insertados++;

      const { error: updateError } = await supabase
        .from('questions')
        .update({
          topic_review_status: verificacion.topic_review_status,
          verified_at: new Date().toISOString()
        })
        .eq('id', verificacion.question_id);

      if (updateError) {
        console.error('❌ Error actualizando:', updateError.message);
        errores++;
      } else {
        actualizados++;
        const idCorto = verificacion.question_id.substring(0, 8);
        const estado = verificacion.is_verified && verificacion.has_official_source ? '✅' :
                      verificacion.is_verified && !verificacion.has_official_source ? '⚠️' : '❌';
        const fuenteES = verificacion.has_official_source ? 'sí' : 'no';
        console.log(estado + ' ' + idCorto + ' - ' + verificacion.topic_review_status + ' - Fuente: ' + fuenteES);
      }

    } catch (error) {
      console.error('❌ Error procesando:', error.message);
      errores++;
    }
  }

  console.log('\n📊 RESUMEN:');
  console.log('   ✅ Verificaciones insertadas: ' + insertados);
  console.log('   📝 Preguntas actualizadas: ' + actualizados);
  console.log('   ❌ Errores: ' + errores);
  console.log('\n📋 TABLA RESUMEN:');
  console.log('┌────────────┬────────┬────────────┐');
  console.log('│ ID (8char) │ Estado │ Fuente ES  │');
  console.log('├────────────┼────────┼────────────┤');

  verificaciones.forEach(v => {
    const idCorto = v.question_id.substring(0, 8);
    const estado = v.is_verified && v.has_official_source ? '✅' :
                  v.is_verified && !v.has_official_source ? '⚠️' : '❌';
    const fuenteES = v.has_official_source ? 'sí' : 'no';
    console.log('│ ' + idCorto + '   │ ' + estado + '     │ ' + fuenteES.padEnd(10) + ' │');
  });

  console.log('└────────────┴────────┴────────────┘');

  const verificadas = verificaciones.filter(v => v.is_verified && v.has_official_source).length;
  const sinFuente = verificaciones.filter(v => v.is_verified && !v.has_official_source).length;
  const incorrectas = verificaciones.filter(v => !v.is_verified).length;

  console.log('\n📈 ESTADÍSTICAS:');
  console.log('   ✅ Verificadas con fuente ES: ' + verificadas + '/15');
  console.log('   ⚠️  Correctas sin fuente ES: ' + sinFuente + '/15');
  console.log('   ❌ Incorrectas o dudosas: ' + incorrectas + '/15');
}

main().catch(console.error);
