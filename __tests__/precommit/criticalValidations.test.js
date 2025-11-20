// __tests__/precommit/criticalValidations.test.js
// Tests críticos que DEBEN pasar antes de cualquier commit
// Si estos fallan, el commit debe ser RECHAZADO

import { readFileSync } from 'fs'
import { join } from 'path'

describe('Pre-commit Critical Validations', () => {
  describe('Law Slug Generation - Prevención Bug 404', () => {
    test('CRÍTICO: openArticleModal debe convertir "/" a "-" en law slugs', () => {
      // Leer el archivo de la página tema
      const temaPagePath = join(process.cwd(), 'app', 'auxiliar-administrativo-estado', 'test', 'tema', '[numero]', 'page.js')
      
      let temaPageContent
      try {
        temaPageContent = readFileSync(temaPagePath, 'utf8')
      } catch (error) {
        throw new Error(`❌ No se puede leer ${temaPagePath}. Este archivo es crítico para el funcionamiento.`)
      }

      // Buscar la función openArticleModal
      const openArticleModalRegex = /function openArticleModal\s*\([^)]*\)\s*{([^}]+)}/
      const match = temaPageContent.match(openArticleModalRegex)
      
      if (!match) {
        throw new Error('❌ No se encontró la función openArticleModal en el archivo tema page.js')
      }

      const functionBody = match[1]
      
      // VALIDACIÓN CRÍTICA: Debe convertir "/" a "-"
      const hasSlashReplacement = functionBody.includes('.replace(/\\//g, \'-\')')
      
      if (!hasSlashReplacement) {
        throw new Error(`
❌ COMMIT RECHAZADO: openArticleModal no convierte "/" a "-" 

🚨 PROBLEMA CRÍTICO DETECTADO:
La función openArticleModal no incluye .replace(/\\/g, '-') 

🔍 CÓDIGO ACTUAL:
${functionBody.trim()}

✅ CÓDIGO REQUERIDO DEBE INCLUIR:
const lawSlug = lawName?.toLowerCase().replace(/\\s+/g, '-').replace(/\\//g, '-') || 'ley-desconocida'

🐛 SIN ESTA CORRECCIÓN:
- Leyes como "Ley 50/1997" → "ley-50/1997" (❌ 404 Error)
- URLs de API como /api/teoria/ley-50/1997/15 fallan

⚡ PARA ARREGLAR:
Añadir .replace(/\\//g, '-') a la generación del lawSlug
        `)
      }

      // Validación adicional: debe haber reemplazo de espacios Y barras
      const hasSpaceReplacement = functionBody.includes('.replace(/\\s+/g, \'-\')')
      if (!hasSpaceReplacement) {
        throw new Error('❌ COMMIT RECHAZADO: openArticleModal no convierte espacios a "-"')
      }
    })

    test('CRÍTICO: ArticleModal debe capturar errores detallados', () => {
      const articleModalPath = join(process.cwd(), 'components', 'ArticleModal.js')
      
      let modalContent
      try {
        modalContent = readFileSync(articleModalPath, 'utf8')
      } catch (error) {
        throw new Error(`❌ No se puede leer ${articleModalPath}`)
      }

      // Debe incluir manejo detallado de errores
      const hasDetailedErrorHandling = modalContent.includes('API Error:') && 
                                      modalContent.includes('URL:')
      
      if (!hasDetailedErrorHandling) {
        throw new Error(`
❌ COMMIT RECHAZADO: ArticleModal no tiene manejo detallado de errores

🚨 El sistema de reporte de errores detallado fue removido o modificado.
Este sistema es crítico para debuggear problemas de carga de artículos.

✅ DEBE INCLUIR:
- Captura de status HTTP exacto
- URL de API que falla  
- Información de contexto para reproducir errores
        `)
      }
    })
  })

  describe('Validación de archivos críticos', () => {
    test('CRÍTICO: Archivos esenciales deben existir y ser legibles', () => {
      const criticalFiles = [
        'app/auxiliar-administrativo-estado/test/tema/[numero]/page.js',
        'components/ArticleModal.js',
        'lib/lawMappingUtils.js',
        'lib/teoriaFetchers.js'
      ]

      criticalFiles.forEach(filePath => {
        const fullPath = join(process.cwd(), filePath)
        
        try {
          const content = readFileSync(fullPath, 'utf8')
          expect(content.length).toBeGreaterThan(0)
        } catch (error) {
          throw new Error(`❌ ARCHIVO CRÍTICO FALTANTE O ILEGIBLE: ${filePath}`)
        }
      })
    })
  })

  describe('Validación de expresiones regulares peligrosas', () => {
    test('CRÍTICO: No debe haber código que genere slugs con "/"', () => {
      const filesToCheck = [
        'app/auxiliar-administrativo-estado/test/tema/[numero]/page.js',
        'components/ArticleModal.js',
        'lib/lawMappingUtils.js'
      ]

      filesToCheck.forEach(filePath => {
        const fullPath = join(process.cwd(), filePath)
        
        try {
          const content = readFileSync(fullPath, 'utf8')
          
          // Buscar el patrón específico del bug: replace spaces pero sin replace slashes
          const hasSpaceReplace = content.includes('.replace(/\\s+/g, \'-\')')
          const hasSlashReplace = content.includes('.replace(/\\//g, \'-\')') || content.includes('.replace(/[^a-z0-9\\-]/g, \'-\')')
          
          // Si hay reemplazo de espacios pero NO de barras en lawSlug, es peligroso
          if (hasSpaceReplace && !hasSlashReplace && content.includes('lawSlug')) {
            throw new Error(`
❌ COMMIT RECHAZADO: Patrón peligroso detectado en ${filePath}

🚨 PROBLEMA:
Se encontró código que genera lawSlug CON reemplazo de espacios pero SIN reemplazo de barras.

🔍 Este patrón puede causar errores 404 en URLs de API para leyes como "Ley 50/1997".

✅ SOLUCIÓN REQUERIDA:
Cambiar: .replace(/\\s+/g, '-')
Por: .replace(/\\s+/g, '-').replace(/\\//g, '-')
            `)
          }
          
        } catch (error) {
          if (error.message.includes('COMMIT RECHAZADO')) {
            throw error
          }
          // Si el archivo no existe, se maneja en otro test
        }
      })
    })
  })

  describe('Validación de tests de regresión', () => {
    test('CRÍTICO: Tests de law slug generation deben existir', () => {
      const testFiles = [
        '__tests__/utils/lawSlugGeneration.test.js',
        '__tests__/components/openArticleModal.test.js', 
        '__tests__/integration/lawSlugsValidation.test.js'
      ]

      testFiles.forEach(testFile => {
        const fullPath = join(process.cwd(), testFile)
        
        try {
          const content = readFileSync(fullPath, 'utf8')
          
          // Verificar que el test realmente valida la conversión de "/"
          if (!content.includes('replace(/\\/g, \'-\')') && !content.includes('not.toContain(\'/\')')) {
            throw new Error(`❌ Test ${testFile} no valida correctamente la conversión de "/"`)
          }
          
        } catch (error) {
          if (error.code === 'ENOENT') {
            throw new Error(`❌ TEST DE REGRESIÓN FALTANTE: ${testFile}`)
          }
          throw error
        }
      })
    })

    test('CRÍTICO: Package.json debe incluir tests en pre-commit', () => {
      const packageJsonPath = join(process.cwd(), 'package.json')
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
      
      const preCommitScript = packageJson.scripts?.['pre-commit']
      
      if (!preCommitScript) {
        throw new Error('❌ No se encontró script "pre-commit" en package.json')
      }

      if (!preCommitScript.includes('test')) {
        throw new Error(`
❌ COMMIT RECHAZADO: pre-commit no ejecuta tests

🚨 SCRIPT ACTUAL: ${preCommitScript}

✅ DEBE INCLUIR: npm run test:ci (o similar)

📋 Scripts de test requeridos:
- test:ci para commits
- tests que validen law slug generation
        `)
      }
    })
  })

  describe('Validación de configuración Jest', () => {
    test('Jest debe estar configurado correctamente para los tests críticos', () => {
      // Verificar que Jest puede ejecutar los tests críticos
      const jestConfigFiles = ['jest.config.js', 'jest.config.mjs', 'package.json']
      
      let jestConfig = null
      
      for (const configFile of jestConfigFiles) {
        try {
          const fullPath = join(process.cwd(), configFile)
          
          if (configFile === 'package.json') {
            const packageJson = JSON.parse(readFileSync(fullPath, 'utf8'))
            jestConfig = packageJson.jest
          } else {
            // Para archivos .js/.mjs sería más complejo, asumimos package.json
            continue
          }
          
          break
        } catch (error) {
          continue
        }
      }

      // Verificaciones básicas de configuración Jest
      if (!jestConfig) {
        // Jest podría estar usando configuración por defecto, lo cual está bien
        console.log('ℹ️ Jest usando configuración por defecto')
        return
      }

      // Si existe configuración, verificar que sea compatible
      if (jestConfig.testEnvironment && jestConfig.testEnvironment !== 'jsdom') {
        throw new Error('❌ Jest debe usar testEnvironment: "jsdom" para tests de componentes React')
      }
    })
  })
})