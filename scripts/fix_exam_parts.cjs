/**
 * Script para corregir las partes de las preguntas actualizadas
 * Las preguntas que fueron actualizadas (V Plan, Windows 11, etc.)
 * necesitan tener la parte correcta marcada
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mapeo de preguntas actualizadas a su parte original
const PRIMERA_PARTE_UPDATES = [
  'V Plan de Gobierno Abierto',  // Era P9 (IV Plan)
  'Tribunal de Justicia de la Unión Europea', // Era P14
  // Las de Ley 40/2015 ya deberían estar marcadas
];

const SEGUNDA_PARTE_UPDATES = [
  'Windows 11',  // Todas las de Windows 10 actualizadas
  'Explorador de archivos Windows 11',
  'Acceso rápido',
  'Historial de archivos',
  'Indexación',
];

async function main() {
  console.log('=== CORRIGIENDO PARTES DE PREGUNTAS ===\n');

  // Obtener todas las preguntas del examen sin parte marcada
  const { data, error } = await supabase
    .from('questions')
    .select('id, question_text, exam_source')
    .eq('exam_date', '2024-07-09')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  const updates = [];

  for (const q of data) {
    const source = q.exam_source || '';
    const text = q.question_text.toLowerCase();

    // Si ya tiene parte, verificar que sea correcta
    if (source.includes('Primera parte') || source.includes('Segunda parte')) {
      // Verificar si es Windows 11 y está marcada como primera (error)
      if (text.includes('windows 11') && source.includes('Primera parte')) {
        updates.push({
          id: q.id,
          oldPart: 'Primera',
          newPart: 'Segunda',
          reason: 'Windows 11 es segunda parte',
          text: q.question_text.substring(0, 50)
        });
      }
      continue;
    }

    // Determinar parte basándose en contenido
    let parte = null;

    // Primera parte
    if (text.includes('v plan de gobierno abierto') ||
        text.includes('tribunal de justicia de la unión') ||
        text.includes('ley 40/2015') && !text.includes('registro') ||
        text.includes('ley 39/2015') && !text.includes('registro')) {
      parte = 'primera';
    }
    // Segunda parte
    else if (text.includes('windows 11') ||
             text.includes('explorador de archivos') ||
             text.includes('acceso rápido') ||
             text.includes('historial de archivos') ||
             text.includes('excel') ||
             text.includes('word') ||
             text.includes('access') ||
             text.includes('outlook') ||
             text.includes('internet') ||
             text.includes('rd 366/2007') ||
             text.includes('real decreto 366/2007')) {
      parte = 'segunda';
    }

    if (parte) {
      const newSource = source.includes('parte')
        ? source
        : source + ` - ${parte === 'primera' ? 'Primera' : 'Segunda'} parte`;

      if (newSource !== source) {
        updates.push({
          id: q.id,
          oldSource: source,
          newSource: newSource,
          parte: parte,
          text: q.question_text.substring(0, 50)
        });
      }
    }
  }

  console.log('Actualizaciones necesarias:', updates.length);
  console.log('');

  updates.forEach((u, i) => {
    if (u.oldPart) {
      console.log(`${i+1}. CORREGIR: ${u.oldPart} -> ${u.newPart}`);
      console.log(`   ${u.text}...`);
    } else {
      console.log(`${i+1}. ${u.parte}: ${u.text}...`);
    }
  });

  if (process.argv.includes('--apply')) {
    console.log('\n=== APLICANDO ===');

    for (const u of updates) {
      if (u.oldPart) {
        // Corregir parte incorrecta
        const newSource = u.exam_source?.replace('Primera parte', 'Segunda parte');
        await supabase
          .from('questions')
          .update({ exam_source: newSource })
          .eq('id', u.id);
      } else {
        await supabase
          .from('questions')
          .update({ exam_source: u.newSource })
          .eq('id', u.id);
      }
    }

    console.log('✅ Actualizadas', updates.length, 'preguntas');
  } else {
    console.log('\nPara aplicar: node scripts/fix_exam_parts.cjs --apply');
  }
}

main();
