#!/usr/bin/env node

// Script para enviar email de impugnación manualmente
// Uso: node scripts/send-dispute-email.js <dispute-id>

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqbpstxowvgipqspqrgo.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxYnBzdHhvd3ZnaXBxc3BxcmdvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDg3NjcwMywiZXhwIjoyMDY2NDUyNzAzfQ.4yUKsfS-enlY6iGICFkKi-HPqNUyTkHczUqc5kgQB3w';
const API_BASE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

async function sendDisputeEmail(disputeId) {
  try {
    console.log(`📧 Enviando email para disputa: ${disputeId}`);
    
    const response = await fetch(`${API_BASE}/api/send-dispute-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ disputeId })
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Email enviado exitosamente`);
      console.log(`📧 Email ID: ${result.emailId}`);
    } else {
      console.error(`❌ Error enviando email: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ Error en sendDisputeEmail:`, error);
    return { success: false, error: error.message };
  }
}

// Función para resolver disputa y enviar email automáticamente
async function resolveDisputeWithEmail(disputeId, status, adminResponse) {
  try {
    console.log(`🔄 Resolviendo disputa ${disputeId} con status: ${status}`);
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    // 1. Actualizar la disputa
    const { data, error } = await supabase
      .from('question_disputes')
      .update({
        status: status,
        admin_response: adminResponse,
        resolved_at: new Date().toISOString()
      })
      .eq('id', disputeId)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error actualizando disputa:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Disputa actualizada exitosamente`);

    // 2. Enviar email
    const emailResult = await sendDisputeEmail(disputeId);
    
    return {
      success: true,
      dispute: data,
      email: emailResult
    };

  } catch (error) {
    console.error(`❌ Error en resolveDisputeWithEmail:`, error);
    return { success: false, error: error.message };
  }
}

// CLI execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
📧 Script de Emails de Impugnaciones

Uso:
  node scripts/send-dispute-email.js <dispute-id>                    # Solo enviar email
  node scripts/send-dispute-email.js resolve <dispute-id> <status> "<admin-response>"  # Resolver y enviar

Ejemplos:
  node scripts/send-dispute-email.js abc-123-def
  node scripts/send-dispute-email.js resolve abc-123-def resolved "Tienes razón, hemos corregido la pregunta"
  node scripts/send-dispute-email.js resolve abc-123-def rejected "La pregunta es correcta según el artículo X"
    `);
    process.exit(1);
  }

  if (args[0] === 'resolve') {
    if (args.length < 4) {
      console.error('❌ Faltan argumentos para resolve');
      process.exit(1);
    }
    
    const [, disputeId, status, adminResponse] = args;
    resolveDisputeWithEmail(disputeId, status, adminResponse)
      .then(result => {
        if (result.success) {
          console.log('🎉 Proceso completado exitosamente');
        } else {
          console.error('❌ Error en el proceso:', result.error);
          process.exit(1);
        }
      });
  } else {
    const disputeId = args[0];
    sendDisputeEmail(disputeId)
      .then(result => {
        if (!result.success) {
          process.exit(1);
        }
      });
  }
}

module.exports = { sendDisputeEmail, resolveDisputeWithEmail };