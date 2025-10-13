// Script para remover el tab de psicotécnicos de la página de tests
const fs = require('fs')
const path = require('path')

const filePath = '/Users/manuel/Documents/github/vence/app/auxiliar-administrativo-estado/test/page.js'

try {
  let content = fs.readFileSync(filePath, 'utf8')
  
  console.log('🔍 Removiendo tab de psicotécnicos...')
  
  // 1. Remover el botón del tab de psicotécnicos
  const tabButtonRegex = /\s*<div className="flex-1">\s*<button[^>]*onClick=\{\(\) => setActiveTab\('psicotecnicos'\)[^}]*}\s*>[^<]*<div className="flex items-center justify-center">[^<]*<span className="mr-1 sm:mr-2">🀲<\/span>[^}]*<\/div>[^}]*<\/button>[^}]*<\/div>/gs
  content = content.replace(tabButtonRegex, '')
  
  // 2. Remover todo el contenido del tab de psicotécnicos
  const psicotecnicosContentRegex = /\s*{\/\* Contenido de Psicotécnicos[^}]*\*\/}[^}]*{activeTab === 'psicotecnicos' && \([^}]*<>[^}]*{!selectedBlock && \([^}]*<>[^}]*<div className="text-center mb-8">[^}]*[\s\S]*?<\/>\s*\)\s*}[^}]*[\s\S]*?<\/>\s*\)\s*}/gs
  content = content.replace(psicotecnicosContentRegex, '')
  
  // 3. Limpiar referencias adicionales en breadcrumbs y navegación
  const breadcrumbRegex = /Psicotécnicos/g
  content = content.replace(breadcrumbRegex, 'Tests')
  
  // 4. Remover imports y funciones relacionadas con psicotécnicos que ya no se necesiten
  console.log('✅ Tab de psicotécnicos removido')
  
  // Escribir el archivo actualizado
  fs.writeFileSync(filePath, content)
  console.log('💾 Archivo actualizado exitosamente')
  
} catch (error) {
  console.error('❌ Error:', error.message)
}