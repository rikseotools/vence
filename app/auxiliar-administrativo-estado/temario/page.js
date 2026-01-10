'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { useTopicUnlock } from '@/hooks/useTopicUnlock'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'

export default function TemarioPage() {
  const { user } = useAuth()
  const { getTopicProgress, loading } = useTopicUnlock()
  const [expandedBlocks, setExpandedBlocks] = useState({
    bloque1: true,
    bloque2: false
  })

  const toggleBlock = (blockId) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }))
  }

  // Bloque I: Organización Pública (16 temas)
  const bloque1Temas = [
    { id: 1, titulo: 'La Constitución Española de 1978', descripcion: 'Características, estructura y principios. Derechos y deberes fundamentales. La protección y suspensión de los derechos fundamentales.' },
    { id: 2, titulo: 'El Tribunal Constitucional. La Corona', descripcion: 'Composición y atribuciones del Tribunal Constitucional. La reforma de la Constitución. La Corona. Funciones constitucionales del Rey.' },
    { id: 3, titulo: 'Las Cortes Generales', descripcion: 'Composición, atribuciones y funcionamiento del Congreso y del Senado. El Defensor del Pueblo.' },
    { id: 4, titulo: 'El Poder Judicial', descripcion: 'El Poder Judicial en la Constitución. El Consejo General del Poder Judicial. El Tribunal Supremo. La organización judicial española.' },
    { id: 5, titulo: 'El Gobierno y la Administración', descripcion: 'El Gobierno en la Constitución. La Ley 50/1997. Composición, organización y funciones del Gobierno. Relaciones del Gobierno con las Cortes.' },
    { id: 6, titulo: 'El Gobierno Abierto', descripcion: 'Concepto y principios informadores. La Agenda 2030 y los Objetivos de Desarrollo Sostenible. La Agenda Digital para España.' },
    { id: 7, titulo: 'Ley 19/2013, de Transparencia', descripcion: 'Publicidad activa. Derecho de acceso a la información pública. El Consejo de Transparencia y Buen Gobierno. El Portal de la Transparencia.' },
    { id: 8, titulo: 'La Administración General del Estado', descripcion: 'Los Ministerios y su estructura interna. Los órganos superiores y directivos. Órganos y servicios comunes. La Administración periférica del Estado.' },
    { id: 9, titulo: 'La Organización Territorial del Estado', descripcion: 'Las Comunidades Autónomas. Los Estatutos de Autonomía. La Administración Local: principios constitucionales y regulación jurídica.' },
    { id: 10, titulo: 'La Unión Europea', descripcion: 'Los Tratados originarios y modificativos. Las instituciones: Consejo Europeo, Consejo, Parlamento Europeo, Comisión Europea y Tribunal de Justicia.' },
    { id: 11, titulo: 'Las Leyes del Procedimiento Administrativo', descripcion: 'Ley 39/2015 y Ley 40/2015. Los interesados. Los actos administrativos. El procedimiento administrativo común. La revisión de los actos.' },
    { id: 12, titulo: 'Protección de Datos Personales', descripcion: 'Régimen Jurídico. Principios y derechos. La Agencia Española de Protección de Datos. Garantía de los derechos digitales.' },
    { id: 13, titulo: 'El Personal Funcionario', descripcion: 'Clases de personal al servicio de las Administraciones Públicas. Adquisición y pérdida de la condición de funcionario. Situaciones administrativas.' },
    { id: 14, titulo: 'Derechos y Deberes de los Funcionarios', descripcion: 'Retribuciones. La Seguridad Social. Régimen de incompatibilidades. Régimen disciplinario.' },
    { id: 15, titulo: 'El Presupuesto del Estado', descripcion: 'Concepto y estructura. Los créditos presupuestarios. Modificaciones. Ejecución y control del presupuesto.' },
    { id: 16, titulo: 'Políticas de Igualdad', descripcion: 'Igualdad de género. Violencia de género. Discapacidad. Políticas dirigidas a la atención a personas dependientes.' }
  ]

  // Bloque II: Actividad Administrativa y Ofimática (12 temas, internamente 101-112)
  // Temas 105-112 son de informática y no tienen contenido legal disponible
  const bloque2Temas = [
    { id: 101, displayNum: 1, titulo: 'Atención al público', descripcion: 'Acogida e información. Atención de personas con discapacidad. Los servicios de información administrativa.' },
    { id: 102, displayNum: 2, titulo: 'Los servicios de información administrativa', descripcion: 'Información general y particular. Iniciativas, reclamaciones y quejas. Lenguas cooficiales.' },
    { id: 103, displayNum: 3, titulo: 'Concepto de documento, registro y archivo', descripcion: 'Funciones del registro. Tipos de archivos. Sistema de Interconexión de Registros.' },
    { id: 104, displayNum: 4, titulo: 'Administración electrónica', descripcion: 'Servicios al ciudadano. La firma electrónica. Notificación y sede electrónica. Cl@ve.' },
    { id: 105, displayNum: 5, titulo: 'Informática básica', descripcion: 'Conceptos fundamentales sobre hardware y software. Sistemas operativos. Almacenamiento de datos.', disponible: false },
    { id: 106, displayNum: 6, titulo: 'Introducción a Windows 11', descripcion: 'Fundamentos. Trabajo en el entorno gráfico. Configuración del sistema.', disponible: false },
    { id: 107, displayNum: 7, titulo: 'El Explorador de Windows 11', descripcion: 'Gestión de carpetas y archivos. Operaciones de búsqueda. Herramientas del sistema.', disponible: false },
    { id: 108, displayNum: 8, titulo: 'Procesadores de texto: Word', descripcion: 'Principales funciones y utilidades. Creación y estructuración del documento. Gestión, grabación e impresión.', disponible: false },
    { id: 109, displayNum: 9, titulo: 'Hojas de cálculo: Excel', descripcion: 'Principales funciones y utilidades. Libros, hojas y celdas. Configuración. Fórmulas y funciones. Gráficos.', disponible: false },
    { id: 110, displayNum: 10, titulo: 'Bases de datos: Access', descripcion: 'Principales funciones y utilidades. Tablas, consultas, formularios e informes. Relaciones.', disponible: false },
    { id: 111, displayNum: 11, titulo: 'Correo electrónico', descripcion: 'Conceptos elementales y funcionamiento. Microsoft 365: Outlook. Libreta de direcciones. Enviar y recibir mensajes.', disponible: false },
    { id: 112, displayNum: 12, titulo: 'La Red Internet', descripcion: 'Conceptos elementales. Navegación, favoritos e historial. Buscadores. Seguridad y protección.', disponible: false }
  ]

  const getProgressColor = (accuracy) => {
    if (accuracy >= 70) return 'bg-green-500'
    if (accuracy > 0) return 'bg-amber-500'
    return 'bg-gray-200'
  }

  const getProgressBg = (accuracy) => {
    if (accuracy >= 70) return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    if (accuracy > 0) return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
    return ''
  }

  // Renderizar un tema individual
  const renderTema = (tema) => {
    const progress = user ? getTopicProgress(tema.id) : { accuracy: 0, questionsAnswered: 0 }
    const hasProgress = progress.questionsAnswered > 0
    const displayNumber = tema.displayNum || tema.id
    const isDisponible = tema.disponible !== false

    // Tema no disponible - renderizar como div no clickeable
    if (!isDisponible) {
      return (
        <div
          key={tema.id}
          className="flex items-center gap-4 p-4 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60"
        >
          {/* Número del tema */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
            <span className="text-base font-bold text-gray-400 dark:text-gray-500">
              {displayNumber}
            </span>
          </div>

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-500 dark:text-gray-400">
              {tema.titulo}
            </h3>
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Tema no disponible
            </p>
          </div>

          {/* Icono de candado y texto */}
          <div className="flex-shrink-0 flex items-center gap-1.5 text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="text-xs font-medium hidden sm:inline">No disponible</span>
          </div>
        </div>
      )
    }

    return (
      <Link
        key={tema.id}
        href={`/auxiliar-administrativo-estado/temario/tema-${tema.id}`}
        className={`group flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200 ${hasProgress ? getProgressBg(progress.accuracy) : ''}`}
      >
        {/* Número del tema */}
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
          <span className="text-base font-bold text-blue-600 dark:text-blue-400">
            {displayNumber}
          </span>
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {tema.titulo}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {tema.descripcion}
          </p>
        </div>

        {/* Progreso o flecha */}
        <div className="flex-shrink-0 flex items-center gap-3">
          {hasProgress && (
            <div className="text-right hidden sm:block">
              <div className={`text-sm font-semibold ${progress.accuracy >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                {progress.accuracy}%
              </div>
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getProgressColor(progress.accuracy)}`}
                  style={{ width: `${Math.min(100, progress.accuracy)}%` }}
                />
              </div>
            </div>
          )}
          <svg
            className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </Link>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando temario...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <InteractiveBreadcrumbs />

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Temario Auxiliar Administrativo del Estado
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}</span> conforme a la{' '}
            <a
              href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              última convocatoria (BOE 22/12/2025)
            </a>
          </p>
        </div>

        {/* Por qué es gratis */}
        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Banner registro para usuarios no logueados */}
        {!user && (
          <div className="max-w-4xl mx-auto mb-8 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-900 dark:text-white">Siempre actualizado.</span>{' '}
                  Regístrate para recibir avisos cuando cambie la legislación.
                </p>
              </div>
              <Link
                href="/login"
                className="flex-shrink-0 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Crear cuenta gratis
              </Link>
            </div>
          </div>
        )}

        {/* Bloques del temario */}
        <div className="max-w-4xl mx-auto space-y-4">

          {/* BLOQUE I: Organización Pública */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleBlock('bloque1')}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 text-left font-semibold transition-all duration-300 hover:from-blue-700 hover:to-blue-800 focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏛️</span>
                  <div>
                    <span className="text-lg">Bloque I: Organización Pública</span>
                    <span className="ml-3 bg-white/20 px-2.5 py-0.5 rounded-full text-sm">
                      16 temas
                    </span>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 transition-transform duration-300 ${expandedBlocks.bloque1 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedBlocks.bloque1 && (
              <div className="p-4 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                {bloque1Temas.map((tema) => renderTema(tema))}
              </div>
            )}
          </div>

          {/* BLOQUE II: Actividad Administrativa y Ofimática */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => toggleBlock('bloque2')}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-4 px-6 text-left font-semibold transition-all duration-300 hover:from-blue-700 hover:to-blue-800 focus:outline-none"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">💻</span>
                  <div>
                    <span className="text-lg">Bloque II: Actividad Administrativa y Ofimática</span>
                    <span className="ml-3 bg-white/20 px-2.5 py-0.5 rounded-full text-sm">
                      12 temas
                    </span>
                  </div>
                </div>
                <svg
                  className={`w-5 h-5 transition-transform duration-300 ${expandedBlocks.bloque2 ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {expandedBlocks.bloque2 && (
              <div className="p-4 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                {bloque2Temas.map((tema) => renderTema(tema))}
              </div>
            )}
          </div>
        </div>

        {/* Footer con acceso rápido a tests */}
        <div className="max-w-4xl mx-auto mt-10 p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                ¿Prefieres practicar con tests?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pon a prueba tus conocimientos con preguntas de exámenes oficiales
              </p>
            </div>
            <Link
              href="/auxiliar-administrativo-estado/test"
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
            >
              Ir a Tests
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
