// app/auxiliar-administrativo-carm/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas - BORM 17/10/2016
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Derecho Constitucional y Administrativo',
    icon: '⚖️',
    count: 9,
    temas: [
      { id: 1, titulo: 'La Constitución Española de 1978', descripcion: 'Título Preliminar. Derechos fundamentales y libertades públicas. Garantías y suspensión de derechos.' },
      { id: 2, titulo: 'Estatuto de Autonomía de la Región de Murcia', descripcion: 'Estructura y contenido del Estatuto de Autonomía. Competencias de la Comunidad Autónoma.', disponible: false },
      { id: 3, titulo: 'El Presidente y Consejo de Gobierno de Murcia', descripcion: 'El Presidente de la Comunidad Autónoma. El Consejo de Gobierno: composición y funciones.', disponible: false },
      { id: 4, titulo: 'Régimen Jurídico del Sector Público', descripcion: 'Ley 40/2015. Principios de actuación y funcionamiento. Órganos administrativos.' },
      { id: 5, titulo: 'Disposiciones y actos administrativos', descripcion: 'Ley 39/2015. Requisitos de los actos administrativos. Eficacia. Nulidad y anulabilidad.' },
      { id: 6, titulo: 'El procedimiento administrativo', descripcion: 'Ley 39/2015. Iniciación, ordenación, instrucción y finalización del procedimiento.' },
      { id: 7, titulo: 'Revisión de actos en vía administrativa', descripcion: 'Revisión de oficio. Recursos administrativos. Responsabilidad patrimonial de la Administración.' },
      { id: 8, titulo: 'Estatuto Básico del Empleado Público', descripcion: 'TREBEP. Clases de personal. Derechos y deberes. Situaciones administrativas.' },
      { id: 9, titulo: 'Contratos del Sector Público', descripcion: 'Ley 9/2017. Ámbito de aplicación. Tipos de contratos. Disposiciones comunes.' }
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Gestión y Administración Pública',
    icon: '📋',
    count: 7,
    temas: [
      { id: 10, titulo: 'Hacienda de la Región de Murcia', descripcion: 'Ley de Hacienda de la Región de Murcia. Presupuestos. Gastos e ingresos.', disponible: false },
      { id: 11, titulo: 'Administración electrónica', descripcion: 'Sede electrónica. Identificación y firma electrónica. Funcionamiento electrónico del sector público.' },
      { id: 12, titulo: 'Información administrativa y atención al ciudadano', descripcion: 'Servicios de información administrativa. Atención al ciudadano. Quejas y sugerencias.' },
      { id: 13, titulo: 'Archivos y Patrimonio Documental de Murcia', descripcion: 'Sistema de archivos. Patrimonio documental de la Región de Murcia.', disponible: false },
      { id: 14, titulo: 'Los documentos administrativos', descripcion: 'Concepto y clases de documentos. El expediente administrativo. Copias.' },
      { id: 15, titulo: 'Prevención de Riesgos Laborales', descripcion: 'LPRL. Derechos y obligaciones. Servicios de prevención. Delegados de prevención.' },
      { id: 16, titulo: 'Igualdad, Transparencia y Protección de datos', descripcion: 'LO 3/2007 de igualdad. Ley 19/2013 de transparencia. LOPDGDD y RGPD.' }
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
            Temario Auxiliar Administrativo CARM
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial BORM 17/10/2016
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="text-amber-600 dark:text-amber-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-carm"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Auxiliar Administrativo CARM</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-carm/temario/tema-${tema.id}`}>
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
