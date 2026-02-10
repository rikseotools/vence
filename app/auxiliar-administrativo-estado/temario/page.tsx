
// app/auxiliar-administrativo-estado/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Organización Pública',
    icon: '🏛️',
    count: 16,
    temas: [
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
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Actividad Administrativa y Ofimática',
    icon: '💻',
    count: 12,
    temas: [
      { id: 101, displayNum: 1, titulo: 'Atención al público', descripcion: 'Acogida e información. Atención de personas con discapacidad. Los servicios de información administrativa.' },
      { id: 102, displayNum: 2, titulo: 'Los servicios de información administrativa', descripcion: 'Información general y particular. Iniciativas, reclamaciones y quejas. Lenguas cooficiales.' },
      { id: 103, displayNum: 3, titulo: 'Concepto de documento, registro y archivo', descripcion: 'Funciones del registro. Tipos de archivos. Sistema de Interconexión de Registros.' },
      { id: 104, displayNum: 4, titulo: 'Administración electrónica', descripcion: 'Servicios al ciudadano. La firma electrónica. Notificación y sede electrónica. Cl@ve.' },
      { id: 105, displayNum: 5, titulo: 'Informática básica', descripcion: 'Conceptos fundamentales sobre hardware y software. Sistemas operativos. Almacenamiento de datos.', disponible: false },
      { id: 106, displayNum: 6, titulo: 'Introducción a Windows 11', descripcion: 'Fundamentos. Trabajo en el entorno gráfico. Configuración del sistema.', disponible: false },
      { id: 107, displayNum: 7, titulo: 'El Explorador de Windows 11', descripcion: 'Gestión de carpetas y archivos. Operaciones de búsqueda. Herramientas del sistema.', disponible: false },
      { id: 108, displayNum: 8, titulo: 'Procesadores de texto: Word', descripcion: 'Principales funciones y utilidades. Creación y estructuración del documento. Gestión, grabación e impresión.' },
      { id: 109, displayNum: 9, titulo: 'Hojas de cálculo: Excel', descripcion: 'Principales funciones y utilidades. Libros, hojas y celdas. Configuración. Fórmulas y funciones. Gráficos.' },
      { id: 110, displayNum: 10, titulo: 'Bases de datos: Access', descripcion: 'Principales funciones y utilidades. Tablas, consultas, formularios e informes. Relaciones.', disponible: false },
      { id: 111, displayNum: 11, titulo: 'Correo electrónico', descripcion: 'Conceptos elementales y funcionamiento. Microsoft 365: Outlook. Libreta de direcciones. Enviar y recibir mensajes.', disponible: false },
      { id: 112, displayNum: 12, titulo: 'La Red Internet', descripcion: 'Conceptos elementales. Navegación, favoritos e historial. Buscadores. Seguridad y protección.', disponible: false }
    ]
  }
]

// Obtener fecha formateada en el servidor
function getFechaActualizacion() {
  return new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export default function TemarioPage() {
  const fechaActualizacion = getFechaActualizacion()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={<div className="h-10" />}>
        <InteractiveBreadcrumbs />
      </Suspense>

      <div className="container mx-auto px-4 py-8">
        {/* Header - SSR para SEO */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Temario Auxiliar Administrativo del Estado
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme a la{' '}
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

        {/* Por qué es gratis - SSR para SEO */}
        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Componente cliente para interactividad */}
        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-estado"
          fechaActualizacion={fechaActualizacion}
        />

        {/* Lista de todos los temas para SEO (oculto visualmente pero indexable) */}
        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Auxiliar Administrativo del Estado</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-estado/temario/tema-${tema.id}`}>
                      Tema {'displayNum' in tema ? tema.displayNum : tema.id}: {tema.titulo} - {tema.descripcion}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
      </div>
    </div>
  )
}
