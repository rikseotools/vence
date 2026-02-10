/**
 * Script para marcar cada pregunta del examen oficial con su parte (primera/segunda)
 *
 * Lee el JSON del examen y compara con las preguntas en la BD.
 * Actualiza el campo exam_source para incluir la parte.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Cargar JSON del examen
const examData = require('../data/examenes-oficiales/auxiliar-administrativo-estado/OEP-2023-2024/Convocatoria 9 julio 2024.json');

// Función para normalizar texto para comparación
function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/\s+/g, ' ')
    .replace(/[.,;:¿?¡!()""''«»\-–—]/g, '')
    .trim();
}

// Función para obtener los primeros N caracteres significativos
function getKey(text, len = 40) {
  return normalizeText(text).substring(0, len);
}

async function main() {
  console.log('=== MARCANDO PARTES DEL EXAMEN ===');
  console.log('');

  // 1. Obtener todas las preguntas del examen en la BD
  const { data: dbQuestions, error } = await supabase
    .from('questions')
    .select('id, question_text, exam_source')
    .eq('exam_date', '2024-07-09')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Preguntas en BD:', dbQuestions.length);

  // 2. Crear arrays de preguntas del JSON con texto normalizado
  const primeraParteQuestions = examData.primera_parte?.preguntas?.map(p => ({
    ...p,
    normalized: normalizeText(p.pregunta),
    key: getKey(p.pregunta)
  })) || [];

  const segundaParteQuestions = examData.segunda_parte?.preguntas?.map(p => ({
    ...p,
    normalized: normalizeText(p.pregunta),
    key: getKey(p.pregunta)
  })) || [];

  console.log('Primera parte JSON:', primeraParteQuestions.length);
  console.log('Segunda parte JSON:', segundaParteQuestions.length);
  console.log('');

  // 3. Clasificar cada pregunta de la BD
  let primeraCount = 0;
  let segundaCount = 0;
  let unknownCount = 0;
  const updates = [];

  for (const q of dbQuestions) {
    const dbNormalized = normalizeText(q.question_text);
    const dbKey = getKey(q.question_text);

    let parte = null;

    // Buscar en primera parte
    const foundInPrimera = primeraParteQuestions.find(jp =>
      jp.key === dbKey ||
      jp.normalized.includes(dbKey) ||
      dbNormalized.includes(jp.key)
    );

    if (foundInPrimera) {
      parte = 'primera';
      primeraCount++;
    } else {
      // Buscar en segunda parte
      const foundInSegunda = segundaParteQuestions.find(jp =>
        jp.key === dbKey ||
        jp.normalized.includes(dbKey) ||
        dbNormalized.includes(jp.key)
      );

      if (foundInSegunda) {
        parte = 'segunda';
        segundaCount++;
      } else {
        // Verificar si es una reserva (las reservas no están en el JSON principal)
        const examSource = q.exam_source || '';
        if (examSource.includes('Reserva')) {
          // Las reservas 1-2 son de primera parte, 3-5 de segunda parte (según el examen)
          const reservaMatch = examSource.match(/Reserva (\d+)/);
          if (reservaMatch) {
            const reservaNum = parseInt(reservaMatch[1]);
            // Reservas 1-2: primera parte (legislativas)
            // Reservas 3-5: segunda parte (ofimática/psicotécnicas)
            parte = reservaNum <= 2 ? 'primera' : 'segunda';
            if (parte === 'primera') primeraCount++;
            else segundaCount++;
            console.log(`📋 Reserva ${reservaNum} -> ${parte} parte`);
          }
        }

        // Preguntas actualizadas/adaptadas: clasificar por contenido
        if (!parte) {
          if (examSource.includes('Actualizada') || examSource.includes('Windows')) {
            // Preguntas de Windows actualizadas -> segunda parte (ofimática)
            parte = 'segunda';
            segundaCount++;
            console.log('🔄 Actualizada -> segunda parte');
          } else if (examSource.includes('Adaptada')) {
            // Preguntas adaptadas: determinar por contenido
            const text = q.question_text.toLowerCase();
            if (text.includes('gobierno abierto') || text.includes('ley 40/2015') ||
                text.includes('ley 39/2015') || text.includes('constitución') ||
                text.includes('tratado')) {
              parte = 'primera';
              primeraCount++;
              console.log('🔄 Adaptada -> primera parte');
            } else {
              parte = 'segunda';
              segundaCount++;
              console.log('🔄 Adaptada -> segunda parte');
            }
          } else {
            // Clasificar por contenido de la pregunta
            const text = q.question_text.toLowerCase();
            if (text.includes('ley 40/2015') || text.includes('ley 39/2015') ||
                text.includes('constitución') || text.includes('tratado') ||
                text.includes('gobierno abierto') || text.includes('ley 50/1997')) {
              parte = 'primera';
              primeraCount++;
              console.log('📌 Por contenido -> primera parte');
            } else {
              unknownCount++;
              console.log('❓ No encontrada:', q.question_text.substring(0, 60) + '...');
              console.log('   exam_source:', q.exam_source);
            }
          }
        }
      }
    }

    if (parte) {
      // Verificar si ya tiene la parte marcada en exam_source
      const currentSource = q.exam_source || '';
      const expectedSuffix = ` - ${parte === 'primera' ? 'Primera' : 'Segunda'} parte`;

      if (!currentSource.includes('parte')) {
        updates.push({
          id: q.id,
          parte,
          newSource: currentSource + expectedSuffix
        });
      }
    }
  }

  console.log('');
  console.log('=== RESULTADO ===');
  console.log('Primera parte:', primeraCount);
  console.log('Segunda parte:', segundaCount);
  console.log('No encontradas:', unknownCount);
  console.log('Actualizaciones pendientes:', updates.length);
  console.log('');

  // 4. Mostrar primeras actualizaciones para confirmar
  if (updates.length > 0) {
    console.log('=== EJEMPLOS DE ACTUALIZACIONES ===');
    updates.slice(0, 5).forEach(u => {
      console.log(`  ${u.parte}: ${u.newSource.substring(0, 80)}...`);
    });
    console.log('');
    console.log('Para aplicar las actualizaciones, ejecuta con --apply');
  }

  // 5. Aplicar si se pasa --apply
  if (process.argv.includes('--apply')) {
    console.log('');
    console.log('=== APLICANDO ACTUALIZACIONES ===');

    for (const u of updates) {
      const { error: updateError } = await supabase
        .from('questions')
        .update({ exam_source: u.newSource })
        .eq('id', u.id);

      if (updateError) {
        console.error('Error actualizando', u.id, ':', updateError);
      }
    }

    console.log('✅ Actualizadas', updates.length, 'preguntas');
  }
}

main();
