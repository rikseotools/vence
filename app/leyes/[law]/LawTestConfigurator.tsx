'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import TestConfigurator from '@/components/TestConfigurator'
import { getLawStats, type LawStats } from '@/lib/lawFetchers'
import { useAuth } from '@/contexts/AuthContext'
import { useLawSlugs } from '@/contexts/LawSlugContext'
import { buildLawRepasoFallosUrl } from '@/lib/test-url/lawRepasoFallosUrl'
import { decidirContadorArticulos } from '@/lib/laws/contadorArticulos'
import { emitClientEvent } from '@/lib/observability/client'

interface LawTestConfiguratorProps {
  lawShortName: string
  lawDisplayName: string
}

export default function LawTestConfigurator({ lawShortName, lawDisplayName }: LawTestConfiguratorProps) {
  const { getSlug: getCanonicalSlug } = useLawSlugs()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [lawStats, setLawStats] = useState<LawStats | null>(null)
  const searchParams = useSearchParams()
  const selectedArticlesParam = searchParams.get('selected_articles')
  const sourceParam = searchParams.get('source')
  // [T-367] Camino nuevo desde el temario ("Elegir qué artículos entran"): llega SIN
  // selected_articles (no dispara el auto-arranque de abajo) y con esto abre el panel
  // "Filtrar por Artículos" ya desplegado, en vez de obligar a pulsar "Mostrar" a ciegas.
  const abrirFiltroParam = searchParams.get('abrir_filtro') === '1'

  useEffect(() => {
    async function loadData() {
      try {
        const stats = await getLawStats(lawShortName)
        setLawStats(stats)
        if (!stats || stats.totalQuestions === 0) {
          setLoadError(true)
        }
      } catch (error) {
        console.error('Error loading law data:', error)
        setLoadError(true)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [lawShortName])

  // Si el contador de artículos contradice a las preguntas, callarlo NO basta: sin señal,
  // el próximo cruce de campos volvería a ser invisible hasta que alguien lo mire a ojo
  // (que es exactamente como se descubrió el de la LO 3/2007). `sospechoso` solo es cierto
  // cuando el dato es contradictorio, no cuando falta: una caché antigua no debe pitar.
  useEffect(() => {
    if (!lawStats) return
    const d = decidirContadorArticulos(lawStats.articlesWithQuestions, lawStats.totalQuestions)
    if (!d.sospechoso) return
    emitClientEvent({
      severity: 'warn',
      eventType: 'ui_contador_incoherente',
      metadata: {
        campo: 'articles_with_questions',
        motivo: d.motivo,
        ley: lawShortName,
        articulos: lawStats.articlesWithQuestions ?? null,
        preguntas: lawStats.totalQuestions ?? null,
      },
    })
  }, [lawStats, lawShortName])

  // Si hay artículos preseleccionados en la URL, iniciar el test automáticamente
  useEffect(() => {
    if (selectedArticlesParam && !loading && lawStats) {
      console.log('🎯 Auto-starting test with selected articles:', selectedArticlesParam)
      const canonicalSlug = getCanonicalSlug(lawShortName)
      const params = new URLSearchParams({
        n: '50', // Pedir muchas, el sistema devolverá las disponibles
        selected_articles: selectedArticlesParam,
        ...(sourceParam && { source: sourceParam })
      })
      window.location.href = `/leyes/${canonicalSlug}/avanzado?${params.toString()}`
    }
  }, [selectedArticlesParam, sourceParam, loading, lawStats, lawShortName])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 dark:text-gray-400 text-sm">Preparando test de {lawDisplayName}...</p>
      </div>
    )
  }

  if (loadError || !lawStats || lawStats.totalQuestions === 0) {
    return (
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-6 text-center">
        <p className="text-amber-800 dark:text-amber-200 font-medium">
          No hay preguntas disponibles para {lawDisplayName}
        </p>
        <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
          Estamos preparando el contenido. Prueba con otra ley o vuelve pronto.
        </p>
      </div>
    )
  }

  // Preparar datos para TestConfigurator.
  //
  // ⚠️ Aquí los tres campos valían `lawStats.totalQuestions`, incluidos los DOS de
  // artículos. La pantalla anunciaba «798 artículos disponibles» para la LO 3/2007 (que
  // tiene 134) justo encima de un selector con 136 casillas. Lo reportó Manolo García el
  // 30/07 preguntando por el filtro, y salió al verificarlo.
  //
  // El contador ya no se deduce: viene contado de la consulta (`articlesWithQuestions`) y
  // pasa por `decidirContadorArticulos`, que prefiere no enseñar nada antes que enseñar un
  // número que no es. `undefined` (no 0) cuando no hay dato: un 0 es una afirmación falsa.
  const contador = decidirContadorArticulos(lawStats?.articlesWithQuestions, lawStats?.totalQuestions)
  const lawsData = [{
    law_short_name: lawShortName,
    display_name: lawDisplayName,
    total_articles: contador.n ?? undefined,
    questions_count: lawStats?.totalQuestions || 0,
    articles_with_questions: contador.n ?? undefined,
  }]

  const difficultyStats = {
    total: lawStats?.totalQuestions || 0,
    easy: Math.floor((lawStats?.totalQuestions || 0) * 0.3),
    medium: Math.floor((lawStats?.totalQuestions || 0) * 0.5),
    hard: Math.floor((lawStats?.totalQuestions || 0) * 0.2),
    // También mantener las versiones en español por compatibilidad
    facil: Math.floor((lawStats?.totalQuestions || 0) * 0.3),
    medio: Math.floor((lawStats?.totalQuestions || 0) * 0.5),
    dificil: Math.floor((lawStats?.totalQuestions || 0) * 0.2)
  }

  // Debug log
  console.log('🔍 TestConfiguratorWrapper Debug:', {
    lawShortName,
    lawDisplayName,
    lawStats,
    difficultyStats,
    lawsData
  })

  // Validar que hay preguntas disponibles
  if (!lawStats || !lawStats.totalQuestions || isNaN(lawStats.totalQuestions)) {
    return (
      <div className="text-center p-8">
        <div className="text-5xl mb-4">📚</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">Esta ley aún no tiene preguntas de test</h3>
        <p className="text-gray-500 mb-4">Estamos trabajando en añadir preguntas para {lawShortName}.</p>
        <p className="text-sm text-gray-400">Mientras tanto puedes consultar la teoría de esta ley.</p>
      </div>
    )
  }

  return (
    <div>
      {/* TestConfigurator con ley preseleccionada */}
      <div className="law-test-configurator">
        <style jsx global>{`
          .law-test-configurator [data-testid="official-questions"],
          .law-test-configurator [data-testid="essential-articles"],
          .law-test-configurator label:has(span:contains("🏛️")),
          .law-test-configurator label:has(span:contains("⭐")),
          .law-test-configurator div:has(span:contains("🏛️")),
          .law-test-configurator div:has(span:contains("⭐")),
          .law-test-configurator *:has(> span:contains("🏛️")),
          .law-test-configurator *:has(> span:contains("⭐")),
          .law-test-configurator *:has(> *:contains("Preguntas oficiales")),
          .law-test-configurator *:has(> *:contains("artículos imprescindibles")) {
            display: none !important;
          }
        `}</style>
        <TestConfigurator
          // Explícito desde [T-541]. Antes se heredaba del valor por defecto del componente
          // compartido, así que esta pantalla de LEYES decidía por omisión y en silencio.
          positionType="auxiliar_administrativo_estado"
          tema={null} // Explícitamente null para que use lawsData
          totalQuestions={difficultyStats}
          userStats={difficultyStats as any}
          loading={false}
          currentUser={user}
          lawsData={lawsData}
          preselectedLaw={lawShortName}
          hideOfficialQuestions={true}
          hideEssentialArticles={true}
          initialShowLawsFilter={abrirFiltroParam}
          onStartTest={(config) => {
            console.log('Starting law test with config:', config)

            // 🔄 Modo repaso de falladas → ruta dedicada server-side.
            // El test normal (/avanzado → LawTestPageWrapper) NO sabe filtrar
            // por preguntas falladas; mezclarlo ahí devolvía la ley entera
            // (bug María 21/05/2026). /test/repaso-fallos-v2 calcula las
            // falladas en el servidor (scope=law) sin pasar listas de IDs.
            // Los ARTÍCULOS acotados sí se propagan (T-603): son la selección
            // que el usuario acaba de hacer con las casillas y hasta el 06/08
            // se perdían justo aquí, sin que la interfaz lo dijera.
            if (config.onlyFailedQuestions) {
              const failedUrl = buildLawRepasoFallosUrl({
                lawShortName,
                numQuestions: config.numQuestions,
                failedQuestionsOrder: config.failedQuestionsOrder,
                failedPeriod: config.failedPeriod,
                selectedArticles: config.selectedArticlesByLaw?.[lawShortName] ?? [],
              })
              console.log('🎯 Navegando a repaso de falladas:', failedUrl)
              window.location.href = failedUrl
              return
            }

            // Construir parámetros para el test de ley
            const params = new URLSearchParams({
              n: config.numQuestions.toString(),
              exclude_recent: config.excludeRecent.toString(),
              recent_days: config.recentDays.toString(),
              difficulty_mode: config.difficultyMode,
              ...(config.adaptiveMode && { adaptive: 'true' }),
              ...(config.timeLimit && { time_limit: config.timeLimit.toString() }),
              // 🆕 FILTRO DE SECCIONES/TÍTULOS (MULTI-SELECT)
              ...(config.selectedSectionFilters && config.selectedSectionFilters.length > 0 && {
                section_filters: JSON.stringify(config.selectedSectionFilters)
              }),
              // 🆕 FILTRO DE ARTÍCULOS ESPECÍFICOS
              ...(config.selectedArticlesByLaw && config.selectedArticlesByLaw[lawShortName] && config.selectedArticlesByLaw[lawShortName].length > 0 && {
                selected_articles: config.selectedArticlesByLaw[lawShortName].join(',')
              })
            })
            
            // Navegar al test avanzado de la ley (equivale a test personalizado)
            const canonicalSlug = getCanonicalSlug(lawShortName)
            const testUrl = `/leyes/${canonicalSlug}/avanzado?${params.toString()}`
            console.log('🎯 Navegando a:', testUrl)
            window.location.href = testUrl
          }}
        />
      </div>
    </div>
  )
}