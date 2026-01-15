/**
 * Script para importar preguntas oficiales de informática
 * Examen Auxiliar Administrativo del Estado - Septiembre 2023
 * Fuente: INAP (plantilla definitiva)
 * Convocatoria: OEP 2021-2022
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function importQuestions() {
  console.log('🚀 Importando preguntas oficiales - Examen AUX 2023\n');

  // Leer JSON
  const data = JSON.parse(
    fs.readFileSync('./scripts/data/examen_aux_2023_informatica.json', 'utf8')
  );

  const metadata = data.metadata;
  console.log('📋 Metadata del examen:');
  console.log('   Fuente:', metadata.source);
  console.log('   Fecha:', metadata.exam_date);
  console.log('   Plantilla:', metadata.plantilla);
  console.log('   Convocatoria:', metadata.convocatoria);
  console.log('   Total preguntas:', data.questions.length);
  console.log('');

  let imported = 0;
  let skipped = 0;
  let updated = 0;
  let errors = 0;

  // Mapeo de categorías a artículos virtuales (mismo que 2024)
  const ARTICULOS_POR_CATEGORIA = {
    'excel': 'c295b0f2-e56e-490a-b4c3-e50f8cbe6a16',      // Hojas de cálculo - Utilidades
    'word': '398b7a90-110b-4a6f-9875-cc332932a758',       // Procesadores de texto - Funcionalidades
    'access': '2fd741a4-26af-439c-a8c1-b2507f6e4cb5',     // Base de datos Access - Funciones
    'outlook': 'b7a10d7f-9453-4b89-974c-eb5138aec1d2',    // Correo electrónico - Conceptos
    'windows': '514fe942-d773-4ef0-9812-c759e84f93a1',    // Windows 11 - Fundamentos
    'internet': 'f85c3c54-1e67-417d-a3e5-a1d911acfa02',   // Conceptos fundamentales informática
    'informatica_basica': 'f85c3c54-1e67-417d-a3e5-a1d911acfa02',
    'hardware': 'f85c3c54-1e67-417d-a3e5-a1d911acfa02'
  };

  for (const q of data.questions) {
    // Verificar si ya existe (por texto similar)
    const { data: existing } = await supabase
      .from('questions')
      .select('id, is_official_exam')
      .ilike('question_text', q.question_text.substring(0, 50) + '%')
      .limit(1);

    if (existing && existing.length > 0) {
      // Si existe pero no tiene metadatos oficiales, actualizarla
      if (!existing[0].is_official_exam) {
        const { error: updateError } = await supabase
          .from('questions')
          .update({
            is_official_exam: true,
            exam_source: 'BOE - Examen Auxiliar Administrativo Estado septiembre 2023',
            exam_date: '2023-09-16',
            exam_entity: 'INAP - Administración General del Estado',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing[0].id);

        if (updateError) {
          console.log('❌ Error actualizando', q.id_examen + ':', updateError.message);
          errors++;
        } else {
          console.log('📝 Actualizada con metadatos:', q.id_examen);
          updated++;
        }
      } else {
        console.log('⏭️  Ya existe:', q.id_examen);
        skipped++;
      }
      continue;
    }

    const articuloId = ARTICULOS_POR_CATEGORIA[q.category] || ARTICULOS_POR_CATEGORIA['informatica_basica'];

    // Preparar pregunta para insertar
    const questionData = {
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      explanation: generarExplicacion(q),
      difficulty: 'medium',
      question_type: 'single',
      is_active: true,
      is_official_exam: true,
      exam_source: 'BOE - Examen Auxiliar Administrativo Estado septiembre 2023',
      exam_date: '2023-09-16',
      exam_entity: 'INAP - Administración General del Estado',
      primary_article_id: articuloId,
      tags: [q.category, 'ofimatica', 'informatica', 'auxiliar_administrativo', '2023'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('questions')
      .insert(questionData);

    if (error) {
      console.log('❌ Error en', q.id_examen + ':', error.message);
      errors++;
    } else {
      console.log('✅ Importada:', q.id_examen, '-', q.question_text.substring(0, 50) + '...');
      imported++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 RESUMEN DE IMPORTACIÓN');
  console.log('='.repeat(50));
  console.log('✅ Importadas:', imported);
  console.log('📝 Actualizadas (metadatos):', updated);
  console.log('⏭️  Saltadas (ya existían):', skipped);
  console.log('❌ Errores:', errors);
  console.log('📝 Total procesadas:', data.questions.length);
}

function generarExplicacion(q) {
  const letras = ['A', 'B', 'C', 'D'];
  const opciones = [q.option_a, q.option_b, q.option_c, q.option_d];
  const correcta = letras[q.correct_option];
  const textoCorrect = opciones[q.correct_option];

  let explicacion = `La respuesta correcta es ${correcta}) ${textoCorrect}. `;

  // Añadir contexto según categoría
  switch (q.category) {
    case 'excel':
      explicacion += 'Esta funcionalidad de Excel 2019 es fundamental para el trabajo con hojas de cálculo en la Administración.';
      break;
    case 'word':
      explicacion += 'Microsoft Word 2019 ofrece esta característica para facilitar la edición de documentos oficiales.';
      break;
    case 'access':
      explicacion += 'En Access 2019, esta funcionalidad permite gestionar bases de datos de manera eficiente.';
      break;
    case 'outlook':
      explicacion += 'Outlook 2019 proporciona esta capacidad para optimizar la gestión del correo electrónico y calendario.';
      break;
    case 'windows':
      explicacion += 'Windows 10 incluye esta funcionalidad como parte de sus herramientas de sistema.';
      break;
    case 'internet':
      explicacion += 'Este concepto es esencial para comprender el funcionamiento de Internet y los servicios web.';
      break;
    case 'hardware':
      explicacion += 'Este componente de hardware es fundamental en la arquitectura de los equipos informáticos.';
      break;
    default:
      explicacion += 'Este concepto es parte del temario de informática para oposiciones de la Administración General del Estado.';
  }

  explicacion += ' [Pregunta oficial del examen de Auxiliar Administrativo del Estado, septiembre 2023]';

  return explicacion;
}

importQuestions()
  .then(() => {
    console.log('\n✨ Proceso completado');
    process.exit(0);
  })
  .catch(err => {
    console.error('💥 Error fatal:', err);
    process.exit(1);
  });
