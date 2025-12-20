// app/test/[law]/articulos-dirigido/page.js - CORREGIDO PARA NEXT.JS 15
import TestPageWrapper from '@/components/TestPageWrapper'

// ✅ CAMBIO 1: Hacer la función async
export default async function TestArticulosDirigidoPage({ params, searchParams }) {
  // ✅ CAMBIO 2: Await params y searchParams (requerido en Next.js 15)
  const resolvedParams = await params
  const resolvedSearchParams = await searchParams
  
  // ✅ CAMBIO 3: Usar resolvedParams en lugar de params directamente
  const lawName = decodeURIComponent(resolvedParams.law)
  
  return (
    <TestPageWrapper
      tema={null} // No específico de tema, usa ley + artículos
      testType="articulos-dirigido"
      customTitle={`Test Dirigido: ${lawName}`}
      customDescription="Artículos problemáticos detectados"
      customIcon="🎯"
      customColor="from-red-500 to-pink-600"
      customSubtitle="Enfocado en tus áreas de mejora específicas"
      loadingMessage={`🎯 Preparando test dirigido de ${lawName}...`}
      // ✅ CAMBIO 4: Cambiar función por string identifier
      customQuestionFetcher="articulos-dirigido"
      // ✅ CAMBIO 5: Pasar datos como props individuales
      lawName={lawName}
      searchParams={resolvedSearchParams}
    />
  )
}