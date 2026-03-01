// app/auxiliar-administrativo-madrid/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas - Comunidad de Madrid
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Organización Política',
    icon: '🏛️',
    count: 15,
    temas: [
      { id: 1, titulo: 'La Constitución Española de 1978', descripcion: 'La Constitución Española de 1978. Estructura y contenido. Derechos y deberes fundamentales.', disponible: true },
      { id: 2, titulo: 'El Estatuto de Autonomía de la Comunidad de Madrid', descripcion: 'Estatuto de Autonomía de la Comunidad de Madrid. Estructura, competencias y organización.', disponible: false },
      { id: 3, titulo: 'La Ley de Gobierno y Administración de la CAM', descripcion: 'Ley de Gobierno y Administración de la Comunidad de Madrid. Organización y funcionamiento.', disponible: false },
      { id: 4, titulo: 'Las fuentes del ordenamiento jurídico', descripcion: 'Las fuentes del derecho. La ley. El reglamento. Otras fuentes del ordenamiento jurídico.', disponible: true },
      { id: 5, titulo: 'El acto administrativo', descripcion: 'El acto administrativo. Concepto, clases y elementos. Eficacia. Nulidad y anulabilidad.', disponible: true },
      { id: 6, titulo: 'La Ley del Procedimiento Administrativo Común', descripcion: 'El procedimiento administrativo común. Fases del procedimiento. Ley 39/2015.', disponible: true },
      { id: 7, titulo: 'La Jurisdicción Contencioso-Administrativa', descripcion: 'La jurisdicción contencioso-administrativa. Recurso contencioso-administrativo.', disponible: true },
      { id: 8, titulo: 'Transparencia y Protección de Datos', descripcion: 'Transparencia, acceso a la información pública. Protección de datos personales.', disponible: true },
      { id: 9, titulo: 'Los contratos en el Sector Público', descripcion: 'Los contratos del sector público. Tipos. Procedimientos de adjudicación.', disponible: true },
      { id: 10, titulo: 'El Estatuto Básico del Empleado Público', descripcion: 'TREBEP. Clases de personal. Derechos y deberes de los empleados públicos.', disponible: true },
      { id: 11, titulo: 'La Seguridad Social', descripcion: 'El sistema español de Seguridad Social. Régimen general. Prestaciones.', disponible: true },
      { id: 12, titulo: 'Hacienda Pública y Presupuestos de la CAM', descripcion: 'La Hacienda de la Comunidad de Madrid. Presupuestos generales.', disponible: true },
      { id: 13, titulo: 'Igualdad de género y no discriminación', descripcion: 'Políticas de igualdad de género. Prevención de violencia de género. No discriminación.', disponible: true },
      { id: 14, titulo: 'Información administrativa y Administración electrónica', descripcion: 'Información y atención al ciudadano. Administración electrónica. Sede electrónica.', disponible: true },
      { id: 15, titulo: 'Los documentos administrativos', descripcion: 'Los documentos administrativos. Concepto y clases. El archivo administrativo.', disponible: true }
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Ofimática',
    icon: '💻',
    count: 6,
    temas: [
      { id: 16, titulo: 'El explorador de Windows', descripcion: 'El explorador de Windows. Gestión de archivos y carpetas. Configuración del sistema.', disponible: true },
      { id: 17, titulo: 'Procesadores de texto: Word', descripcion: 'Microsoft Word. Edición de documentos. Formato. Tablas. Herramientas avanzadas.', disponible: true },
      { id: 18, titulo: 'Hojas de cálculo: Excel', descripcion: 'Microsoft Excel. Celdas, fórmulas y funciones. Gráficos. Tablas dinámicas.', disponible: true },
      { id: 19, titulo: 'Bases de datos: Access y Power BI', descripcion: 'Microsoft Access. Tablas, consultas, formularios e informes. Power BI básico.', disponible: true },
      { id: 20, titulo: 'Correo electrónico: Outlook', descripcion: 'Microsoft Outlook. Gestión de correo, calendario, contactos y tareas.', disponible: true },
      { id: 21, titulo: 'Trabajo colaborativo: Microsoft 365', descripcion: 'Microsoft 365. Teams, SharePoint, OneDrive. Trabajo colaborativo en la nube.', disponible: true }
    ]
  }
]

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
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Temario Auxiliar Administrativo Comunidad de Madrid
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial de la Comunidad de Madrid
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="text-red-600 dark:text-red-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-madrid"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Auxiliar Administrativo Comunidad de Madrid</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-madrid/temario/tema-${tema.id}`}>
                      Tema {tema.id}: {tema.titulo} - {tema.descripcion}
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
