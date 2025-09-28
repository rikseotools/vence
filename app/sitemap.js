// app/sitemap.js - SITEMAP LIMPIO: SOLO PÁGINAS PRINCIPALES
import { getSupabaseClient } from '../lib/supabase.js'
import { getCanonicalSlug } from '../lib/lawMappingUtils.js'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export default async function sitemap() {
  // ✅ TUS URLs ESTÁTICAS PRINCIPALES (solo páginas importantes)
  const staticUrls = [
    // Homepage con hreflang
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/es`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    
    // Auxiliar Administrativo - SOLO páginas principales
    {
      url: `${SITE_URL}/es/auxiliar-administrativo-estado`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/es/auxiliar-administrativo-estado/test`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/es/auxiliar-administrativo-estado/temario`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    
    // ✅ SOLO Tema 7 - página principal (no test-personalizado ni otros)
    {
      url: `${SITE_URL}/es/auxiliar-administrativo-estado/temario/tema-7`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/es/auxiliar-administrativo-estado/test/tema/7`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    
    // ✅ PÁGINAS PRINCIPALES DE CONTENIDO - NO TESTS
    {
      url: `${SITE_URL}/es/leyes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/es/teoria`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    
    // Test rápido general - ÚNICA URL de test en sitemap
    {
      url: `${SITE_URL}/es/test/rapido`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    
    // Página de unsubscribe
    {
      url: `${SITE_URL}/es/unsubscribe`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // 🚫 URLs QUE NO QUIERES INDEXAR (todas las páginas de test)
  const excludedUrls = [
    '/es/login',
    '/es/perfil', 
    '/es/mis-estadisticas',
    '/es/mis-impugnaciones',
    '/es/admin',
    '/auth/callback',
    
    // ❌ TODAS LAS URLs DE TEST - NO INCLUIR EN SITEMAP
    '/test-rapido',
    '/avanzado', 
    '/test-personalizado',
    '/oficial',
    
    // ❌ URLs DE NOTIFICACIONES - NO INCLUIR
    '/es/test/mantener-racha',
    '/es/test/explorar', 
    '/es/test/desafio',
    '/es/test/recuperar-racha',
    '/articulos-dirigido',
  ]

  try {
    const supabase = getSupabaseClient()
    
    if (!supabase) {
      console.log('⚠️ Supabase no disponible, usando solo URLs estáticas')
      return staticUrls
    }
    
    // Obtener todas las leyes activas para generar SOLO páginas principales
    const { data: laws, error } = await supabase
      .from('laws')
      .select('short_name, name, updated_at')
      .eq('is_active', true)

    if (error) {
      console.error('Error obteniendo leyes para sitemap:', error)
      return staticUrls
    }

    console.log(`📊 Generando sitemap con ${laws?.length || 0} leyes - SOLO PÁGINAS PRINCIPALES`)

    // ✅ GENERAR SOLO PÁGINAS PRINCIPALES DE LEYES (no tests)
    const lawUrls = []
    
    for (const law of laws || []) {
      try {
        // Contar preguntas para verificar que la ley tiene contenido suficiente
        const { count } = await supabase
          .from('questions')
          .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('articles.laws.short_name', law.short_name)

        if (count >= 5) { // Solo incluir leyes con suficientes preguntas
          const canonicalSlug = getCanonicalSlug(law.short_name)
          const lastModified = law.updated_at ? new Date(law.updated_at) : new Date()

          // ✅ SOLO PÁGINA PRINCIPAL DE LA LEY - NO TESTS
          const lawUrl = {
            url: `${SITE_URL}/es/leyes/${canonicalSlug}`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.8,
          }

          // 🎯 CONTROL: Solo añadir si no está en la lista de exclusión
          const path = lawUrl.url.replace(SITE_URL, '')
          if (!excludedUrls.some(excluded => path.includes(excluded))) {
            lawUrls.push(lawUrl)
            console.log(`✅ ${law.short_name}: ${count} preguntas → URL principal: ${canonicalSlug}`)
          }
        } else {
          console.log(`❌ ${law.short_name}: ${count} preguntas → EXCLUIDA (insuficientes)`)
        }
      } catch (lawError) {
        console.log(`⚠️ Error procesando ley ${law.short_name}:`, lawError.message)
        continue
      }
    }

    const totalUrls = staticUrls.length + lawUrls.length
    console.log(`✅ Sitemap LIMPIO generado:`)
    console.log(`   📄 ${staticUrls.length} URLs estáticas`)
    console.log(`   🏛️ ${lawUrls.length} páginas principales de leyes`)
    console.log(`   📊 ${totalUrls} URLs totales`)
    console.log(`🎯 SOLO páginas principales - SIN tests individuales`)
    
    return [...staticUrls, ...lawUrls]

  } catch (error) {
    console.error('❌ Error generando sitemap:', error)
    console.log('📋 Usando solo URLs estáticas como fallback')
    return staticUrls
  }
}