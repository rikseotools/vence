require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function addQuestion() {
  const supabase = getSupabase();
  
  // Verificar que existe la Ley 19/2013
  const { data: laws, error: lawError } = await supabase
    .from('laws')
    .select('id, name')
    .ilike('name', '%19/2013%')
    .single();
    
  if (lawError || !laws) {
    console.log('❌ Error: No se encontró la Ley 19/2013 en la base de datos');
    process.exit(1);
  }
  
  console.log('✅ Ley encontrada:', laws.name, '(ID:', laws.id, ')');
  
  const questionData = {
    question_text: "Señale la afirmación correcta sobre el derecho de acceso a la información pública de acuerdo con lo establecido en la Ley 19/2013:",
    topic: "Transparencia, acceso a la información pública y buen gobierno",
    subtopic: "Ley 19/2013",
    option_a: "El derecho de acceso a la información pública podrá ser limitado cuando suponga un perjuicio para los intereses económicos y comerciales.",
    option_b: "La ausencia de motivación de las solicitudes de acceso a la información pública será causa de rechazo de la solicitud.",
    option_c: "La solicitud de acceso a la información pública se deberá presentar preferentemente por medios electrónicos.",
    option_d: "Cuando la solicitud no identifique de forma suficiente la información solicitada, se pedirá al solicitante que la concrete en el plazo de 15 días.",
    correct_answer: "a",
    explanation: "Según la Ley 19/2013, el derecho de acceso a la información pública podrá ser limitado cuando suponga un perjuicio para los intereses económicos y comerciales. Esta es la opción correcta según la respuesta proporcionada en el examen oficial.",
    difficulty: "medium",
    is_official: true,
    is_active: true,
    source: "Examen oficial Auxiliar Administrativo AGE - 2015",
    tags: ["ley 19/2013", "transparencia", "acceso información pública", "examen oficial", "age", "auxiliar administrativo"]
  };

  try {
    const { data, error } = await supabase
      .from('questions')
      .insert([questionData])
      .select();

    if (error) {
      console.log('❌ Error al insertar la pregunta:', error.message);
      throw error;
    }

    console.log('✅ Pregunta añadida exitosamente:', data[0].id);
    console.log('📝 Tema:', questionData.topic);
    console.log('🏷️  Subtema:', questionData.subtopic);
    console.log('📚 Fuente:', questionData.source);
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    process.exit(1);
  }
}

addQuestion();