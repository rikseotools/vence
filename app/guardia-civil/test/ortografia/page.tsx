// app/guardia-civil/test/ortografia/page.tsx
// Página server-side para tests de ortografía y gramática de Guardia Civil
import { createClient } from '@supabase/supabase-js'
import SpellingTestLayout from '@/components/SpellingTestLayout'
import type { SpellingQuestionData } from '@/components/SpellingTestLayout'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test de Ortografía Guardia Civil | Vence',
  description: 'Practica ortografía y gramática para las oposiciones de Guardia Civil. Identifica las palabras mal escritas y las frases incorrectas.',
  keywords: ['ortografía guardia civil', 'gramática guardia civil', 'test ortografía oposiciones', 'lengua española guardia civil'],
}

// ISR: 1 hour
export const revalidate = 3600

const QUESTIONS_PER_TEST = 10

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface SpellingQuestionRow {
  id: string
  question_text: string
  options: { letter: string; text: string; isCorrectlyWritten: boolean }[]
  category: string
}

async function getRandomSpellingQuestions(
  category?: string,
  count: number = QUESTIONS_PER_TEST
): Promise<SpellingQuestionData[]> {
  const supabase = getSupabase()

  // Build query — fetch more than needed, shuffle client-side (Supabase doesn't have random ordering)
  let query = supabase
    .from('spelling_questions')
    .select('id, question_text, options, category')
    .eq('is_active', true)
    .eq('oposicion_slug', 'guardia-civil')

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  // Fetch a pool to randomize from
  const poolSize = Math.min(count * 5, 200)
  const { data, error } = await query.limit(poolSize)

  if (error || !data || data.length === 0) {
    console.error('❌ [Spelling] Error fetching questions:', error?.message)
    return []
  }

  // Shuffle and pick
  const shuffled = (data as SpellingQuestionRow[]).sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, count)

  // Strip isCorrectlyWritten from options (anti-scraping)
  return selected.map((q) => ({
    id: q.id,
    question_text: q.question_text,
    options: q.options.map(({ letter, text }) => ({ letter, text })),
    category: q.category as 'ortografia' | 'gramatica',
  }))
}

interface PageProps {
  searchParams: Promise<{ categoria?: string; n?: string }>
}

export default async function OrtografiaTestPage({ searchParams }: PageProps) {
  const params = await searchParams
  const category = params.categoria || 'all'
  const count = Math.min(Math.max(parseInt(params.n || '10', 10) || 10, 5), 50)

  const questions = await getRandomSpellingQuestions(category, count)

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center max-w-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            No hay preguntas disponibles
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Aún no se han importado preguntas de ortografía. Vuelve pronto.
          </p>
          <a
            href="/guardia-civil/test"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Volver a tests
          </a>
        </div>
      </div>
    )
  }

  return (
    <SpellingTestLayout
      questions={questions}
      backUrl="/guardia-civil/test"
      backText="Volver a tests"
      title={
        category === 'gramatica'
          ? 'Test de Gramática'
          : category === 'ortografia'
            ? 'Test de Ortografía'
            : 'Test de Ortografía y Gramática'
      }
    />
  )
}
