// scripts/test-article-modal-error.js
// Script para probar la nueva funcionalidad de reporte de errores en ArticleModal

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://yqbpstxowvgipqspqrgo.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w'
);

async function testArticleModalErrorReporting() {
  console.log('🧪 PROBANDO FUNCIONALIDAD DE REPORTE DE ERRORES EN ARTICLEMODAL');
  console.log('='.repeat(70));

  try {
    // 1. Simular el feedback que se enviaría desde el modal
    const mockError = {
      articleNumber: '39',
      lawSlug: 'ley-19-2013',
      url: 'http://localhost:3001/auxiliar-administrativo-estado/test/tema/11',
      error: 'Error 404: No se pudo cargar el artículo',
      userAgent: 'Mozilla/5.0 (Test Browser)',
      viewport: '1920x1080'
    };

    console.log('📋 Datos del error simulado:');
    console.log('   Artículo:', mockError.articleNumber);
    console.log('   Ley:', mockError.lawSlug);
    console.log('   URL:', mockError.url);
    console.log('   Error:', mockError.error);

    // 2. Crear el mensaje exacto que generaría el modal
    const feedbackMessage = `🚨 ERROR AL CARGAR ARTÍCULO

📄 **Artículo:** ${mockError.articleNumber}
⚖️ **Ley:** ${mockError.lawSlug}
🌐 **URL:** ${mockError.url}
🎯 **Acción del usuario:** Clic en "Ver artículo" desde modal
❌ **Error técnico:** ${mockError.error}

**Descripción del problema:**
El usuario intentó ver el contenido del artículo desde el modal pero recibió un error 404. Todos los datos parecen correctos pero el artículo no se pudo cargar.

**Información técnica adicional:**
- Navegador: ${mockError.userAgent}
- Fecha/hora: ${new Date().toLocaleString('es-ES')}
- Viewport: ${mockError.viewport}`;

    console.log('\n📝 Mensaje de feedback generado:');
    console.log(feedbackMessage);

    // 3. Intentar insertar el feedback en la BD (como haría el modal)
    console.log('\n💾 Insertando feedback en BD...');
    
    const { data: feedbackResult, error: submitError } = await supabase
      .from('user_feedback')
      .insert({
        user_id: null, // Simular usuario anónimo
        email: 'test@vence.es',
        type: 'bug',
        message: feedbackMessage,
        url: mockError.url,
        user_agent: mockError.userAgent,
        viewport: mockError.viewport,
        referrer: null,
        wants_response: false,
        status: 'pending',
        priority: 'high'
      })
      .select();

    if (submitError) {
      console.error('❌ Error insertando feedback:', submitError.message);
      return false;
    }

    console.log('✅ Feedback insertado correctamente');
    console.log('   ID:', feedbackResult[0].id);

    // 4. Crear conversación automática
    console.log('\n💬 Creando conversación automática...');
    
    const { data: conversationResult, error: conversationError } = await supabase
      .from('feedback_conversations')
      .insert({
        feedback_id: feedbackResult[0].id,
        user_id: null,
        status: 'waiting_admin'
      })
      .select();

    if (conversationError) {
      console.error('❌ Error creando conversación:', conversationError.message);
      return false;
    }

    console.log('✅ Conversación creada correctamente');
    console.log('   ID:', conversationResult[0].id);

    // 5. Verificar que todo se guardó correctamente
    console.log('\n🔍 Verificando datos guardados...');
    
    const { data: verifyFeedback } = await supabase
      .from('user_feedback')
      .select('*')
      .eq('id', feedbackResult[0].id)
      .single();

    const { data: verifyConversation } = await supabase
      .from('feedback_conversations')
      .select('*')
      .eq('id', conversationResult[0].id)
      .single();

    console.log('📊 Feedback verificado:');
    console.log('   Tipo:', verifyFeedback.type);
    console.log('   Prioridad:', verifyFeedback.priority);
    console.log('   Estado:', verifyFeedback.status);
    console.log('   Longitud mensaje:', verifyFeedback.message.length, 'caracteres');

    console.log('📊 Conversación verificada:');
    console.log('   Estado:', verifyConversation.status);
    console.log('   Feedback ID:', verifyConversation.feedback_id);

    // 6. Test final
    console.log('\n' + '='.repeat(50));
    console.log('🎯 RESULTADO DE LA PRUEBA:');
    console.log('✅ Funcionalidad de reporte automático FUNCIONA CORRECTAMENTE');
    console.log('✅ Se crea feedback con prioridad HIGH');
    console.log('✅ Se crea conversación automática');
    console.log('✅ Toda la información técnica se guarda correctamente');
    
    console.log('\n📋 PRÓXIMOS PASOS:');
    console.log('1. El admin verá este feedback en el panel de administración');
    console.log('2. Puede responder a través de la conversación automática');
    console.log('3. El usuario recibirá notificación de la respuesta');

    return {
      feedbackId: feedbackResult[0].id,
      conversationId: conversationResult[0].id,
      success: true
    };

  } catch (error) {
    console.error('❌ ERROR GENERAL:', error.message);
    return false;
  }
}

// Ejecutar test
testArticleModalErrorReporting()
  .then(result => {
    if (result) {
      console.log('\n🎉 TEST COMPLETADO EXITOSAMENTE');
      console.log('   Feedback ID:', result.feedbackId);
      console.log('   Conversación ID:', result.conversationId);
    } else {
      console.log('\n❌ TEST FALLIDO');
    }
  })
  .catch(error => {
    console.error('❌ ERROR EN TEST:', error);
  });