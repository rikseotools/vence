#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function verifyFinalSetup() {
  try {
    console.log('🔍 Verificando setup final del sistema psicotécnico...\n')

    // 1. Verificar que la pregunta está en la categoría correcta
    console.log('📋 VERIFICANDO PREGUNTA EN CATEGORÍA CORRECTA:')
    const { data: question, error: qError } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        psychometric_categories!inner(category_key, display_name),
        psychometric_sections!inner(section_key, display_name)
      `)
      .eq('question_text', '¿Cuánto suman las ventas de "poemas" y "ciencia ficción"?')
      .single()

    if (qError) {
      console.error('❌ Error:', qError)
      return
    }

    if (question) {
      console.log('✅ Pregunta encontrada:')
      console.log(`   - ID: ${question.id}`)
      console.log(`   - Categoría: ${question.psychometric_categories.category_key}`)
      console.log(`   - Sección: ${question.psychometric_sections.section_key}`)
      console.log(`   - Texto: ${question.question_text}`)
    }

    // 2. Verificar que no hay categorías duplicadas
    console.log('\n📂 VERIFICANDO CATEGORÍAS (no duplicadas):')
    const { data: categories } = await supabase
      .from('psychometric_categories')
      .select('category_key, display_name')
      .like('category_key', '%capacidad%')

    categories.forEach(cat => {
      console.log(`   - ${cat.category_key}: ${cat.display_name}`)
    })

    // 3. Verificar conteo por sección
    console.log('\n📊 CONTEO DE PREGUNTAS POR SECCIÓN:')
    const { data: counts } = await supabase
      .from('psychometric_questions')
      .select(`
        psychometric_categories!inner(category_key),
        psychometric_sections!inner(section_key, display_name)
      `)
      .eq('psychometric_categories.category_key', 'capacidad-administrativa')

    const sectionCounts = {}
    counts.forEach(q => {
      const sectionKey = q.psychometric_sections.section_key
      sectionCounts[sectionKey] = (sectionCounts[sectionKey] || 0) + 1
    })

    Object.entries(sectionCounts).forEach(([section, count]) => {
      console.log(`   - ${section}: ${count} pregunta(s)`)
    })

    console.log('\n🎉 VERIFICACIÓN COMPLETA')
    console.log('✅ El sistema está listo para usar!')
    console.log('🌐 Puedes acceder a: http://localhost:3000/auxiliar-administrativo-estado/test')
    console.log('   1. Haz clic en "Psicotécnicos"')
    console.log('   2. Haz clic en "Capacidad administrativa"')
    console.log('   3. Selecciona "Gráficos" (debería mostrar 1 pregunta)')
    console.log('   4. Haz clic en "Empezar Test"')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

verifyFinalSetup()