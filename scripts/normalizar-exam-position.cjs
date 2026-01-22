/**
 * Script para normalizar y poblar exam_position en preguntas oficiales
 *
 * FASE 2 del ROADMAP-FIX-OFICIAL-POR-OPOSICION.md
 *
 * Acciones:
 * 1. Normalizar valores existentes de exam_position a formato estándar
 * 2. Poblar exam_position en preguntas que lo tienen NULL basándose en exam_source
 */
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Necesitamos permisos de escritura
);

// Mapeo de normalización: valor actual → valor normalizado
const NORMALIZATION_MAP = {
  'auxiliar administrativo del estado': 'auxiliar_administrativo_estado',
  'auxiliar administrativo': 'auxiliar_administrativo_estado',
  'auxiliar_administrativo': 'auxiliar_administrativo_estado',
  'Cuerpo General Administrativo de la Administración del Estado': 'cuerpo_general_administrativo',
  'cuerpo general administrativo de la administración del estado': 'cuerpo_general_administrativo',
  'Cuerpo de Gestión de la Administración Civil del Estado': 'cuerpo_gestion_administracion_civil',
  'cuerpo de gestión de la administración civil del estado': 'cuerpo_gestion_administracion_civil',
  'administrativo': 'cuerpo_general_administrativo',
  'tramitación procesal': 'tramitacion_procesal',
};

// Mapeo de patrones en exam_source → exam_position
const SOURCE_TO_POSITION = [
  { pattern: /Auxiliar Administrativo/i, position: 'auxiliar_administrativo_estado' },
  { pattern: /Auxiliar Admin/i, position: 'auxiliar_administrativo_estado' },
  { pattern: /BOE.*Auxiliar/i, position: 'auxiliar_administrativo_estado' },
  { pattern: /Examen Oficial AGE/i, position: 'auxiliar_administrativo_estado' },
  { pattern: /Tramitaci[oó]n Procesal/i, position: 'tramitacion_procesal' },
  { pattern: /Auxilio Judicial/i, position: 'auxilio_judicial' },
  { pattern: /Gesti[oó]n Procesal/i, position: 'gestion_procesal' },
  { pattern: /Cuerpo General Administrativo/i, position: 'cuerpo_general_administrativo' },
  { pattern: /Cuerpo de Gesti[oó]n/i, position: 'cuerpo_gestion_administracion_civil' },
];

async function normalizeAndPopulate() {
  console.log('=== NORMALIZACIÓN Y POBLACIÓN DE exam_position ===\n');

  // 1. Obtener todas las preguntas oficiales
  const { data: questions, error } = await supabase
    .from('questions')
    .select('id, exam_position, exam_source')
    .eq('is_official_exam', true);

  if (error) {
    console.error('❌ Error obteniendo preguntas:', error);
    return;
  }

  console.log(`📊 Total preguntas oficiales: ${questions.length}`);

  let normalizedCount = 0;
  let populatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;
  const updates = [];

  for (const q of questions) {
    let newExamPosition = null;
    let action = null;

    // PASO 1: Si tiene exam_position, ver si necesita normalización
    if (q.exam_position) {
      const normalizedValue = NORMALIZATION_MAP[q.exam_position.toLowerCase()];
      if (normalizedValue && normalizedValue !== q.exam_position) {
        newExamPosition = normalizedValue;
        action = 'normalizar';
      } else if (normalizedValue === q.exam_position) {
        // Ya está normalizado
        unchangedCount++;
        continue;
      } else {
        // Valor no reconocido pero existe
        unchangedCount++;
        continue;
      }
    } else {
      // PASO 2: exam_position es NULL, intentar derivar de exam_source
      if (q.exam_source) {
        for (const mapping of SOURCE_TO_POSITION) {
          if (mapping.pattern.test(q.exam_source)) {
            newExamPosition = mapping.position;
            action = 'poblar';
            break;
          }
        }
      }
    }

    if (newExamPosition) {
      updates.push({
        id: q.id,
        exam_position: newExamPosition,
        action,
        original: q.exam_position || 'NULL',
        source: q.exam_source
      });
    }
  }

  console.log(`\n📋 Cambios a realizar:`);
  console.log(`   - Normalizar: ${updates.filter(u => u.action === 'normalizar').length}`);
  console.log(`   - Poblar: ${updates.filter(u => u.action === 'poblar').length}`);
  console.log(`   - Sin cambios: ${unchangedCount}`);

  // Mostrar algunos ejemplos de cada tipo
  const normalizeExamples = updates.filter(u => u.action === 'normalizar').slice(0, 5);
  const populateExamples = updates.filter(u => u.action === 'poblar').slice(0, 5);

  if (normalizeExamples.length > 0) {
    console.log('\n📝 Ejemplos de normalización:');
    normalizeExamples.forEach(u => {
      console.log(`   "${u.original}" → "${u.exam_position}"`);
    });
  }

  if (populateExamples.length > 0) {
    console.log('\n📝 Ejemplos de población (desde exam_source):');
    populateExamples.forEach(u => {
      console.log(`   exam_source: "${u.source?.substring(0, 50)}..."`);
      console.log(`   exam_position: ${u.exam_position}`);
    });
  }

  // Preguntar confirmación
  if (process.argv.includes('--execute')) {
    console.log('\n⏳ Ejecutando actualizaciones...');

    for (const update of updates) {
      const { error } = await supabase
        .from('questions')
        .update({
          exam_position: update.exam_position,
          updated_at: new Date().toISOString()
        })
        .eq('id', update.id);

      if (error) {
        console.log(`❌ Error actualizando ${update.id}:`, error.message);
        errorCount++;
      } else {
        if (update.action === 'normalizar') normalizedCount++;
        else populatedCount++;
      }
    }

    console.log('\n=== RESUMEN ===');
    console.log(`✅ Normalizados: ${normalizedCount}`);
    console.log(`✅ Poblados: ${populatedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
  } else {
    console.log('\n⚠️  Modo DRY-RUN: No se hicieron cambios');
    console.log('    Ejecuta con --execute para aplicar cambios');
  }
}

normalizeAndPopulate().catch(console.error);
