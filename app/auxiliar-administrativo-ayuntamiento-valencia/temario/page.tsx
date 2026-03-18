// app/auxiliar-administrativo-ayuntamiento-valencia/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas - Ayuntamiento de Valencia OEP 2021-2025
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Derecho Constitucional',
    icon: '⚖️',
    count: 10,
    temas: [
      { id: 1, titulo: 'La Constitución Española de 1978', descripcion: 'Estructura y contenido. Principios generales. Derechos fundamentales y libertades públicas.' },
      { id: 2, titulo: 'La Corona', descripcion: 'Funciones constitucionales del Rey. Sucesión y regencia. El refrendo.' },
      { id: 3, titulo: 'Las Cortes Generales', descripcion: 'Composición, atribuciones y funcionamiento del Congreso y el Senado.' },
      { id: 4, titulo: 'El Gobierno y la Administración', descripcion: 'El Presidente del Gobierno. El Consejo de Ministros. Relaciones Gobierno-Cortes.' },
      { id: 5, titulo: 'El Poder Judicial', descripcion: 'Principios constitucionales. El Consejo General del Poder Judicial. El Tribunal Constitucional.' },
      { id: 6, titulo: 'Organización territorial del Estado', descripcion: 'Las Comunidades Autónomas. Los Estatutos de Autonomía. La Comunitat Valenciana.' },
      { id: 7, titulo: 'La Unión Europea', descripcion: 'Tratados. Instituciones. Derecho comunitario. Libertades fundamentales.' },
      { id: 8, titulo: 'Ley 39/2015 del Procedimiento Administrativo Común', descripcion: 'Disposiciones generales. Interesados. Actos administrativos. Procedimiento.' },
      { id: 9, titulo: 'Ley 40/2015 de Régimen Jurídico del Sector Público', descripcion: 'Disposiciones generales. Órganos administrativos. Principios de la potestad sancionadora.' },
      { id: 10, titulo: 'Estatuto Básico del Empleado Público', descripcion: 'TREBEP. Clases de personal. Derechos y deberes. Situaciones administrativas.' }
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Administración Local',
    icon: '🏛️',
    count: 11,
    temas: [
      { id: 11, titulo: 'El Municipio', descripcion: 'Concepto. Elementos del municipio. Organización municipal. Competencias.' },
      { id: 12, titulo: 'Régimen de funcionamiento de las entidades locales', descripcion: 'Sesiones y acuerdos. Actas. Impugnación de actos.' },
      { id: 13, titulo: 'El personal al servicio de las entidades locales', descripcion: 'Funcionarios. Personal laboral. Eventual. Directivos.' },
      { id: 14, titulo: 'Haciendas locales', descripcion: 'Clasificación de ingresos. Impuestos, tasas y contribuciones. Presupuestos locales.' },
      { id: 15, titulo: 'Contratos del Sector Público', descripcion: 'Ley 9/2017. Tipos de contratos. Procedimientos de adjudicación.' },
      { id: 16, titulo: 'La responsabilidad patrimonial de la Administración', descripcion: 'Principios. Procedimiento. Indemnización.' },
      { id: 17, titulo: 'Administración electrónica', descripcion: 'Sede electrónica. Identificación y firma electrónica. Funcionamiento electrónico del sector público.' },
      { id: 18, titulo: 'Protección de datos y transparencia', descripcion: 'LOPDGDD y RGPD. Ley 19/2013 de transparencia. Acceso a la información pública.' },
      { id: 19, titulo: 'Igualdad efectiva de mujeres y hombres', descripcion: 'LO 3/2007. Planes de igualdad. Violencia de género.', disponible: false },
      { id: 20, titulo: 'Prevención de Riesgos Laborales', descripcion: 'LPRL. Derechos y obligaciones. Servicios de prevención. Delegados de prevención.' },
      { id: 21, titulo: 'El Ayuntamiento de Valencia', descripcion: 'Reglamento Orgánico del Pleno. Organización y funcionamiento.', disponible: false }
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
            Temario Auxiliar Administrativo Ayuntamiento de Valencia
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme a la{' '}
            convocatoria OEP 2021-2025
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
          oposicion="auxiliar-administrativo-ayuntamiento-valencia"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Auxiliar Administrativo Ayuntamiento de Valencia</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-ayuntamiento-valencia/temario/tema-${tema.id}`}>
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
