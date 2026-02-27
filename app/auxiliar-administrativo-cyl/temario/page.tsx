// app/auxiliar-administrativo-cyl/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los grupos y temas - BOCYL enero 2026
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Grupo I: Organización Política y Administrativa',
    icon: '⚖️',
    count: 19,
    temas: [
      { id: 1, titulo: 'La Constitución Española', descripcion: 'La Constitución Española de 1978. Estructura y contenido. Derechos y deberes fundamentales.', disponible: true },
      { id: 2, titulo: 'La Administración General del Estado', descripcion: 'Organización de la Administración General del Estado. Órganos centrales y periféricos.', disponible: true },
      { id: 3, titulo: 'La Administración local y organización territorial de CyL', descripcion: 'La Administración local. Organización territorial de Castilla y León.', disponible: false },
      { id: 4, titulo: 'La Unión Europea', descripcion: 'La Unión Europea. Instituciones y órganos. Derecho comunitario.', disponible: true },
      { id: 5, titulo: 'El Estatuto de Autonomía de Castilla y León', descripcion: 'El Estatuto de Autonomía de Castilla y León. Estructura y contenido. Competencias.', disponible: false },
      { id: 6, titulo: 'Las Cortes de Castilla y León', descripcion: 'Las Cortes de Castilla y León. Composición, organización y funciones.', disponible: false },
      { id: 7, titulo: 'Instituciones propias de CyL', descripcion: 'Instituciones propias de la Comunidad de Castilla y León.', disponible: false },
      { id: 8, titulo: 'El Gobierno de CyL', descripcion: 'El Gobierno de Castilla y León. El Presidente de la Junta. Los Consejeros.', disponible: false },
      { id: 9, titulo: 'La Administración de CyL', descripcion: 'La Administración de la Comunidad de Castilla y León. Organización y estructura.', disponible: false },
      { id: 10, titulo: 'El sector público de CyL', descripcion: 'El sector público de la Comunidad de Castilla y León. Organismos y entidades.', disponible: false },
      { id: 11, titulo: 'Las fuentes del derecho administrativo', descripcion: 'Las fuentes del derecho administrativo. La ley. El reglamento. Otras fuentes.', disponible: true },
      { id: 12, titulo: 'El acto administrativo', descripcion: 'El acto administrativo. Concepto, clases y elementos. Eficacia. Nulidad y anulabilidad.', disponible: true },
      { id: 13, titulo: 'El procedimiento administrativo común', descripcion: 'El procedimiento administrativo común. Fases del procedimiento. Ley 39/2015.', disponible: true },
      { id: 14, titulo: 'Órganos de las Administraciones Públicas', descripcion: 'Órganos de las Administraciones Públicas. Competencia. Abstención y recusación.', disponible: true },
      { id: 15, titulo: 'El Estatuto Básico del Empleado Público', descripcion: 'TREBEP. Clases de personal al servicio de las Administraciones Públicas. Derechos y deberes.', disponible: true },
      { id: 16, titulo: 'La Función Pública de Castilla y León', descripcion: 'La Función Pública de la Administración de Castilla y León. Cuerpos y escalas.', disponible: false },
      { id: 17, titulo: 'Sindicación, huelga e incompatibilidades', descripcion: 'Libertad sindical y derecho de huelga. Régimen de incompatibilidades del personal.', disponible: true },
      { id: 18, titulo: 'El presupuesto de CyL', descripcion: 'El presupuesto de la Comunidad de Castilla y León. Estructura y elaboración.', disponible: false },
      { id: 19, titulo: 'Políticas de igualdad y no discriminación en CyL', descripcion: 'Políticas de igualdad de género. Prevención de violencia de género. No discriminación.', disponible: false }
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Grupo II: Competencias',
    icon: '📋',
    count: 9,
    temas: [
      { id: 20, titulo: 'Derechos de las personas y atención al público', descripcion: 'Derechos de las personas en sus relaciones con las Administraciones. Atención al público.', disponible: true },
      { id: 21, titulo: 'Oficinas de asistencia en materia de registros', descripcion: 'Oficinas de asistencia en materia de registros. Presentación de documentos.', disponible: false },
      { id: 22, titulo: 'Administración electrónica', descripcion: 'Administración electrónica. Sede electrónica. Identificación y firma electrónica.', disponible: false },
      { id: 23, titulo: 'Transparencia y protección de datos', descripcion: 'Transparencia, acceso a la información pública y buen gobierno. Protección de datos personales.', disponible: false },
      { id: 24, titulo: 'El documento y archivo administrativo', descripcion: 'El documento administrativo. Concepto y clases. El archivo administrativo.', disponible: true },
      { id: 25, titulo: 'Informática básica y Windows 11', descripcion: 'Conceptos informáticos básicos. Sistema operativo Windows 11.', disponible: true },
      { id: 26, titulo: 'Word y Excel para Microsoft 365', descripcion: 'Procesador de textos Word. Hoja de cálculo Excel. Entorno Microsoft 365.', disponible: true },
      { id: 27, titulo: 'Correo electrónico e Internet', descripcion: 'Correo electrónico. Outlook. Navegación por Internet. Búsqueda de información.', disponible: true },
      { id: 28, titulo: 'Seguridad y salud en el puesto de trabajo', descripcion: 'Prevención de riesgos laborales. Seguridad y salud en el puesto de trabajo.', disponible: true }
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
            Temario Auxiliar Administrativo Castilla y León
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial BOCYL enero 2026
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="text-rose-600 dark:text-rose-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-cyl"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Auxiliar Administrativo Castilla y León</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-cyl/temario/tema-${tema.id}`}>
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
