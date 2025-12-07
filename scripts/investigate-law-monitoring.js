// scripts/investigate-law-monitoring.js
// Investigar el estado del monitoreo de leyes

import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function investigate() {
  console.log('🔍 Investigando sistema de monitoreo de leyes...\n')

  // 1. Ver estructura de columnas relevantes
  console.log('📋 ESTRUCTURA DE TABLA LAWS (columnas de monitoreo):')
  const { data: columns, error: colError } = await supabase
    .rpc('exec_sql', {
      query: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'laws'
        AND (
          column_name LIKE '%check%' OR
          column_name LIKE '%change%' OR
          column_name LIKE '%update%' OR
          column_name LIKE '%reviewed%' OR
          column_name LIKE '%hash%'
        )
        ORDER BY ordinal_position;
      `
    })

  if (colError) {
    console.log('⚠️  No se pudo obtener estructura (esperado si no hay RPC exec_sql)')
  } else {
    console.table(columns)
  }

  // 2. Estado actual de Ley 39/2015
  console.log('\n📊 ESTADO ACTUAL DE LEY 39/2015:')
  const { data: law39, error: law39Error } = await supabase
    .from('laws')
    .select('id, short_name, name, last_checked, last_update_boe, change_status, change_detected_at, reviewed_at, content_hash, boe_url')
    .eq('short_name', 'Ley 39/2015')
    .single()

  if (law39Error) {
    console.log('❌ Error:', law39Error.message)
  } else {
    console.log(`ID: ${law39.id}`)
    console.log(`Nombre: ${law39.name}`)
    console.log(`BOE URL: ${law39.boe_url}`)
    console.log(`Última verificación: ${law39.last_checked || 'Nunca'}`)
    console.log(`Última actualización BOE: ${law39.last_update_boe || 'Sin fecha'}`)
    console.log(`Estado de cambio: ${law39.change_status || 'none'}`)
    console.log(`Cambio detectado en: ${law39.change_detected_at || 'Nunca'}`)
    console.log(`Revisado en: ${law39.reviewed_at || 'Nunca'}`)
    console.log(`Hash de contenido: ${law39.content_hash ? law39.content_hash.substring(0, 16) + '...' : 'Sin hash'}`)
  }

  // 3. Buscar tablas de logs
  console.log('\n📝 BUSCANDO TABLAS DE LOGS/AUDITORÍA:')
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .or('table_name.like.%log%,table_name.like.%monitor%,table_name.like.%audit%,table_name.like.%history%')
    .eq('table_schema', 'public')

  if (tablesError) {
    console.log('⚠️  No se pudo consultar tablas')
  } else if (tables && tables.length > 0) {
    console.log('Tablas encontradas:')
    tables.forEach(t => console.log(`  - ${t.table_name}`))
  } else {
    console.log('❌ NO HAY TABLAS DE LOGS - El sistema no guarda historial de ejecuciones')
  }

  // 4. Ver todas las leyes monitoreadas
  console.log('\n📚 TODAS LAS LEYES CON MONITOREO ACTIVO:')
  const { data: allLaws, error: allLawsError } = await supabase
    .from('laws')
    .select('id, short_name, last_checked, last_update_boe, change_status, change_detected_at')
    .not('boe_url', 'is', null)
    .order('last_update_boe', { ascending: false, nullsFirst: false })

  if (allLawsError) {
    console.log('❌ Error:', allLawsError.message)
  } else {
    console.table(allLaws.map(l => ({
      ID: l.id,
      Ley: l.short_name,
      'Última verificación': l.last_checked ? new Date(l.last_checked).toLocaleString('es-ES') : 'Nunca',
      'Fecha BOE': l.last_update_boe || 'Sin fecha',
      Estado: l.change_status || 'none',
      'Cambio detectado': l.change_detected_at ? new Date(l.change_detected_at).toLocaleString('es-ES') : 'Nunca'
    })))
  }

  // 5. Hacer una verificación manual del BOE de Ley 39/2015
  if (law39 && law39.boe_url) {
    console.log('\n🔍 VERIFICANDO BOE ACTUAL DE LEY 39/2015:')
    try {
      const response = await fetch(law39.boe_url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; VenceApp/1.0)'
        }
      })

      if (response.ok) {
        const html = await response.text()

        // Buscar la fecha de actualización usando el mismo método del API
        const patterns = [
          /Última actualización publicada el (\d{2}\/\d{2}\/\d{4})/i,
          /actualización, publicada el (\d{2}\/\d{2}\/\d{4})/i,
          /Actualizado el (\d{2}\/\d{2}\/\d{4})/i,
        ]

        let foundDate = null
        for (const pattern of patterns) {
          const match = html.match(pattern)
          if (match && match[1]) {
            foundDate = match[1]
            break
          }
        }

        console.log(`Fecha en BOE AHORA: ${foundDate || 'No encontrada'}`)
        console.log(`Fecha almacenada en BD: ${law39.last_update_boe || 'Sin fecha'}`)

        if (foundDate && law39.last_update_boe) {
          if (foundDate === law39.last_update_boe) {
            console.log('✅ Las fechas COINCIDEN - No hay cambio real')
          } else {
            console.log('🚨 Las fechas NO COINCIDEN - Debería detectar cambio')
            console.log(`   Diferencia: ${law39.last_update_boe} → ${foundDate}`)
          }
        } else if (!foundDate) {
          console.log('⚠️  No se pudo extraer fecha del BOE actual')
        } else if (!law39.last_update_boe) {
          console.log('⚠️  Primera vez que se verifica (no hay fecha base)')
        }
      } else {
        console.log(`❌ Error al acceder al BOE: HTTP ${response.status}`)
      }
    } catch (error) {
      console.log('❌ Error verificando BOE:', error.message)
    }
  }

  // 6. Análisis y conclusiones
  console.log('\n📊 ANÁLISIS Y CONCLUSIONES:')
  console.log('='.repeat(60))

  if (!law39) {
    console.log('❌ La Ley 39/2015 no existe en la base de datos')
  } else {
    // Analizar cuándo se verificó por primera vez
    if (!law39.last_checked) {
      console.log('⚠️  Esta ley NUNCA ha sido verificada por el sistema de monitoreo')
    } else {
      const lastChecked = new Date(law39.last_checked)
      const daysSinceCheck = Math.floor((Date.now() - lastChecked.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`📅 Última verificación: hace ${daysSinceCheck} días (${lastChecked.toLocaleString('es-ES')})`)
    }

    if (law39.change_detected_at) {
      const changeDetected = new Date(law39.change_detected_at)
      const daysSinceChange = Math.floor((Date.now() - changeDetected.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`🚨 Último cambio detectado: hace ${daysSinceChange} días (${changeDetected.toLocaleString('es-ES')})`)
    }

    if (law39.reviewed_at) {
      const reviewed = new Date(law39.reviewed_at)
      const daysSinceReview = Math.floor((Date.now() - reviewed.getTime()) / (1000 * 60 * 60 * 24))
      console.log(`👁️  Última revisión: hace ${daysSinceReview} días (${reviewed.toLocaleString('es-ES')})`)
    }
  }

  console.log('\n🔴 PROBLEMAS IDENTIFICADOS:')
  console.log('1. ❌ NO HAY SISTEMA DE LOGS - No se puede ver historial de verificaciones')
  console.log('2. ❌ NO HAY REGISTRO DE PRIMERA VERIFICACIÓN - No se sabe cuándo se inició el monitoreo')
  console.log('3. ⚠️  Si el cambio ocurrió ANTES de activar el monitoreo, nunca se detectará')
  console.log('4. ⚠️  Las verificaciones solo registran el estado actual, no el historial')

  console.log('\n✅ RECOMENDACIONES:')
  console.log('1. Crear tabla law_monitoring_logs para guardar cada verificación')
  console.log('2. Añadir campo monitoring_started_at para saber cuándo se activó el monitoreo')
  console.log('3. Guardar snapshots históricos de fechas BOE para poder auditar')
  console.log('4. Implementar alertas cuando se detecten cambios')
}

investigate().catch(console.error)
