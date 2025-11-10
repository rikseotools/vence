#!/usr/bin/env node

// scripts/import-tema11-procedimiento.js
// Importar preguntas oficiales del tema 11 (procedimiento administrativo) a la base de datos

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function importTema11Questions() {
  try {
    console.log('📚 IMPORTANDO PREGUNTAS TEMA 11 - PROCEDIMIENTO ADMINISTRATIVO\n')

    // Cargar el archivo de preguntas
    const questionsFilePath = path.join(process.cwd(), 'scripts/boe-importer-auditor/preguntas-tema11-oficiales.json')
    const questionsData = JSON.parse(fs.readFileSync(questionsFilePath, 'utf8'))
    
    console.log(`📊 Total de preguntas: ${questionsData.metadata.total_preguntas}`)
    console.log(`📅 Años incluidos: ${questionsData.metadata.años_incluidos.join(', ')}`)
    console.log(`🌐 Fuente: ${questionsData.metadata.fuente}\n`)

    // Mapear las leyes mencionadas a los IDs de la base de datos
    const lawMapping = await getLawMapping()
    
    let importedCount = 0
    let skippedCount = 0
    const errors = []

    for (const pregunta of questionsData.preguntas) {
      try {
        await importSingleQuestion(pregunta, lawMapping, questionsData.metadata)
        importedCount++
        
        if (importedCount % 10 === 0) {
          console.log(`✅ Importadas ${importedCount} preguntas...`)
        }
      } catch (error) {
        skippedCount++
        errors.push({
          pregunta: pregunta.numero,
          error: error.message
        })
        console.log(`⚠️ Error en pregunta ${pregunta.numero}: ${error.message}`)
      }
    }

    console.log(`\n📊 RESUMEN DE IMPORTACIÓN:`)
    console.log(`✅ Preguntas importadas: ${importedCount}`)
    console.log(`⚠️ Preguntas omitidas: ${skippedCount}`)
    
    if (errors.length > 0) {
      console.log(`\n❌ ERRORES ENCONTRADOS:`)
      errors.forEach(error => {
        console.log(`  - Pregunta ${error.pregunta}: ${error.error}`)
      })
    }

    console.log(`\n✅ Importación completada exitosamente`)

  } catch (error) {
    console.error('❌ Error en la importación:', error.message)
    process.exit(1)
  }
}

async function getLawMapping() {
  console.log('🔍 Obteniendo mapeo de leyes...')
  
  const { data: laws, error } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .in('short_name', ['Ley 39/2015', 'Ley 40/2015', 'CE', 'Ley 29/1998'])

  if (error) {
    throw new Error(`Error obteniendo leyes: ${error.message}`)
  }

  const mapping = {}
  laws.forEach(law => {
    mapping[law.short_name] = law.id
    // También mapear algunos alias
    if (law.short_name === 'CE') {
      mapping['Constitución Española'] = law.id
    }
  })

  console.log('📚 Leyes mapeadas:', Object.keys(mapping).join(', '))
  return mapping
}

async function importSingleQuestion(pregunta, lawMapping, metadata) {
  // Determinar qué ley corresponde a la pregunta
  let lawId = null
  let articleId = null
  
  if (pregunta.ley_mencionada) {
    lawId = lawMapping[pregunta.ley_mencionada]
    
    if (!lawId) {
      // Intentar mapear variaciones
      if (pregunta.ley_mencionada === 'Constitución Española' || pregunta.ley_mencionada === 'CE') {
        lawId = lawMapping['CE']
      }
    }
  }

  // Si tenemos artículo específico, buscar el ID del artículo
  if (lawId && pregunta.articulo) {
    const { data: article } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', lawId)
      .eq('article_number', pregunta.articulo)
      .single()
    
    if (article) {
      articleId = article.id
    }
  }

  // Si no tenemos artículo específico pero sí ley, usar el primer artículo de esa ley
  if (lawId && !articleId) {
    const { data: firstArticle } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', lawId)
      .order('article_number::integer')
      .limit(1)
      .single()
    
    if (firstArticle) {
      articleId = firstArticle.id
    }
  }

  // Si no encontramos artículo, usar artículo de procedimiento administrativo por defecto
  if (!articleId) {
    // Buscar artículo 1 de la Ley 39/2015 como fallback
    const ley39Id = lawMapping['Ley 39/2015']
    if (ley39Id) {
      const { data: defaultArticle } = await supabase
        .from('articles')
        .select('id')
        .eq('law_id', ley39Id)
        .eq('article_number', '1')
        .single()
      
      if (defaultArticle) {
        articleId = defaultArticle.id
      }
    }
  }

  if (!articleId) {
    throw new Error(`No se pudo encontrar artículo para la pregunta`)
  }

  // Crear la pregunta
  const questionData = {
    question_text: pregunta.pregunta,
    option_a: pregunta.opciones.a,
    option_b: pregunta.opciones.b,
    option_c: pregunta.opciones.c,
    option_d: pregunta.opciones.d,
    correct_option: pregunta.respuesta_correcta,
    explanation: `Pregunta oficial del examen ${pregunta.año_examen} del tema 11 (Procedimiento Administrativo).`,
    difficulty_level: 'medio',
    is_official: true,
    is_active: true,
    primary_article_id: articleId,
    source: `${metadata.fuente} - Examen ${pregunta.año_examen}`,
    source_url: metadata.sitio_web || null,
    created_at: new Date().toISOString()
  }

  const { error } = await supabase
    .from('questions')
    .insert([questionData])

  if (error) {
    // Si es error de duplicado, no es crítico
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      throw new Error('Pregunta duplicada (omitida)')
    }
    throw new Error(`Error insertando pregunta: ${error.message}`)
  }
}

// Ejecutar el script
if (process.env.NODE_ENV !== 'test') {
  importTema11Questions()
}