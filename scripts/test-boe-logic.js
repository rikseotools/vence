// scripts/test-boe-logic.js - Simular la lógica BOE sin tocar BD
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Simular datos como si tuviéramos la columna last_update_boe
const mockLawData = [
  {
    id: '95680d57-feb1-41c0-bb27-236024815feb',
    short_name: 'Ley 40/2015',
    last_update_boe: '02/08/2024', // Simulando que ya tenemos esta fecha
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565'
  },
  {
    id: '218452f5-b9f6-48f0-a25b-26df9cb19644', 
    short_name: 'Ley 39/2015',
    last_update_boe: '05/11/2024', // Fecha diferente para simular cambio
    boe_url: 'https://www.boe.es/buscar/act.php?id=BOE-A-2015-10566'
  }
]

function extractLastUpdateFromBOE(htmlContent) {
  try {
    const patterns = [
      /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i,
      /Actualizado el (\d{2}\/\d{2}\/\d{4})/i,
      /Versión consolidada.*?(\d{2}\/\d{2}\/\d{4})/i,
      /Modificado por.*?(\d{2}\/\d{2}\/\d{4})/i,
      /data-fecha-actualizacion="([^"]+)"/i
    ]
    
    for (const pattern of patterns) {
      const match = htmlContent.match(pattern)
      if (match && match[1]) {
        const dateStr = match[1]
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
          return dateStr
        }
      }
    }
    
    return null
  } catch (error) {
    console.error('Error extrayendo fecha:', error)
    return null
  }
}

async function testBOELogic() {
  console.log('🧪 PROBANDO LÓGICA BOE (SIMULACIÓN)\n')
  
  for (const law of mockLawData) {
    try {
      console.log(`📖 Verificando ${law.short_name}...`)
      
      // Descargar contenido actual
      const response = await fetch(law.boe_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VenceApp/1.0)'
        }
      })
      
      const currentContent = await response.text()
      const currentLastUpdate = extractLastUpdateFromBOE(currentContent)
      
      console.log(`   📅 Fecha BOE almacenada: ${law.last_update_boe}`)
      console.log(`   📅 Fecha BOE actual: ${currentLastUpdate}`)
      
      // Nueva lógica: comparar fechas BOE
      const hasChanged = currentLastUpdate ? 
        (law.last_update_boe !== currentLastUpdate) : 
        false // Sin fecha no podemos determinar cambio
      
      console.log(`   🔄 ¿Ha cambiado? ${hasChanged ? '✅ SÍ' : '❌ NO'}`)
      
      if (hasChanged) {
        console.log(`   🚨 ¡CAMBIO DETECTADO! ${law.last_update_boe} → ${currentLastUpdate}`)
      } else {
        console.log(`   ✅ Sin cambios detectados`)
      }
      
      console.log('')
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}\n`)
    }
  }
  
  console.log('✅ Prueba completada. Esta lógica será mucho más precisa que el hash HTML.')
}

testBOELogic()