// scripts/add-admin-viewed-field.js - Agregar campo admin_viewed_at a feedback_conversations
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variables de entorno de Supabase no configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function addAdminViewedField() {
  try {
    console.log('🔍 Verificando si el campo admin_viewed_at ya existe...')
    
    // Verificar si el campo ya existe
    const { data: columns, error: columnsError } = await supabase.rpc('sql', {
      query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'feedback_conversations' 
        AND column_name = 'admin_viewed_at';
      `
    })
    
    if (columnsError) {
      // Intentar consulta directa si RPC no funciona
      console.log('📋 Verificando estructura de tabla...')
      const { data: testData, error: testError } = await supabase
        .from('feedback_conversations')
        .select('admin_viewed_at')
        .limit(1)
      
      if (testError && testError.message.includes('admin_viewed_at')) {
        console.log('❌ El campo admin_viewed_at no existe, necesita ser agregado manualmente')
        console.log('📝 Ejecuta este SQL en el panel de Supabase:')
        console.log('')
        console.log('ALTER TABLE feedback_conversations')
        console.log('ADD COLUMN admin_viewed_at timestamp with time zone;')
        console.log('')
        console.log('CREATE INDEX idx_feedback_conversations_admin_viewed')
        console.log('ON feedback_conversations(status, admin_viewed_at)')
        console.log('WHERE admin_viewed_at IS NULL;')
        console.log('')
        process.exit(1)
      } else {
        console.log('✅ El campo admin_viewed_at ya existe en la tabla')
      }
    } else if (columns && columns.length > 0) {
      console.log('✅ El campo admin_viewed_at ya existe en la tabla')
      console.log('📋 Detalles del campo:', columns[0])
    } else {
      console.log('❌ El campo admin_viewed_at no existe, necesita ser agregado manualmente')
      console.log('📝 Ejecuta este SQL en el panel de Supabase:')
      console.log('')
      console.log('ALTER TABLE feedback_conversations')
      console.log('ADD COLUMN admin_viewed_at timestamp with time zone;')
      console.log('')
      console.log('CREATE INDEX idx_feedback_conversations_admin_viewed')
      console.log('ON feedback_conversations(status, admin_viewed_at)')
      console.log('WHERE admin_viewed_at IS NULL;')
      console.log('')
      process.exit(1)
    }
    
    // Verificar conversaciones no vistas
    console.log('🔍 Verificando conversaciones no vistas...')
    const { data: unviewedConversations, error: unviewedError } = await supabase
      .from('feedback_conversations')
      .select('id, status, created_at')
      .eq('status', 'waiting_admin')
      .is('admin_viewed_at', null)
    
    if (unviewedError) {
      console.error('❌ Error verificando conversaciones no vistas:', unviewedError)
    } else {
      console.log(`📊 Conversaciones no vistas por admin: ${unviewedConversations?.length || 0}`)
      if (unviewedConversations && unviewedConversations.length > 0) {
        console.log('📋 Primeras 5 conversaciones no vistas:')
        unviewedConversations.slice(0, 5).forEach((conv, index) => {
          console.log(`  ${index + 1}. ${conv.id.substring(0, 8)}... (${conv.status}) - ${new Date(conv.created_at).toLocaleDateString('es-ES')}`)
        })
      }
    }
    
    console.log('✅ Verificación completada')
    
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

addAdminViewedField()