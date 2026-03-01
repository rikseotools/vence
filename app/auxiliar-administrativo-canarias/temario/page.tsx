// app/auxiliar-administrativo-canarias/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - Gobierno de Canarias
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Parte General',
    icon: '🏛️',
    count: 20,
    temas: [
      { id: 1, titulo: 'La Constitucion Espanola de 1978', descripcion: 'La Constitucion Espanola de 1978. Estructura y contenido. Derechos y deberes fundamentales.', disponible: true },
      { id: 2, titulo: 'La organizacion territorial del Estado', descripcion: 'La organizacion territorial del Estado. Comunidades Autonomas. Administracion Local.', disponible: true },
      { id: 3, titulo: 'El Estatuto de Autonomia de Canarias (I)', descripcion: 'El Estatuto de Autonomia de Canarias. Disposiciones generales. Derechos y deberes.', disponible: false },
      { id: 4, titulo: 'El Estatuto de Autonomia de Canarias (II)', descripcion: 'El Estatuto de Autonomia de Canarias. Organizacion institucional. Competencias.', disponible: false },
      { id: 5, titulo: 'Las Instituciones Autonomicas de Canarias', descripcion: 'Las Instituciones Autonomicas de Canarias. El Parlamento. El Presidente. El Gobierno.', disponible: false },
      { id: 6, titulo: 'El Gobierno de Canarias', descripcion: 'El Gobierno de Canarias. Composicion, funciones y organizacion.', disponible: false },
      { id: 7, titulo: 'Las islas y la Comunidad Autonoma de Canarias', descripcion: 'Las islas y la Comunidad Autonoma de Canarias. Los Cabildos Insulares.', disponible: false },
      { id: 8, titulo: 'El Presupuesto de la Comunidad Autonoma de Canarias', descripcion: 'El Presupuesto de la Comunidad Autonoma de Canarias. Elaboracion y aprobacion.', disponible: false },
      { id: 9, titulo: 'La organizacion de la Union Europea', descripcion: 'La organizacion de la Union Europea. Instituciones y organos.', disponible: false },
      { id: 10, titulo: 'Igualdad efectiva de mujeres y hombres', descripcion: 'Igualdad efectiva de mujeres y hombres. Politicas de igualdad de genero.', disponible: true },
      { id: 11, titulo: 'Violencia de genero y discapacidad', descripcion: 'Violencia de genero. Prevencion y proteccion. Derechos de personas con discapacidad.', disponible: true },
      { id: 12, titulo: 'Actividad de las Administraciones Publicas', descripcion: 'La actividad de las Administraciones Publicas. Principios de actuacion.', disponible: true },
      { id: 13, titulo: 'Atencion al ciudadano', descripcion: 'Atencion al ciudadano. Informacion administrativa. Quejas y sugerencias.', disponible: true },
      { id: 14, titulo: 'La transparencia de la actividad publica', descripcion: 'La transparencia de la actividad publica. Acceso a la informacion publica.', disponible: true },
      { id: 15, titulo: 'Proteccion de datos de caracter personal', descripcion: 'Proteccion de datos de caracter personal. RGPD y LOPDGDD.', disponible: true },
      { id: 16, titulo: 'La competencia administrativa', descripcion: 'La competencia administrativa. Delegacion, avocacion, sustitucion.', disponible: true },
      { id: 17, titulo: 'El personal al servicio de las AAPP', descripcion: 'El personal al servicio de las Administraciones Publicas. Clases de personal.', disponible: true },
      { id: 18, titulo: 'La seleccion del personal funcionario y laboral', descripcion: 'La seleccion del personal funcionario y laboral. Sistemas de acceso.', disponible: true },
      { id: 19, titulo: 'Las situaciones administrativas', descripcion: 'Las situaciones administrativas de los funcionarios. Servicio activo, excedencias.', disponible: true },
      { id: 20, titulo: 'Derechos y deberes de los empleados publicos', descripcion: 'Derechos y deberes de los empleados publicos. Regimen disciplinario.', disponible: true },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Parte Practica',
    icon: '📋',
    count: 20,
    temas: [
      { id: 21, titulo: 'Organizacion de la Admin. Publica de Canarias', descripcion: 'La organizacion general de la Administracion Publica de la Comunidad Autonoma de Canarias.', disponible: false },
      { id: 22, titulo: 'Acceso electronico a los servicios publicos', descripcion: 'El acceso electronico de los ciudadanos a los servicios publicos. Administracion electronica.', disponible: true },
      { id: 23, titulo: 'El acto administrativo', descripcion: 'El acto administrativo. Concepto, clases y elementos. Requisitos.', disponible: true },
      { id: 24, titulo: 'Validez e invalidez de los actos', descripcion: 'Validez e invalidez de los actos administrativos. Nulidad y anulabilidad.', disponible: true },
      { id: 25, titulo: 'Eficacia, notificacion y publicacion', descripcion: 'Eficacia de los actos administrativos. Notificacion y publicacion.', disponible: true },
      { id: 26, titulo: 'La revision de oficio', descripcion: 'La revision de oficio. Revision de actos y disposiciones.', disponible: true },
      { id: 27, titulo: 'El procedimiento administrativo', descripcion: 'El procedimiento administrativo comun. Principios generales.', disponible: true },
      { id: 28, titulo: 'Fases del procedimiento administrativo', descripcion: 'Fases del procedimiento administrativo. Iniciacion, instruccion y finalizacion.', disponible: true },
      { id: 29, titulo: 'Los recursos administrativos', descripcion: 'Los recursos administrativos. Concepto y clases. Recurso extraordinario de revision.', disponible: true },
      { id: 30, titulo: 'Los recursos ordinarios', descripcion: 'Los recursos ordinarios. Recurso de alzada y recurso de reposicion.', disponible: true },
      { id: 31, titulo: 'Contratacion publica (I)', descripcion: 'Contratacion publica. Principios generales. Tipos de contratos.', disponible: true },
      { id: 32, titulo: 'Contratacion publica (II)', descripcion: 'Contratacion publica. Procedimientos de adjudicacion. Criterios de adjudicacion.', disponible: true },
      { id: 33, titulo: 'Contratacion publica (III)', descripcion: 'Contratacion publica. Ejecucion y modificacion de contratos.', disponible: true },
      { id: 34, titulo: 'Ayudas y subvenciones', descripcion: 'Regimen general de ayudas y subvenciones. Ley General de Subvenciones.', disponible: true },
      { id: 35, titulo: 'Funcionamiento electronico del sector publico', descripcion: 'Funcionamiento electronico del sector publico. Sede electronica. Registro electronico.', disponible: true },
      { id: 36, titulo: 'Los documentos administrativos', descripcion: 'Los documentos administrativos. Concepto y clases. El archivo administrativo.', disponible: true },
      { id: 37, titulo: 'El sistema operativo Windows', descripcion: 'El sistema operativo Windows. Configuracion y gestion del sistema.', disponible: true },
      { id: 38, titulo: 'El explorador de Windows', descripcion: 'El explorador de Windows. Gestion de archivos y carpetas.', disponible: true },
      { id: 39, titulo: 'Documentos administrativos (practico)', descripcion: 'Los documentos administrativos. Supuesto practico.', disponible: false },
      { id: 40, titulo: 'Archivo de la Admin. Publica de Canarias', descripcion: 'Regulacion del archivo de la Administracion Publica de la Comunidad Autonoma de Canarias.', disponible: false },
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
            Temario Auxiliar Administrativo Gobierno de Canarias
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial del Gobierno de Canarias
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
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por que Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-amber-600 dark:text-amber-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-canarias"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo Gobierno de Canarias</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-canarias/temario/tema-${tema.id}`}>
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
