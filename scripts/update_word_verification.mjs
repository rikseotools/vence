import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Datos de verificación basados en búsqueda en Microsoft Support oficial
const verificaciones = [
  {
    question_id: '1779e1ab-0b23-47b8-85ba-aaee6b63c9f6', // WordArt
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado en Microsoft Support: WordArt se inserta desde pestaña Insert > WordArt. Respuesta correcta: A) Insertar.'
  },
  {
    question_id: '24b7dca8-7ea9-4b83-9143-c319e73369e1', // Número de página
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado en Microsoft Support: El número de página se inserta desde Insert > Page Numbers. Respuesta correcta: A) Insertar - Número de Página'
  },
  {
    question_id: '4362e46a-dcd9-4378-9637-2efaf00b8c80', // Cuadro de texto
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado en Microsoft Support: El cuadro de texto se inserta desde pestaña Insert (Insertar) > Text Box. Respuesta correcta: C) Insertar'
  },
  {
    question_id: '557ddc62-ab17-407b-9ecc-8b8e5b510126', // Convertir tabla a texto
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado: En Word, para convertir tabla a texto se usa Table Tools > Layout > Convert > Convert Table to Text. Respuesta correcta: B) Disposición de Tabla'
  },
  {
    question_id: '6230efe2-b0e4-4a49-8132-a45d2011b333', // Fórmula en tabla
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado: Las fórmulas en Word se insertan desde Table Tools > Layout > Formula. Respuesta correcta: C) Disposición de tabla > Datos > Fórmula'
  },
  {
    question_id: '692bd4e3-c1bc-4905-8e85-a97deab8a077', // Combinar celdas
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado: Al combinar celdas en Word, estas se fusionan en una sola celda. Respuesta correcta: D) Las celdas seleccionadas se fusionan en una sola celda'
  },
  {
    question_id: '7ce20362-1cfb-46ad-910c-c0b681d491c9', // Dividir tabla
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado: Para dividir una tabla en Word se usa Table Tools > Layout > Split Table. Respuesta correcta: C) Dividir tabla'
  },
  {
    question_id: '8b8a5737-d913-4a5e-a194-e630a2361aa6', // Interlineado tabla
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado: Para cambiar interlineado en tabla se selecciona la tabla y desde Home (Inicio) > Paragraph (Párrafo) > Line Spacing. Respuesta correcta: A)'
  },
  {
    question_id: '8d13ec26-6f44-4055-bbd8-e1916b50eeeb', // Herramienta Lápiz
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado: La herramienta Lápiz en la ficha Dibujar permite dibujar líneas o formas a mano alzada. Respuesta correcta: C)'
  },
  {
    question_id: 'b654ef0f-7e41-401d-af99-725aeec66df9', // Elementos Rápidos
    ai_provider: 'microsoft_docs_verification',
    confidence: 'high',
    answer_ok: true,
    explanation_ok: true,
    explanation: 'Verificado: Los Elementos Rápidos contienen bloques de contenido reutilizables guardados previamente. Respuesta correcta: D)'
  }
];

(async () => {
  console.log('🔍 Actualizando resultados de verificación...\n');

  for (const verif of verificaciones) {
    const { error } = await supabase
      .from('ai_verification_results')
      .update({
        confidence: verif.confidence,
        answer_ok: verif.answer_ok,
        explanation_ok: verif.explanation_ok,
        explanation: verif.explanation,
        verified_at: new Date().toISOString()
      })
      .eq('question_id', verif.question_id)
      .eq('ai_provider', verif.ai_provider);

    if (error) {
      console.error(`❌ Error actualizando ${verif.question_id}:`, error);
    } else {
      console.log(`✅ Verificada pregunta con confidence: ${verif.confidence}`);
    }
  }

  console.log(`\n✅ Actualizadas ${verificaciones.length} preguntas\n`);

  // Obtener estadísticas finales
  const { data: stats } = await supabase
    .from('ai_verification_results')
    .select('confidence', { count: 'exact' })
    .eq('ai_provider', 'microsoft_docs_verification');

  const highCount = stats?.filter(s => s.confidence === 'high').length || 0;
  const lowCount = stats?.filter(s => s.confidence === 'low').length || 0;
  const pendingCount = stats?.filter(s => s.confidence === 'pending').length || 0;

  console.log('═════════════════════════════════════════════════════════════════');
  console.log('📊 ESTADÍSTICAS DE VERIFICACIÓN - BATCH 8');
  console.log('═════════════════════════════════════════════════════════════════');
  console.log(`✅ Verificadas (high): ${highCount}`);
  console.log(`❌ Con discrepancias (low): ${lowCount}`);
  console.log(`⏳ Pendientes: ${pendingCount}`);
  console.log(`📊 Total: ${stats?.length || 0}`);
  console.log('═════════════════════════════════════════════════════════════════\n');
})();
