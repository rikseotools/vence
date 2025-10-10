#!/usr/bin/env node

/**
 * SCRIPT: Arreglar verificación de admin en todas las páginas
 * 
 * Cambia el sistema antiguo (plan_type) por el nuevo (user_roles)
 */

import fs from 'fs'
import path from 'path'

const adminPages = [
  'app/admin/notificaciones/email/subscripciones/page.js',
  'app/admin/notificaciones/overview/page.js', 
  'app/admin/notificaciones/events/page.js',
  'app/admin/notificaciones/users/page.js',
  'app/admin/notificaciones/push/usuarios/page.js',
  'app/admin/notificaciones/push/page.js',
  'app/admin/notificaciones/page.js'
]

const oldPattern = `      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('plan_type, email')
          .eq('id', user.id)
          .single()

        const adminAccess = profile?.plan_type === 'admin' || 
                           profile?.email === 'ilovetestpro@gmail.com' ||
                           profile?.email === 'rikseotools@gmail.com'
        
        setIsAdmin(adminAccess)`

const newPattern = `      try {
        // 🔧 FIX: Use same admin verification as Header  
        const { data: isAdminResult, error } = await supabase.rpc('is_current_user_admin')
        
        if (error) {
          console.error('Error verificando admin status:', error)
          setIsAdmin(false)
        } else {
          setIsAdmin(isAdminResult === true)
        }`

console.log('🔧 Arreglando páginas de admin...')

let fixedCount = 0

for (const pagePath of adminPages) {
  try {
    if (!fs.existsSync(pagePath)) {
      console.log(`⚠️ Archivo no encontrado: ${pagePath}`)
      continue
    }

    let content = fs.readFileSync(pagePath, 'utf8')
    
    if (content.includes('plan_type === \'admin\'')) {
      // Replace the old pattern
      content = content.replace(oldPattern, newPattern)
      
      // Also replace references to adminAccess variable
      content = content.replace(/if \(adminAccess\)/g, 'if (isAdminResult === true)')
      
      fs.writeFileSync(pagePath, content)
      console.log(`✅ Arreglado: ${pagePath}`)
      fixedCount++
    } else {
      console.log(`📝 Ya está actualizado: ${pagePath}`)
    }
  } catch (error) {
    console.error(`❌ Error procesando ${pagePath}:`, error.message)
  }
}

console.log(`\n🎉 Proceso completado: ${fixedCount} archivos arreglados`)
console.log('\n💡 Ahora todas las páginas admin usan el mismo sistema de verificación')