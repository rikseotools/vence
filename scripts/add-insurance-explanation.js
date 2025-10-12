import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addInsuranceExplanation() {
  const questionId = '21eb8c08-4a18-4191-af9a-0704fc44632b';
  
  console.log('📋 Agregando explicación rica para pregunta de seguros...');
  
  // Obtener datos actuales de la pregunta
  const { data: currentData, error: fetchError } = await supabase
    .from('psychometric_questions')
    .select('content_data')
    .eq('id', questionId)
    .single();
    
  if (fetchError) {
    console.error('❌ Error obteniendo pregunta:', fetchError);
    return;
  }
  
  // Crear explanation_sections rica
  const explanationSections = [
    {
      title: "💡 ¿Qué evalúa este ejercicio?",
      content: "Tu capacidad para analizar múltiples criterios simultáneamente y aplicar filtros complejos a datos estructurados. Esta habilidad es fundamental en tareas administrativas."
    },
    {
      title: "📊 ANÁLISIS PASO A PASO:",
      content: "📋 Datos del seguro a analizar:\n\n• Tipo: VIDA\n• Fecha: 22/10/2016\n• Cantidad: 1000 EUROS\n\n\n📋 Evaluación por columna:\n\n🔸 COLUMNA A - Criterios:\n• Tipos: incendios O accidentes ❌ (es vida)\n• Cantidad: 1500-4500€ ❌ (1000€ está fuera del rango)\n• Fechas: 15/03/2016 - 10/05/2017 ✅ (22/10/2016 está dentro)\n• RESULTADO A: NO CUMPLE ❌\n\n🔸 COLUMNA B - Criterios:\n• Tipos: vida O accidentes ✅ (es vida)\n• Cantidad: hasta 3000€ ✅ (1000€ ≤ 3000€)\n• Fechas: 15/10/2016 - 20/08/2017 ✅ (22/10/2016 está dentro)\n• RESULTADO B: SÍ CUMPLE ✅\n\n🔸 COLUMNA C - Criterios:\n• Tipos: incendios O vida ✅ (es vida)\n• Cantidad: 2000-5000€ ❌ (1000€ está por debajo)\n• Fechas: 10/02/2016 - 15/06/2017 ✅ (22/10/2016 está dentro)\n• RESULTADO C: NO CUMPLE ❌"
    },
    {
      title: "⚡ TÉCNICAS RÁPIDAS PARA EXÁMENES:",
      content: "🔍 Método 1: Descarte por tipo\nComienza eliminando columnas que no incluyan el tipo de seguro. En este caso, elimina la columna A (incendios/accidentes).\n\n💰 Método 2: Verificación de rangos\nRevisa rápidamente los rangos de cantidad. Si un valor está fuera del rango, descarta esa columna inmediatamente.\n\n📅 Método 3: Comprobación de fechas\nConvierte las fechas a formato comparable: 22/10/2016 = 2016-10-22, y verifica si está dentro de cada rango.\n\n⚡ Método 4: Todos los criterios\nRecuerda: TODOS los criterios de una columna deben cumplirse. Si falla uno, descarta esa columna."
    },
    {
      title: "❌ Errores comunes a evitar:",
      content: "• NO verificar solo el tipo de seguro (debe cumplir TODOS los criterios)\n• NO convertir correctamente las fechas al formato adecuado\n• NO comprobar los rangos de cantidad (inclusive vs exclusivo)\n• NO leer cuidadosamente si es \"hasta\" (≤) o \"desde-hasta\" (rango específico)\n• NO verificar que TODOS los criterios de una columna se cumplan simultáneamente"
    },
    {
      title: "💪 Consejo de oposición:",
      content: "En exámenes de oposiciones, este tipo de ejercicios evalúan tu capacidad de procesamiento de información administrativa. Practica leyendo criterios complejos y aplicándolos sistemáticamente. La clave es ser metódico: evalúa criterio por criterio, columna por columna."
    }
  ];
  
  // Actualizar content_data manteniendo los datos existentes
  const updatedContentData = {
    ...currentData.content_data,
    explanation_sections: explanationSections
  };
  
  const { data, error } = await supabase
    .from('psychometric_questions')
    .update({ 
      content_data: updatedContentData
    })
    .eq('id', questionId)
    .select();
    
  if (error) {
    console.error('❌ Error actualizando pregunta:', error);
  } else {
    console.log('✅ Explicación rica agregada exitosamente');
    console.log('📊 5 secciones creadas:');
    console.log('- 💡 Evaluación del ejercicio');
    console.log('- 📊 Análisis paso a paso');
    console.log('- ⚡ Técnicas rápidas');
    console.log('- ❌ Errores comunes');
    console.log('- 💪 Consejo de oposición');
    console.log('');
    console.log('🔗 Verificar:');
    console.log(`   http://localhost:3000/debug/question/${questionId}`);
  }
}

addInsuranceExplanation().catch(console.error);