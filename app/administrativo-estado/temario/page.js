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
    bloque2: false,
    bloque3: false,
    bloque4: false,
    bloque5: false,
    bloque6: false
  })

  const toggleBlock = (blockId) => {
    setExpandedBlocks(prev => ({
      ...prev,
      [blockId]: !prev[blockId]
    }))
  }

  // Bloque I: Organización del Estado y de la Administración pública (11 temas)
  const bloque1Temas = [
    { id: 1, titulo: 'La Constitución Española de 1978', descripcion: 'Características, estructura y principios. Derechos y deberes fundamentales. La protección y suspensión de los derechos.' },
    { id: 2, titulo: 'La Jefatura del Estado. La Corona', descripcion: 'Funciones constitucionales del Rey. Sucesión y regencia. El refrendo.' },
    { id: 3, titulo: 'Las Cortes Generales', descripcion: 'Composición, atribuciones y funcionamiento del Congreso y del Senado. Elaboración de las leyes.' },
    { id: 4, titulo: 'El Poder Judicial', descripcion: 'El Consejo General del Poder Judicial. El Tribunal Supremo. La organización judicial española.' },
    { id: 5, titulo: 'El Gobierno y la Administración', descripcion: 'Composición, organización y funciones. Relaciones con las Cortes Generales.' },
    { id: 6, titulo: 'El Gobierno Abierto', descripcion: 'Concepto y principios informadores. La Agenda 2030 y los Objetivos de Desarrollo Sostenible.' },
    { id: 7, titulo: 'La Ley 19/2013 de Transparencia', descripcion: 'Publicidad activa. Derecho de acceso a la información pública. Buen Gobierno.' },
    { id: 8, titulo: 'La Administración General del Estado', descripcion: 'Los Ministerios y su estructura. Órganos superiores y directivos. La Administración periférica.' },
    { id: 9, titulo: 'La Organización Territorial del Estado', descripcion: 'Las Comunidades Autónomas. Distribución de competencias Estado-CCAA.' },
    { id: 10, titulo: 'La Administración Local', descripcion: 'El municipio y la provincia. Organización y competencias. Otras entidades locales.' },
    { id: 11, titulo: 'La Organización de la Unión Europea', descripcion: 'El Consejo Europeo, el Consejo, el Parlamento Europeo, la Comisión y el Tribunal de Justicia.' }
  ]

  // Bloque II: Organización de oficinas públicas (4 temas)
  const bloque2Temas = [
    { id: 201, displayNum: 1, titulo: 'Atención al Público', descripcion: 'Acogida e información. Atención a personas con discapacidad. Servicios de información administrativa.' },
    { id: 202, displayNum: 2, titulo: 'Documento, Registro y Archivo', descripcion: 'El documento administrativo. Funciones del registro. Tipos de archivos.' },
    { id: 203, displayNum: 3, titulo: 'Administración Electrónica', descripcion: 'Sede electrónica. Firma electrónica. Notificaciones electrónicas. Cl@ve.' },
    { id: 204, displayNum: 4, titulo: 'Protección de Datos Personales', descripcion: 'Régimen jurídico. Principios y derechos. La Agencia Española de Protección de Datos.' }
  ]

  // Bloque III: Derecho administrativo general (7 temas)
  const bloque3Temas = [
    { id: 301, displayNum: 1, titulo: 'Las Fuentes del Derecho Administrativo', descripcion: 'La jerarquía de las fuentes. La Ley. Las disposiciones del Ejecutivo con fuerza de ley.' },
    { id: 302, displayNum: 2, titulo: 'El Acto Administrativo', descripcion: 'Concepto, clases y elementos. Motivación y notificación. Eficacia y validez.' },
    { id: 303, displayNum: 3, titulo: 'Las Leyes del Procedimiento Administrativo', descripcion: 'Ley 39/2015 y Ley 40/2015. Fases del procedimiento. Recursos administrativos.' },
    { id: 304, displayNum: 4, titulo: 'Los Contratos del Sector Público', descripcion: 'Tipos de contratos. Procedimientos de adjudicación. Ejecución y modificación.' },
    { id: 305, displayNum: 5, titulo: 'Procedimientos y Formas de la Actividad Administrativa', descripcion: 'La actividad de policía, de fomento y de servicio público.' },
    { id: 306, displayNum: 6, titulo: 'La Responsabilidad Patrimonial', descripcion: 'Régimen jurídico. Procedimiento de responsabilidad patrimonial.' },
    { id: 307, displayNum: 7, titulo: 'Políticas de Igualdad', descripcion: 'Igualdad de género. Violencia de género. Discapacidad.' }
  ]

  // Bloque IV: Gestión de personal (9 temas)
  const bloque4Temas = [
    { id: 401, displayNum: 1, titulo: 'El Personal al Servicio de las Administraciones', descripcion: 'Clases de personal. Derechos y deberes de los empleados públicos.' },
    { id: 402, displayNum: 2, titulo: 'Selección de Personal', descripcion: 'Principios. Sistemas selectivos. Órganos de selección.' },
    { id: 403, displayNum: 3, titulo: 'El Personal Funcionario', descripcion: 'Cuerpos y escalas. Grupos de clasificación. Carrera profesional.' },
    { id: 404, displayNum: 4, titulo: 'Adquisición y Pérdida de la Condición de Funcionario', descripcion: 'Requisitos. Situaciones administrativas. Pérdida de la condición.' },
    { id: 405, displayNum: 5, titulo: 'Provisión de Puestos de Trabajo', descripcion: 'Concurso y libre designación. Movilidad. Permutas.' },
    { id: 406, displayNum: 6, titulo: 'Las Incompatibilidades y Régimen Disciplinario', descripcion: 'Principios de incompatibilidad. Faltas y sanciones.' },
    { id: 407, displayNum: 7, titulo: 'El Régimen de Seguridad Social de los Funcionarios', descripcion: 'MUFACE. Prestaciones. Clases pasivas.' },
    { id: 408, displayNum: 8, titulo: 'El Personal Laboral', descripcion: 'Contrato de trabajo. Convenios colectivos. Derechos sindicales.' },
    { id: 409, displayNum: 9, titulo: 'El Régimen de Seguridad Social del Personal Laboral', descripcion: 'Régimen General. Prestaciones.' }
  ]

  // Bloque V: Gestión financiera (6 temas)
  const bloque5Temas = [
    { id: 501, displayNum: 1, titulo: 'El Presupuesto', descripcion: 'Concepto y contenido. Principios presupuestarios. El ciclo presupuestario.' },
    { id: 502, displayNum: 2, titulo: 'El Presupuesto del Estado en España', descripcion: 'Estructura. Clasificaciones orgánica, funcional y económica.' },
    { id: 503, displayNum: 3, titulo: 'El Procedimiento de Ejecución del Presupuesto de Gasto', descripcion: 'Fases del procedimiento. Documentos contables.' },
    { id: 504, displayNum: 4, titulo: 'Las Retribuciones e Indemnizaciones', descripcion: 'Retribuciones básicas y complementarias. Indemnizaciones por razón del servicio.' },
    { id: 505, displayNum: 5, titulo: 'Gastos para la Compra de Bienes y Servicios', descripcion: 'Contratación menor. Procedimientos de contratación.' },
    { id: 506, displayNum: 6, titulo: 'Gestión Económica y Financiera', descripcion: 'Control interno y externo. El Tribunal de Cuentas.' }
  ]

  // Bloque VI: Informática básica y ofimática (8 temas)
  const bloque6Temas = [
    { id: 601, displayNum: 1, titulo: 'Informática Básica', descripcion: 'Hardware y software. Sistemas operativos. Almacenamiento de datos.' },
    { id: 602, displayNum: 2, titulo: 'Sistema Operativo Windows', descripcion: 'Fundamentos. Configuración del sistema.' },
    { id: 603, displayNum: 3, titulo: 'El Explorador de Windows', descripcion: 'Gestión de carpetas y archivos. Búsquedas.' },
    { id: 604, displayNum: 4, titulo: 'Procesadores de Texto: Word 365', descripcion: 'Edición y formato de documentos. Tablas. Combinación de correspondencia.' },
    { id: 605, displayNum: 5, titulo: 'Hojas de Cálculo: Excel 365', descripcion: 'Fórmulas y funciones. Gráficos. Tablas dinámicas.' },
    { id: 606, displayNum: 6, titulo: 'Bases de Datos: Access 365', descripcion: 'Tablas, consultas, formularios e informes. Relaciones.' },
    { id: 607, displayNum: 7, titulo: 'Correo Electrónico: Outlook 365', descripcion: 'Envío y recepción. Calendario. Contactos.' },
    { id: 608, displayNum: 8, titulo: 'La Red Internet', descripcion: 'Navegación. Buscadores. Seguridad en la red.' }
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
  const renderTema = (tema, bloqueColor) => {
    const progress = user ? getTopicProgress(tema.id) : { accuracy: 0, questionsAnswered: 0 }
    const hasProgress = progress.questionsAnswered > 0
    const displayNumber = tema.displayNum || tema.id

    return (
      <Link
        key={tema.id}
        href={`/administrativo-estado/temario/tema-${tema.id}`}
        className={`group flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-${bloqueColor}-300 dark:hover:border-${bloqueColor}-600 hover:shadow-md transition-all duration-200 ${hasProgress ? getProgressBg(progress.accuracy) : ''}`}
      >
        {/* Número del tema */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-lg bg-${bloqueColor}-100 dark:bg-${bloqueColor}-900/30 flex items-center justify-center`}>
          <span className={`text-base font-bold text-${bloqueColor}-600 dark:text-${bloqueColor}-400`}>
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

  // Configuración de bloques
  const bloques = [
    { id: 'bloque1', titulo: 'Bloque I: Organización del Estado', icon: '🏛️', color: 'blue', temas: bloque1Temas, count: 11 },
    { id: 'bloque2', titulo: 'Bloque II: Organización de Oficinas Públicas', icon: '🏢', color: 'green', temas: bloque2Temas, count: 4 },
    { id: 'bloque3', titulo: 'Bloque III: Derecho Administrativo General', icon: '⚖️', color: 'purple', temas: bloque3Temas, count: 7 },
    { id: 'bloque4', titulo: 'Bloque IV: Gestión de Personal', icon: '👥', color: 'orange', temas: bloque4Temas, count: 9 },
    { id: 'bloque5', titulo: 'Bloque V: Gestión Financiera', icon: '💰', color: 'red', temas: bloque5Temas, count: 6 },
    { id: 'bloque6', titulo: 'Bloque VI: Informática y Ofimática', icon: '💻', color: 'teal', temas: bloque6Temas, count: 8 }
  ]

  const gradientColors = {
    blue: 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
    green: 'from-green-600 to-green-700 hover:from-green-700 hover:to-green-800',
    purple: 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800',
    orange: 'from-orange-600 to-orange-700 hover:from-orange-700 hover:to-orange-800',
    red: 'from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
    teal: 'from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800'
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
            Temario Administrativo del Estado
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
                <p><Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
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
          {bloques.map((bloque) => (
            <div key={bloque.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => toggleBlock(bloque.id)}
                className={`w-full bg-gradient-to-r ${gradientColors[bloque.color]} text-white py-4 px-6 text-left font-semibold transition-all duration-300 focus:outline-none`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{bloque.icon}</span>
                    <div>
                      <span className="text-lg">{bloque.titulo}</span>
                      <span className="ml-3 bg-white/20 px-2.5 py-0.5 rounded-full text-sm">
                        {bloque.count} temas
                      </span>
                    </div>
                  </div>
                  <svg
                    className={`w-5 h-5 transition-transform duration-300 ${expandedBlocks[bloque.id] ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {expandedBlocks[bloque.id] && (
                <div className="p-4 space-y-2 bg-gray-50 dark:bg-gray-900/50">
                  {bloque.temas.map((tema) => renderTema(tema, bloque.color))}
                </div>
              )}
            </div>
          ))}
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
              href="/administrativo-estado/test"
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
