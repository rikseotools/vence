const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  // Buscar por texto de pregunta
  const { data: textLogs, error } = await supabase
    .from('ai_chat_logs')
    .select('id, created_at, message, full_response, had_discrepancy, ai_suggested_answer, db_answer, question_context_id')
    .ilike('message', '%E A X T Q%')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.log('Error:', error);
    return;
  }

  console.log('=== LOGS CON PREGUNTA "E A X T Q" ===');
  if (!textLogs || textLogs.length === 0) {
    console.log('No se encontraron logs');
    return;
  }

  textLogs.forEach(log => {
    console.log('\n======================================');
    console.log('Log ID:', log.id);
    console.log('Fecha:', log.created_at);
    console.log('Question Context ID:', log.question_context_id);
    console.log('\n=== MENSAJE DEL USUARIO ===');
    console.log(log.message);
    console.log('\n=== DISCREPANCIA ===');
    console.log('had_discrepancy:', log.had_discrepancy);
    console.log('ai_suggested_answer:', log.ai_suggested_answer);
    console.log('db_answer:', log.db_answer);
    console.log('\n=== RESPUESTA DE LA IA (primeros 500 chars) ===');
    console.log(log.full_response ? log.full_response.substring(0, 500) : '(sin respuesta)');
  });
}

main();
