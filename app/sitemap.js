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
    
    // Auxiliar Administrativo - SOLO páginas principales
    {
      url: `${SITE_URL}/auxiliar-administrativo-estado`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/auxiliar-administrativo-estado/test`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/auxiliar-administrativo-estado/temario`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    
    // Administrativo del Estado - páginas principales
    {
      url: `${SITE_URL}/administrativo-estado`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/administrativo-estado/test`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/administrativo-estado/temario`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // ✅ Temas individuales - Auxiliar Administrativo del Estado
    // Bloque I: Organización Pública (temas 1-16)
    ...Array.from({ length: 16 }, (_, i) => ({
      url: `${SITE_URL}/auxiliar-administrativo-estado/temario/tema-${i + 1}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
    // Bloque II: Actividad Administrativa (temas 101-104, excluidos 105-112 informática)
    ...Array.from({ length: 4 }, (_, i) => ({
      url: `${SITE_URL}/auxiliar-administrativo-estado/temario/tema-${101 + i}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })),

    // ✅ Temas individuales - Administrativo del Estado
    // Bloque I: Organización del Estado (temas 1-11)
    ...Array.from({ length: 11 }, (_, i) => ({
      url: `${SITE_URL}/administrativo-estado/temario/tema-${i + 1}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
    // Bloque II: Organización de Oficinas Públicas (temas 201-204)
    ...Array.from({ length: 4 }, (_, i) => ({
      url: `${SITE_URL}/administrativo-estado/temario/tema-${201 + i}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
    // Bloque III: Derecho Administrativo General (temas 301-307)
    ...Array.from({ length: 7 }, (_, i) => ({
      url: `${SITE_URL}/administrativo-estado/temario/tema-${301 + i}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
    // Bloque IV: Gestión de Personal (temas 401-409)
    ...Array.from({ length: 9 }, (_, i) => ({
      url: `${SITE_URL}/administrativo-estado/temario/tema-${401 + i}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
    // Bloque V: Gestión Financiera (temas 501-506)
    ...Array.from({ length: 6 }, (_, i) => ({
      url: `${SITE_URL}/administrativo-estado/temario/tema-${501 + i}`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    })),
    // Bloque VI: Informática excluido (601-608 no disponibles)

    // ✅ PÁGINAS PRINCIPALES DE CONTENIDO - NO TESTS
    {
      url: `${SITE_URL}/leyes`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/leyes-de-oposiciones`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/teoria`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    
    
    // Tests Psicotécnicos
    {
      url: `${SITE_URL}/psicotecnicos`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/psicotecnicos/secuencias-numericas`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/psicotecnicos/series-letras`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    
    // Tests de Oposiciones - Página Principal
    {
      url: `${SITE_URL}/test-oposiciones`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    
    // Tests de la Constitución Española 1978 - SEO Optimizados
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/preambulo-y-titulo-preliminar`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-i-derechos-y-deberes-fundamentales`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-ii-de-la-corona`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-iii-de-las-cortes-generales`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-iv-del-gobierno-y-la-administracion`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-v-relaciones-gobierno-cortes`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-vi-del-poder-judicial`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-vii-economia-y-hacienda`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-viii-organizacion-territorial`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-ix-del-tribunal-constitucional`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-de-la-constitucion-espanola-de-1978/titulo-x-de-la-reforma-constitucional`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    
    // Tests de la Ley 39/2015 - SEO Optimizados (SOLO secciones reales de la BD)
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015/titulo-preliminar`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015/titulo-i-capitulo-i-capacidad-obrar-concepto-interesado`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015/titulo-ii-capitulo-i-normas-generales-actuacion`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015/titulo-iii-capitulo-i-requisitos-actos-administrativos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015/titulo-iv-capitulos-i-ii-garantias-iniciacion`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015/titulo-v-capitulo-i-revision-oficio`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/test-ley-39-2015/titulo-vi-iniciativa-legislativa-potestad-reglamentaria`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    
    // Tests de Procedimiento Administrativo - Organización Temática
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/conceptos-generales`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/el-procedimiento-administrativo`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/responsabilidad-patrimonial`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/terminos-plazos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/actos-administrativos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/eficacia-validez-actos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/nulidad-anulabilidad`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/revision-oficio`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/recursos-administrativos`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/test-oposiciones/procedimiento-administrativo/jurisdiccion-contencioso`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
  ]

  // 🚫 URLs QUE NO QUIERES INDEXAR (todas las páginas de test)
  const excludedUrls = [
    '/login',
    '/perfil', 
    '/mis-estadisticas',
    '/mis-impugnaciones',
    '/admin',
    '/auth/callback',
    
    // ❌ TODAS LAS URLs DE TEST - NO INCLUIR EN SITEMAP
    '/test-rapido',
    '/avanzado', 
    '/test-personalizado',
    '/oficial',
    
    // ❌ URLs DE NOTIFICACIONES - NO INCLUIR
    '/test/mantener-racha',
    '/test/explorar', 
    '/test/desafio',
    '/test/recuperar-racha',
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

          // ✅ PÁGINAS PRINCIPALES DE LEYES - TESTS Y TEORÍA
          const lawTestUrl = {
            url: `${SITE_URL}/leyes/${canonicalSlug}`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.8,
          }
          
          const lawTeoriaUrl = {
            url: `${SITE_URL}/teoria/${canonicalSlug}`,
            lastModified,
            changeFrequency: 'weekly',
            priority: 0.7,
          }

          // 🎯 CONTROL: Solo añadir si no está en la lista de exclusión
          const testPath = lawTestUrl.url.replace(SITE_URL, '')
          const teoriaPath = lawTeoriaUrl.url.replace(SITE_URL, '')
          
          if (!excludedUrls.some(excluded => testPath.includes(excluded))) {
            lawUrls.push(lawTestUrl)
          }
          
          if (!excludedUrls.some(excluded => teoriaPath.includes(excluded))) {
            lawUrls.push(lawTeoriaUrl)
          }
          
          console.log(`✅ ${law.short_name}: ${count} preguntas → URLs: /leyes/${canonicalSlug} + /teoria/${canonicalSlug}`)
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
    console.log(`   🏛️ ${lawUrls.length} páginas de leyes (tests + teoría)`)
    console.log(`   📊 ${totalUrls} URLs totales`)
    console.log(`🎯 Páginas principales de leyes + teoría - SIN artículos individuales`)
    
    return [...staticUrls, ...lawUrls]

  } catch (error) {
    console.error('❌ Error generando sitemap:', error)
    console.log('📋 Usando solo URLs estáticas como fallback')
    return staticUrls
  }
}