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

async function insertTableQuestion() {
  try {
    console.log('🔍 Inserting psychometric table question...\n')

    // 1. Verificar que existe la sección de tablas
    console.log('📋 STEP 1: Verificando sección de tablas...')
    const { data: section, error: sectionError } = await supabase
      .from('psychometric_sections')
      .select(`
        id,
        section_key,
        display_name,
        psychometric_categories!inner(id, category_key, display_name)
      `)
      .eq('section_key', 'tablas')
      .eq('psychometric_categories.category_key', 'capacidad-administrativa')
      .single()

    if (sectionError) {
      console.error('❌ Error finding tables section:', sectionError)
      return
    }

    console.log('✅ Section found:', section.display_name)
    console.log(`   - Section ID: ${section.id}`)
    console.log(`   - Category: ${section.psychometric_categories.display_name}`)

    // 2. Preparar datos de la pregunta
    console.log('\n📊 STEP 2: Preparando datos de la pregunta...')
    
    const questionData = {
      category_id: section.psychometric_categories.id,
      section_id: section.id,
      question_text: 'Analiza la información del seguro y marca las columnas correspondientes según los criterios dados.',
      content_data: {
        question_context: "Analiza la siguiente información sobre seguros y marca las opciones correctas según los criterios dados.",
        table_data: {
          example_row: {
            cantidad: "1000 EUROS",
            tipo: "VIDA", 
            fecha: "22/10/2016"
          }
        },
        criteria: [
          {
            column: "A",
            description: "Seguros de incendios o accidentes, desde 1500 a 4500 euros inclusive, contratado entre el 15 de marzo de 2016 y el 10 de mayo de 2017",
            conditions: {
              tipo: ["incendios", "accidentes"],
              cantidad_min: 1500,
              cantidad_max: 4500,
              fecha_inicio: "2016-03-15",
              fecha_fin: "2017-05-10"
            }
          },
          {
            column: "B", 
            description: "Seguros de vida o de accidentes, hasta 3000 euros inclusive, contratado entre el 15 de octubre de 2016 y el 20 de agosto de 2017",
            conditions: {
              tipo: ["vida", "accidentes"],
              cantidad_max: 3000,
              fecha_inicio: "2016-10-15",
              fecha_fin: "2017-08-20"
            }
          },
          {
            column: "C",
            description: "Seguros de incendios o de vida, desde 2000 a 5000 euros, inclusive, contratado entre el 10 de febrero de 2016 y el 15 de junio de 2017",
            conditions: {
              tipo: ["incendios", "vida"],
              cantidad_min: 2000,
              cantidad_max: 5000,
              fecha_inicio: "2016-02-10",
              fecha_fin: "2017-06-15"
            }
          }
        ],
        analysis_type: "multi_criteria_matching",
        example_analysis: {
          cantidad: 1000,
          tipo: "vida",
          fecha: "2016-10-22",
          matches: {
            A: false, // No es incendios ni accidentes
            B: true,  // Es vida, ≤3000€, fecha entre 15/10/2016 y 20/08/2017
            C: false  // Es vida pero <2000€
          }
        }
      },
      question_subtype: 'data_tables',
      option_a: 'A',
      option_b: 'D', 
      option_c: 'B',
      option_d: 'C',
      correct_option: 2, // C: respuesta B
      explanation: 'El seguro de vida de 1000€ con fecha 22/10/2016 cumple las condiciones de la columna B: es de vida o accidentes, no supera 3000€ y está contratado entre el 15 de octubre de 2016 y el 20 de agosto de 2017.',
      difficulty: 'medium',
      time_limit_seconds: 180, // 3 minutos para análisis de tabla
      is_active: true
    }

    // 3. Insertar la pregunta
    console.log('\n💾 STEP 3: Insertando pregunta...')
    const { data: newQuestion, error: insertError } = await supabase
      .from('psychometric_questions')
      .insert(questionData)
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error inserting question:', insertError)
      return
    }

    console.log('✅ Table question inserted successfully!')
    console.log(`   - Question ID: ${newQuestion.id}`)
    console.log(`   - Type: ${newQuestion.question_subtype}`)
    console.log(`   - Difficulty: ${newQuestion.difficulty}`)

    // 4. Verificar la inserción
    console.log('\n🔍 STEP 4: Verificando inserción...')
    const { data: verification, error: verifyError } = await supabase
      .from('psychometric_questions')
      .select(`
        id,
        question_text,
        question_subtype,
        psychometric_sections!inner(
          section_key,
          display_name,
          psychometric_categories!inner(category_key, display_name)
        )
      `)
      .eq('id', newQuestion.id)
      .single()

    if (verifyError) {
      console.error('❌ Error verifying:', verifyError)
      return
    }

    console.log('✅ Verification successful:')
    console.log(`   - Question: ${verification.question_text.substring(0, 50)}...`)
    console.log(`   - Section: ${verification.psychometric_sections.display_name}`)
    console.log(`   - Category: ${verification.psychometric_sections.psychometric_categories.display_name}`)

    console.log('\n🎉 TABLE QUESTION SETUP COMPLETE!')
    console.log('🌐 You can now test at: http://localhost:3000/auxiliar-administrativo-estado/test')
    console.log('   1. Click "Psicotécnicos"')
    console.log('   2. Click "Capacidad administrativa"') 
    console.log('   3. Select "Tablas" (should show 1 question)')
    console.log('   4. Click "Empezar Test"')

  } catch (error) {
    console.error('❌ Error:', error)
  }
}

insertTableQuestion()