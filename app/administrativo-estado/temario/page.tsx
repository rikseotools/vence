
// app/administrativo-estado/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Organización del Estado',
    icon: '🏛️',
    count: 11,
    temas: [
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
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Organización de Oficinas Públicas',
    icon: '🏢',
    count: 4,
    temas: [
      { id: 201, displayNum: 1, titulo: 'Atención al Público', descripcion: 'Acogida e información. Atención a personas con discapacidad. Servicios de información administrativa.' },
      { id: 202, displayNum: 2, titulo: 'Documento, Registro y Archivo', descripcion: 'El documento administrativo. Funciones del registro. Tipos de archivos.' },
      { id: 203, displayNum: 3, titulo: 'Administración Electrónica', descripcion: 'Sede electrónica. Firma electrónica. Notificaciones electrónicas. Cl@ve.' },
      { id: 204, displayNum: 4, titulo: 'Protección de Datos Personales', descripcion: 'Régimen jurídico. Principios y derechos. La Agencia Española de Protección de Datos.' }
    ]
  },
  {
    id: 'bloque3',
    titulo: 'Bloque III: Derecho Administrativo General',
    icon: '⚖️',
    count: 7,
    temas: [
      { id: 301, displayNum: 1, titulo: 'Las Fuentes del Derecho Administrativo', descripcion: 'La jerarquía de las fuentes. La Ley. Las disposiciones del Ejecutivo con fuerza de ley.' },
      { id: 302, displayNum: 2, titulo: 'El Acto Administrativo', descripcion: 'Concepto, clases y elementos. Motivación y notificación. Eficacia y validez.' },
      { id: 303, displayNum: 3, titulo: 'Las Leyes del Procedimiento Administrativo', descripcion: 'Ley 39/2015 y Ley 40/2015. Fases del procedimiento. Recursos administrativos.' },
      { id: 304, displayNum: 4, titulo: 'Los Contratos del Sector Público', descripcion: 'Tipos de contratos. Procedimientos de adjudicación. Ejecución y modificación.' },
      { id: 305, displayNum: 5, titulo: 'Procedimientos y Formas de la Actividad Administrativa', descripcion: 'La actividad de policía, de fomento y de servicio público.' },
      { id: 306, displayNum: 6, titulo: 'La Responsabilidad Patrimonial', descripcion: 'Régimen jurídico. Procedimiento de responsabilidad patrimonial.' },
      { id: 307, displayNum: 7, titulo: 'Políticas de Igualdad', descripcion: 'Igualdad de género. Violencia de género. Discapacidad. Políticas LGTBI (novedad BOE 2025).' }
    ]
  },
  {
    id: 'bloque4',
    titulo: 'Bloque IV: Gestión de Personal',
    icon: '👥',
    count: 9,
    temas: [
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
  },
  {
    id: 'bloque5',
    titulo: 'Bloque V: Gestión Financiera',
    icon: '💰',
    count: 6,
    temas: [
      { id: 501, displayNum: 1, titulo: 'El Presupuesto', descripcion: 'Concepto y contenido. Principios presupuestarios. El ciclo presupuestario.' },
      { id: 502, displayNum: 2, titulo: 'El Presupuesto del Estado en España', descripcion: 'Estructura. Clasificaciones orgánica, funcional y económica.' },
      { id: 503, displayNum: 3, titulo: 'El Procedimiento de Ejecución del Presupuesto de Gasto', descripcion: 'Fases del procedimiento. Documentos contables.' },
      { id: 504, displayNum: 4, titulo: 'Las Retribuciones e Indemnizaciones', descripcion: 'Retribuciones básicas y complementarias. Indemnizaciones por razón del servicio.' },
      { id: 505, displayNum: 5, titulo: 'Gastos para la Compra de Bienes y Servicios', descripcion: 'Contratación menor. Procedimientos de contratación.' },
      { id: 506, displayNum: 6, titulo: 'Gestión Económica y Financiera', descripcion: 'Control interno y externo. El Tribunal de Cuentas.' }
    ]
  },
  {
    id: 'bloque6',
    titulo: 'Bloque VI: Informática y Ofimática',
    icon: '💻',
    count: 8,
    temas: [
      { id: 601, displayNum: 1, titulo: 'Informática Básica', descripcion: 'Hardware y software. Sistemas operativos. Almacenamiento de datos.' },
      { id: 602, displayNum: 2, titulo: 'Sistema Operativo Windows', descripcion: 'Fundamentos. Configuración del sistema. Copilot de Windows (novedad BOE 2025).' },
      { id: 603, displayNum: 3, titulo: 'El Explorador de Windows', descripcion: 'Gestión de carpetas y archivos. Búsquedas.' },
      { id: 604, displayNum: 4, titulo: 'Procesadores de Texto: Word 365', descripcion: 'Edición y formato de documentos. Tablas. Combinación de correspondencia.' },
      { id: 605, displayNum: 5, titulo: 'Hojas de Cálculo: Excel 365', descripcion: 'Fórmulas y funciones. Gráficos. Tablas dinámicas.' },
      { id: 606, displayNum: 6, titulo: 'Bases de Datos: Access 365', descripcion: 'Tablas, consultas, formularios e informes. Relaciones.' },
      { id: 607, displayNum: 7, titulo: 'Correo Electrónico: Outlook 365', descripcion: 'Envío y recepción. Calendario. Contactos.' },
      { id: 608, displayNum: 8, titulo: 'La Red Internet', descripcion: 'Navegación. Buscadores. Seguridad en la red.' }
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
            Temario Administrativo del Estado
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
          oposicion="administrativo-estado"
          fechaActualizacion={fechaActualizacion}
        />

        {/* Lista de todos los temas para SEO (oculto visualmente pero indexable) */}
        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Administrativo del Estado</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/administrativo-estado/temario/tema-${tema.id}`}>
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
