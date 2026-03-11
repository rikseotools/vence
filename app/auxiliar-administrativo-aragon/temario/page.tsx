// app/auxiliar-administrativo-aragon/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - DGA Aragon
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Materias Comunes',
    icon: '🏛️',
    count: 15,
    temas: [
      { id: 1, titulo: 'La Constitucion Espanola de 1978', descripcion: 'Estructura y contenido. Derechos y deberes fundamentales. La Corona. Las Cortes Generales. El Gobierno y la Administracion. El Poder Judicial. El Tribunal Constitucional. La reforma constitucional.', disponible: true },
      { id: 2, titulo: 'La organizacion territorial del Estado', descripcion: 'Las Comunidades Autonomas. La Administracion Local. Principios constitucionales. Distribucion de competencias.', disponible: true },
      { id: 3, titulo: 'La Union Europea', descripcion: 'Tratados constitutivos y modificativos. Las instituciones de la Union Europea. Las libertades comunitarias. Las fuentes del derecho comunitario.', disponible: true },
      { id: 4, titulo: 'El Estatuto de Autonomia de Aragon', descripcion: 'Estructura y contenido. Competencias de la Comunidad Autonoma de Aragon. Organizacion institucional.', disponible: false },
      { id: 5, titulo: 'Los organos de gobierno de la CA de Aragon', descripcion: 'Las Cortes de Aragon. El Presidente. La Diputacion General. El Justicia de Aragon. La Administracion de la Comunidad Autonoma.', disponible: false },
      { id: 6, titulo: 'El derecho administrativo. Ley 39/2015', descripcion: 'Fuentes del derecho administrativo. El procedimiento administrativo comun. Disposiciones generales. Los interesados.', disponible: true },
      { id: 7, titulo: 'Disposiciones y actos administrativos', descripcion: 'Disposiciones administrativas. Requisitos de los actos administrativos. Motivacion. Notificacion y publicacion.', disponible: true },
      { id: 8, titulo: 'Eficacia y validez de los actos administrativos', descripcion: 'Eficacia de los actos. Nulidad y anulabilidad. Revision de oficio. Recursos administrativos.', disponible: true },
      { id: 9, titulo: 'Proteccion de datos personales', descripcion: 'Reglamento General de Proteccion de Datos. Ley Organica 3/2018. Principios. Derechos de los interesados. Delegado de proteccion de datos.', disponible: true },
      { id: 10, titulo: 'Igualdad efectiva de mujeres y hombres', descripcion: 'Ley Organica 3/2007. Principios generales. Politicas publicas de igualdad. Igualdad en el empleo publico.', disponible: true },
      { id: 11, titulo: 'Informacion y atencion al publico', descripcion: 'Atencion al ciudadano. Quejas y sugerencias. Servicios de informacion administrativa. Cartas de servicios.', disponible: true },
      { id: 12, titulo: 'Documentos administrativos', descripcion: 'Concepto y clases de documentos. Registros. Archivos. Gestion documental.', disponible: true },
      { id: 13, titulo: 'Gobierno Abierto y transparencia', descripcion: 'Ley 19/2013 de transparencia. Publicidad activa. Derecho de acceso a la informacion publica. Buen gobierno.', disponible: true },
      { id: 14, titulo: 'Prevencion de Riesgos Laborales', descripcion: 'Ley 31/1995 de Prevencion de Riesgos Laborales. Derechos y obligaciones. Servicios de prevencion. Delegados de prevencion.', disponible: true },
      { id: 15, titulo: 'Administracion electronica', descripcion: 'Sede electronica. Registro electronico. Notificaciones electronicas. Expediente electronico. Firma electronica.', disponible: true },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Materias Especificas',
    icon: '💻',
    count: 5,
    temas: [
      { id: 16, titulo: 'Informatica basica', descripcion: 'Conceptos fundamentales de hardware y software. Tipos de ordenadores. Sistemas de almacenamiento. Redes informaticas.', disponible: true },
      { id: 17, titulo: 'Sistema operativo Windows', descripcion: 'Entorno grafico de Windows. Explorador de archivos. Gestion de carpetas y archivos. Configuracion basica. Seguridad.', disponible: true },
      { id: 18, titulo: 'Procesador de textos Word', descripcion: 'Creacion y edicion de documentos. Formato de texto y parrafos. Tablas. Imagenes. Combinacion de correspondencia. Plantillas.', disponible: true },
      { id: 19, titulo: 'Hoja de calculo Excel', descripcion: 'Creacion y edicion de hojas de calculo. Formulas y funciones. Graficos. Formato de celdas. Tablas dinamicas.', disponible: true },
      { id: 20, titulo: 'Correo electronico e Internet', descripcion: 'Navegadores web. Correo electronico: envio, recepcion y organizacion. Seguridad en Internet. Busqueda de informacion.', disponible: true },
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
            Temario Auxiliar Administrativo de Aragon
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial del BOA
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por que Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-yellow-600 dark:text-yellow-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-aragon"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo de Aragon</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-aragon/temario/tema-${tema.id}`}>
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
