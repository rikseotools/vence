#!/usr/bin/env node

/**
 * SCRIPT DE DEBUG: Verificar roles de admin
 * 
 * Este script verifica si las funciones de roles funcionan
 * correctamente después de la migración.
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Cargar variables de entorno
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

console.log('🔍 DEBUG: Verificando roles de admin')
console.log('=' .repeat(50))

async function debugAdminRoles() {
  try {
    // 1. Verificar si la función exists
    console.log('\n1. Verificando función is_current_user_admin...')
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name, routine_type')
      .eq('routine_name', 'is_current_user_admin')
    
    if (funcError) {
      console.log('⚠️ No se pudo verificar funciones:', funcError.message)
    } else if (functions?.length > 0) {
      console.log('✅ Función is_current_user_admin existe')
    } else {
      console.log('❌ Función is_current_user_admin NO existe')
    }

    // 2. Verificar usuarios con roles de admin
    console.log('\n2. Verificando usuarios con roles de admin...')
    const { data: adminUsers, error: adminError } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        role,
        is_active,
        expires_at,
        user_profiles!inner(email, full_name)
      `)
      .in('role', ['admin', 'super_admin'])
      .eq('is_active', true)
    
    if (adminError) {
      console.error('❌ Error al obtener usuarios admin:', adminError.message)
    } else {
      console.log(`✅ Encontrados ${adminUsers?.length || 0} usuarios admin:`)
      adminUsers?.forEach(user => {
        console.log(`  • ${user.user_profiles?.email || 'Email no disponible'} - Rol: ${user.role}`)
        if (user.expires_at) {
          console.log(`    Expira: ${user.expires_at}`)
        }
      })
    }

    // 3. Probar la función con un usuario específico
    console.log('\n3. Probando función is_current_user_admin...')
    
    if (adminUsers?.length > 0) {
      const testUserId = adminUsers[0].user_id
      console.log(`Probando con usuario: ${adminUsers[0].user_profiles?.email}`)
      
      // No podemos testear la función directamente porque usa auth.uid()
      // Pero podemos verificar la lógica manualmente
      const { data: roleCheck, error: roleError } = await supabase
        .from('user_roles')
        .select('role, is_active, expires_at')
        .eq('user_id', testUserId)
        .in('role', ['admin', 'super_admin'])
        .eq('is_active', true)
      
      if (roleError) {
        console.error('❌ Error verificando rol:', roleError.message)
      } else if (roleCheck?.length > 0) {
        const role = roleCheck[0]
        const isExpired = role.expires_at && new Date(role.expires_at) < new Date()
        
        console.log('✅ Verificación manual de rol:')
        console.log(`  • Rol activo: ${role.role}`)
        console.log(`  • Expirado: ${isExpired ? 'SÍ' : 'NO'}`)
        console.log(`  • Debería ser admin: ${!isExpired ? 'SÍ' : 'NO'}`)
      } else {
        console.log('❌ Usuario no tiene rol de admin activo')
      }
    }

    // 4. Verificar si la función get_current_user_roles existe
    console.log('\n4. Verificando función get_current_user_roles...')
    const { data: rolesFunctions, error: rolesFuncError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_name', 'get_current_user_roles')
    
    if (rolesFuncError) {
      console.log('⚠️ No se pudo verificar función roles:', rolesFuncError.message)
    } else if (rolesFunctions?.length > 0) {
      console.log('✅ Función get_current_user_roles existe')
    } else {
      console.log('❌ Función get_current_user_roles NO existe')
    }

    console.log('\n' + '='.repeat(50))
    console.log('🎯 DIAGNÓSTICO COMPLETADO')
    
    if (functions?.length === 0) {
      console.log('\n⚠️ PROBLEMA DETECTADO: Función is_current_user_admin no existe')
      console.log('💡 SOLUCIÓN: Ejecutar migraciones de roles de usuario')
    } else if (adminUsers?.length === 0) {
      console.log('\n⚠️ PROBLEMA DETECTADO: No hay usuarios admin en la base de datos')
      console.log('💡 SOLUCIÓN: Asignar rol de admin a al menos un usuario')
    } else {
      console.log('\n✅ Sistema de roles parece estar configurado correctamente')
      console.log('💡 Si el botón Admin no aparece, revisar autenticación en frontend')
    }
    
    console.log('='.repeat(50))

  } catch (error) {
    console.error('\n💥 ERROR FATAL:', error.message)
  }
}

// Ejecutar debug
debugAdminRoles()
  .then(() => {
    console.log('\n🏁 Debug completado')
    process.exit(0)
  })
  .catch(error => {
    console.error('\n💥 ERROR:', error.message)
    process.exit(1)
  })