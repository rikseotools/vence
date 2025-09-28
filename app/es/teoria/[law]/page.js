// app/es/teoria/[law]/page.js - VERSIÓN LIMPIA Y MINIMALISTA
// Solo muestra título de ley y lista simple de artículos
'use client'

import { useState, useEffect } from 'react'
import { fetchLawArticles, fetchMultipleArticlesOfficialExamData } from '../../../../lib/teoriaFetchers'
import { useAuth } from '../../../../contexts/AuthContext'
import Link from 'next/link'
import ArticleModal from '../../../../components/ArticleModal'
import { 
  ArrowLeftIcon
} from '@heroicons/react/24/outline'

export default function LawArticlesPage({ params, searchParams }) {
  const { user, supabase } = useAuth()
  const [lawData, setLawData] = useState(null)
  const [error, setError] = useState(null)
  const [problematicArticles, setProblematicArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [lawSlug, setLawSlug] = useState(null)
  const [notificationId, setNotificationId] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [officialExamData, setOfficialExamData] = useState({})
  const [userOposicion, setUserOposicion] = useState(null)

  // Resolver params en el cliente
  useEffect(() => {
    async function resolveParams() {
      const resolvedParams = await params
      const resolvedSearchParams = await searchParams
      setLawSlug(resolvedParams.law)
      setNotificationId(resolvedSearchParams?.notification_id)
    }
    resolveParams()
  }, [params, searchParams])

  // Cargar oposición del usuario
  useEffect(() => {
    async function loadUserOposicion() {
      if (!user || !supabase) return
      
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('target_oposicion')
          .eq('id', user.id)
          .single()
        
        if (!error && profile?.target_oposicion) {
          setUserOposicion(profile.target_oposicion)
        }
      } catch (err) {
        console.error('Error cargando oposición del usuario:', err)
      }
    }
    
    loadUserOposicion()
  }, [user, supabase])

  // Cargar datos de la ley
  useEffect(() => {
    async function loadLawData() {
      if (!lawSlug) return
      
      try {
        setLoading(true)
        const data = await fetchLawArticles(lawSlug)
        setLawData(data)
      } catch (err) {
        console.error('❌ Error cargando artículos:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    
    loadLawData()
  }, [lawSlug])

  // Cargar artículos problemáticos desde URL params
  useEffect(() => {
    function loadProblematicArticles() {
      if (!notificationId || !notificationId.startsWith('problematic-law-') || !lawData) return
      
      try {
        console.log('🔍 Iniciando loadProblematicArticles')
        console.log('🆔 notificationId:', notificationId)
        console.log('🏛️ lawData:', lawData?.law?.short_name)
        
        // NUEVO ENFOQUE: Buscar en searchParams si hay artículos específicos
        const urlParams = new URLSearchParams(window.location.search)
        const articlesParam = urlParams.get('articles')
        console.log('📄 URL articlesParam:', articlesParam)
        
        let problematicArticleNumbers = []
        
        if (articlesParam) {
          // Si vienen artículos en la URL (desde generateActionUrl)
          problematicArticleNumbers = articlesParam.split(',').map(num => num.trim())
          console.log('🔗 Artículos desde URL:', problematicArticleNumbers)
        } else {
          console.log('🔄 No hay artículos en URL, intentando extraer del notification_id')
          
          // FALLBACK: Intentar obtener desde el notification_id
          // El formato real es: problematic-law-Ley-40/2015-1
          const parts = notificationId.replace('problematic-law-', '').split('-')
          console.log('🧩 Partes del notification_id:', parts)
          
          // Buscar números en todas las partes
          const numbers = notificationId.match(/\d+/g)
          console.log('🔢 Números encontrados en ID:', numbers)
          
          // NUEVO FORMATO DINÁMICO: problematic-law-LAWNAME-articles-61,62,63
          const articlesIndex = parts.indexOf('articles')
          if (articlesIndex !== -1 && parts[articlesIndex + 1]) {
            // Formato nuevo: problematic-law-LAW-articles-61,62,63
            const articlesPart = parts.slice(articlesIndex + 1).join('-')
            problematicArticleNumbers = articlesPart.split(',').map(num => num.trim())
            console.log('✨ Artículos extraídos del nuevo formato:', problematicArticleNumbers)
          } else if (numbers && numbers.length > 0) {
            // FALLBACK: Formato antiguo o patrones alternativos
            const articleMatch = notificationId.match(/(?:Art\.?\s*|article[s]?[-_]?)(\d+)/i)
            if (articleMatch) {
              problematicArticleNumbers = [articleMatch[1]]
              console.log('🎯 Artículo extraído por patrón Art:', problematicArticleNumbers)
            } else {
              // Filtrar números excluyendo años y usar lógica inteligente
              const filteredNumbers = numbers.filter(num => {
                const num_int = parseInt(num)
                return num_int < 1000 && num_int > 0 // Excluir años y números no válidos
              })
              
              // Si hay múltiples números, usar todos excepto el último si es 1 (conteo)
              if (filteredNumbers.length > 1 && filteredNumbers[filteredNumbers.length - 1] === '1') {
                problematicArticleNumbers = filteredNumbers.slice(0, -1)
                console.log('🔄 Usando números filtrados (sin conteo):', problematicArticleNumbers)
              } else {
                problematicArticleNumbers = filteredNumbers
                console.log('🔄 Usando todos los números filtrados:', problematicArticleNumbers)
              }
            }
          }
        }
        
        if (problematicArticleNumbers.length > 0) {
          // Verificar que estos artículos existen en la ley actual
          const existingArticles = problematicArticleNumbers.filter(articleNum => 
            lawData.articles.some(article => article.article_number === articleNum)
          )
          
          // Ordenar artículos por número de forma numérica
          const sortedArticles = existingArticles.sort((a, b) => {
            const numA = parseInt(a)
            const numB = parseInt(b)
            return numA - numB
          })
          
          console.log('✅ Artículos problemáticos finales:', sortedArticles)
          setProblematicArticles(sortedArticles)
        } else {
          console.log('⚠️ No se encontraron artículos problemáticos específicos')
        }
      } catch (error) {
        console.error('❌ Error cargando artículos problemáticos:', error)
      }
    }
    
    loadProblematicArticles()
  }, [notificationId, lawData])

  // Cargar datos de examen oficial para artículos problemáticos
  useEffect(() => {
    async function loadOfficialExamData() {
      if (!problematicArticles || problematicArticles.length === 0 || !lawData?.law?.short_name) return
      
      try {
        console.log('🏛️ Cargando datos de examen oficial para artículos problemáticos:', problematicArticles)
        const examData = await fetchMultipleArticlesOfficialExamData(
          problematicArticles,
          lawData.law.short_name,
          userOposicion
        )
        setOfficialExamData(examData)
        console.log('✅ Datos de examen oficial cargados:', examData)
      } catch (error) {
        console.error('❌ Error cargando datos de examen oficial:', error)
      }
    }
    
    loadOfficialExamData()
  }, [problematicArticles, lawData?.law?.short_name, userOposicion])

  // Función para abrir modal del artículo
  const handleArticleClick = (e, articleNumber) => {
    e.preventDefault()
    console.log('🖱️ Click en artículo:', articleNumber)
    console.log('📋 lawSlug para modal:', lawSlug)
    setSelectedArticle(articleNumber)
    setIsModalOpen(true)
    console.log('🔓 Modal abierto:', true, 'Artículo:', articleNumber)
  }

  // Función para cerrar modal
  const closeModal = () => {
    setIsModalOpen(false)
    setSelectedArticle(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Cargando teoría...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error cargando contenido</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link 
            href="/es/teoria"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Volver a Teoría
          </Link>
        </div>
      </div>
    )
  }

  if (!lawData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-600">Cargando contenido...</p>
        </div>
      </div>
    )
  }

  const { articles, law } = lawData

  return (
    <div className="min-h-screen bg-white">
      {/* Header minimalista */}
      <div className="border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <Link 
              href="/es/teoria"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Volver a Teoría"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{law.short_name}</h1>
              {law.name !== law.short_name && (
                <p className="text-gray-600 text-sm mt-1">{law.name}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sección destacada de artículos problemáticos */}
      {problematicArticles.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 sm:p-6 shadow-lg">
            <div className="flex items-start space-x-3 mb-4">
              <span className="text-red-600 text-xl sm:text-2xl">🚨</span>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg sm:text-xl font-bold text-red-800">Artículos que necesitan tu atención</h2>
                <p className="text-red-700 text-sm mt-1">
                  Estos artículos han mostrado dificultades en tus respuestas recientes.
                </p>
              </div>
            </div>
            
            <div className="space-y-3">
              {articles
                .filter(article => problematicArticles.includes(article.article_number))
                .map((article) => (
                  <button 
                    key={article.id}
                    onClick={(e) => handleArticleClick(e, article.article_number)}
                    className="group block w-full text-left"
                  >
                    <div className="border-2 border-red-300 bg-white rounded-lg p-3 sm:p-4 hover:border-red-400 hover:bg-red-50 transition-all duration-200 shadow-sm">
                      {/* Layout móvil: stack vertical */}
                      <div className="sm:flex sm:items-center sm:justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Fila superior en móvil: badges */}
                          <div className="flex items-center space-x-2 mb-2 sm:mb-0">
                            <span className="flex-shrink-0 text-xs font-bold text-white bg-red-500 px-2 py-1 rounded">
                              Art. {article.article_number}
                            </span>
                            <span className="flex-shrink-0 text-red-600 text-xs font-bold bg-red-100 px-2 py-1 rounded">
                              ⚠️ PRIORITARIO
                            </span>
                            
                            {/* Badge de examen oficial */}
                            {officialExamData[article.article_number]?.hasOfficialExams && (
                              <span className="flex-shrink-0 text-xs font-bold text-white bg-blue-600 px-2 py-1 rounded">
                                🏛️ OFICIAL
                              </span>
                            )}
                          </div>
                          
                          {/* Título del artículo */}
                          <h3 className="text-red-900 font-semibold group-hover:text-red-700 transition-colors text-sm sm:text-base leading-tight">
                            {article.title}
                          </h3>
                          
                          {/* Información adicional de examen oficial */}
                          {officialExamData[article.article_number]?.hasOfficialExams && (
                            <div className="mt-1 text-xs text-blue-600">
                              {officialExamData[article.article_number].totalOfficialQuestions} pregunta{officialExamData[article.article_number].totalOfficialQuestions !== 1 ? 's' : ''} oficial{officialExamData[article.article_number].totalOfficialQuestions !== 1 ? 'es' : ''}
                              {officialExamData[article.article_number].latestExamDate && (
                                <span> • Último: {new Date(officialExamData[article.article_number].latestExamDate).getFullYear()}</span>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Flecha - oculta en móvil, visible en desktop */}
                        <div className="hidden sm:flex flex-shrink-0 text-red-500 group-hover:text-red-700 transition-colors ml-4">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
            </div>
            
            <div className="mt-4 pt-4 border-t border-red-200">
              <p className="text-red-600 text-xs sm:text-sm font-medium">
                💡 Consejo: Estudia estos artículos y luego practica con un test dirigido.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Separador visual si hay artículos problemáticos */}
      {problematicArticles.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
          <div className="flex items-center space-x-4">
            <hr className="flex-1 border-gray-300" />
            <span className="text-gray-500 text-sm font-medium">Todos los artículos de la ley</span>
            <hr className="flex-1 border-gray-300" />
          </div>
        </div>
      )}

      {/* Lista de artículos - Diseño minimalista */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {articles.length > 0 ? (
          <div className="space-y-3">
            {articles.map((article) => {
              const isProblematic = problematicArticles.includes(article.article_number)
              
              return (
                <Link 
                  key={article.id}
                  href={`/es/teoria/${law.slug}/articulo-${article.article_number}`}
                  className="group block"
                >
                  <div className={`border rounded-lg p-4 transition-all duration-200 ${
                    isProblematic 
                      ? 'border-red-300 bg-red-50/70 hover:border-red-400 hover:bg-red-50' 
                      : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          {/* Número de artículo */}
                          <span className={`flex-shrink-0 w-16 text-sm font-medium px-2 py-1 rounded ${
                            isProblematic 
                              ? 'text-red-700 bg-red-100' 
                              : 'text-blue-600 bg-blue-100'
                          }`}>
                            Art. {article.article_number}
                          </span>
                          
                          {/* Indicador de problema */}
                          {isProblematic && (
                            <span className="flex-shrink-0 text-red-600 text-sm font-medium">
                              ⚠️ Necesita atención
                            </span>
                          )}
                          
                          {/* Título del artículo */}
                          <h3 className={`font-medium transition-colors ${
                            isProblematic 
                              ? 'text-red-900 group-hover:text-red-700' 
                              : 'text-gray-900 group-hover:text-blue-600'
                          }`}>
                            {article.title}
                          </h3>
                        </div>
                      </div>
                      
                      {/* Flecha sutil */}
                      <div className={`flex-shrink-0 transition-colors ${
                        isProblematic 
                          ? 'text-red-400 group-hover:text-red-600' 
                          : 'text-gray-400 group-hover:text-blue-500'
                      }`}>
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay artículos disponibles
            </h3>
            <p className="text-gray-600">
              No se encontraron artículos para esta ley.
            </p>
          </div>
        )}

        {/* Footer minimalista */}
        <div className="mt-12 pt-6 border-t border-gray-200">
          <Link 
            href="/es/teoria"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-sm"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Volver a todas las leyes
          </Link>
        </div>
      </div>

      {/* Modal de artículo */}
      <ArticleModal
        isOpen={isModalOpen}
        onClose={closeModal}
        articleNumber={selectedArticle}
        lawSlug={lawSlug}
      />
    </div>
  )
}