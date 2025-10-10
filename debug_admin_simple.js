#!/usr/bin/env node

/**
 * SCRIPT DE DEBUG SIMPLE: Verificar función admin
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 DEBUG: Verificando función is_current_user_admin')

async function debugAdminFunction() {
  try {
    // 1. Probar si la función existe
    console.log('\n1. Probando función is_current_user_admin...')
    const { data, error } = await supabase.rpc('is_current_user_admin')
    
    if (error) {
      console.error('❌ ERROR:', error.message)
      
      if (error.message.includes('does not exist')) {
        console.log('\n💡 PROBLEMA: La función is_current_user_admin NO existe')
        console.log('🔧 SOLUCIÓN: Ejecutar el siguiente SQL en tu base de datos:')
        console.log(`
-- CREAR FUNCIÓN PARA VERIFICAR ADMIN
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM user_roles 
    WHERE user_id = auth.uid() 
      AND role IN ('admin', 'super_admin')
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
  );
END;
$$;
        `)
      }
    } else {
      console.log('✅ Función existe y devuelve:', data)
    }

    // 2. Verificar usuarios admin en la tabla
    console.log('\n2. Verificando tabla user_roles...')
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, is_active, expires_at')
      .in('role', ['admin', 'super_admin'])
      .eq('is_active', true)
    
    if (rolesError) {
      console.error('❌ Error en user_roles:', rolesError.message)
    } else {
      console.log(`✅ Usuarios admin encontrados: ${roles?.length || 0}`)
      if (roles?.length > 0) {
        roles.forEach((role, i) => {
          console.log(`  ${i+1}. Usuario: ${role.user_id.slice(0,8)}... Rol: ${role.role}`)
        })
      }
    }

  } catch (error) {
    console.error('💥 ERROR FATAL:', error.message)
  }
}

debugAdminFunction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('💥 ERROR:', error.message)
    process.exit(1)
  })