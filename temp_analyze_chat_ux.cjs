require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  // Obtener todas las conversaciones
  const { data: logs } = await supabase
    .from('ai_chat_logs')
    .select('*')
    .gte('created_at', fiveDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  console.log('🔍 ANÁLISIS DE UX Y CALIDAD DE CONVERSACIONES');
  console.log('═══════════════════════════════════════════════\n');

  // 1. Conversaciones del mismo usuario en secuencia
  console.log('📊 1. PATRONES DE USO:\n');
  const userConversations = {};
  logs.forEach(log => {
    if (!userConversations[log.user_id]) {
      userConversations[log.user_id] = [];
    }
    userConversations[log.user_id].push(log);
  });

  const usersWithMultipleConvs = Object.entries(userConversations)
    .filter(([userId, convs]) => convs.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`- Usuarios únicos: ${Object.keys(userConversations).length}`);
  console.log(`- Usuarios con múltiples conversaciones: ${usersWithMultipleConvs.length}`);
  console.log(`- Conversaciones promedio por usuario: ${(logs.length / Object.keys(userConversations).length).toFixed(1)}`);
  console.log(`- Usuario más activo: ${usersWithMultipleConvs[0][1].length} conversaciones\n`);

  // 2. Mensajes libres vs sugerencias
  const freeMessages = logs.filter(l => !l.suggestion_used);
  console.log('💬 2. TIPO DE INTERACCIONES:\n');
  console.log(`- Desde sugerencias: ${logs.length - freeMessages.length} (${Math.round((logs.length - freeMessages.length) / logs.length * 100)}%)`);
  console.log(`- Mensajes libres: ${freeMessages.length} (${Math.round(freeMessages.length / logs.length * 100)}%)\n`);

  // 3. Ejemplos de mensajes libres
  console.log('✍️ 3. EJEMPLOS DE MENSAJES LIBRES (sin sugerencia):\n');
  freeMessages.slice(0, 10).forEach((log, idx) => {
    console.log(`${idx + 1}. Usuario: "${log.message}"`);
    console.log(`   IA: "${log.full_response?.substring(0, 150)}..."\n`);
  });

  // 4. Feedback negativo detallado
  const negativeFeedback = logs.filter(l => l.feedback === 'negative');
  if (negativeFeedback.length > 0) {
    console.log('❌ 4. FEEDBACK NEGATIVO DETALLADO:\n');
    negativeFeedback.forEach((log, idx) => {
      console.log(`${idx + 1}. Usuario preguntó: "${log.message}"`);
      console.log(`   IA respondió: "${log.full_response}"`);
      console.log(`   Comentario: ${log.feedback_comment || 'Sin comentario'}\n`);
    });
  }

  // 5. Tiempo de respuesta
  const suggestionResponses = logs.filter(l => l.suggestion_used && l.response_time_ms);
  const freeResponses = logs.filter(l => !l.suggestion_used && l.response_time_ms);

  console.log('⏱️ 5. TIEMPOS DE RESPUESTA:\n');
  const avgSuggestion = suggestionResponses.reduce((sum, l) => sum + l.response_time_ms, 0) / suggestionResponses.length;
  const avgFree = freeResponses.reduce((sum, l) => sum + l.response_time_ms, 0) / freeResponses.length;
  console.log(`- Promedio con sugerencia: ${Math.round(avgSuggestion)}ms (${(avgSuggestion/1000).toFixed(1)}s)`);
  console.log(`- Promedio mensaje libre: ${Math.round(avgFree)}ms (${(avgFree/1000).toFixed(1)}s)`);
  console.log(`- Más lento: ${Math.max(...logs.map(l => l.response_time_ms || 0))}ms`);
  console.log(`- Más rápido: ${Math.min(...logs.filter(l => l.response_time_ms).map(l => l.response_time_ms))}ms\n`);

  // 6. Análisis de calidad de contenido
  console.log('📝 6. ANÁLISIS DE CALIDAD:\n');

  // Respuestas con emojis apropiados
  const withCheckmark = logs.filter(l => l.full_response?.includes('✅'));
  console.log(`- Respuestas con ✅ (buena señal visual): ${withCheckmark.length} (${Math.round(withCheckmark.length/logs.length*100)}%)`);

  // Respuestas con estructura clara (con ###)
  const withStructure = logs.filter(l => l.full_response?.includes('###') || l.full_response?.includes('📖'));
  console.log(`- Respuestas con estructura clara: ${withStructure.length} (${Math.round(withStructure.length/logs.length*100)}%)`);

  // Respuestas que mencionan artículos específicos
  const withArticles = logs.filter(l => l.full_response?.match(/artículo \d+/i));
  console.log(`- Respuestas citando artículos: ${withArticles.length} (${Math.round(withArticles.length/logs.length*100)}%)`);

})();
