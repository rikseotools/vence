// app/auxiliar-administrativo-asturias/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - Principado de Asturias
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Derecho Constitucional y Organizacion Administrativa',
    icon: '🏛️',
    count: 6,
    temas: [
      { id: 1, titulo: 'La Constitucion Espanola de 1978 (I)', descripcion: 'Estructura y contenido. Principios generales. Los derechos y deberes fundamentales de los espanoles.', disponible: true },
      { id: 2, titulo: 'La Constitucion Espanola de 1978 (II)', descripcion: 'La Corona. Las Cortes Generales. El Gobierno y la Administracion. El Poder Judicial.', disponible: true },
      { id: 3, titulo: 'La Constitucion Espanola de 1978 (III)', descripcion: 'La organizacion territorial del Estado. Las Comunidades Autonomas. El Tribunal Constitucional. La reforma constitucional.', disponible: true },
      { id: 4, titulo: 'La Administracion General del Estado', descripcion: 'Organizacion y funcionamiento de la Administracion General del Estado. Organos centrales y perifericos.', disponible: true },
      { id: 5, titulo: 'El Estatuto de Autonomia del Principado de Asturias', descripcion: 'Estructura y contenido. Competencias. La Junta General del Principado. Reforma del Estatuto.', disponible: false },
      { id: 6, titulo: 'El Presidente y Consejo de Gobierno del Principado de Asturias', descripcion: 'El Presidente del Principado. El Consejo de Gobierno. Organizacion administrativa del Principado.', disponible: false },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Derecho Administrativo y Comunitario',
    icon: '⚖️',
    count: 14,
    temas: [
      { id: 7, titulo: 'El Tratado de la Union Europea', descripcion: 'Las instituciones de la Union Europea. El Consejo Europeo. El Consejo. La Comision Europea. El Parlamento Europeo.', disponible: true },
      { id: 8, titulo: 'Ley 39/2015 de Procedimiento Administrativo Comun', descripcion: 'Disposiciones generales. Los interesados. La actividad de las Administraciones Publicas. Actos administrativos. Procedimiento administrativo comun.', disponible: true },
      { id: 9, titulo: 'Ley 40/2015 de Regimen Juridico del Sector Publico', descripcion: 'Disposiciones generales. Organos de las Administraciones Publicas. Principios de la potestad sancionadora. Responsabilidad patrimonial.', disponible: true },
      { id: 10, titulo: 'Regimen Juridico de la Administracion del Principado de Asturias', descripcion: 'Organizacion administrativa del Principado. Principios de actuacion. Organos administrativos.', disponible: false },
      { id: 11, titulo: 'El Estatuto Basico del Empleado Publico', descripcion: 'Objeto y ambito de aplicacion. Clases de personal. Derechos y deberes. Situaciones administrativas. Regimen disciplinario.', disponible: true },
      { id: 12, titulo: 'Funcion Publica del Principado de Asturias', descripcion: 'Personal al servicio de la Administracion del Principado. Ordenacion de la funcion publica. Provision de puestos.', disponible: false },
      { id: 13, titulo: 'Convenio Colectivo del personal laboral del Principado', descripcion: 'Ambito de aplicacion. Organizacion del trabajo. Clasificacion profesional. Jornada, permisos y vacaciones.', disponible: false },
      { id: 14, titulo: 'Regimen Economico y Presupuestario del Principado', descripcion: 'Principios del regimen economico. Los presupuestos generales del Principado. Contabilidad publica.', disponible: false },
      { id: 15, titulo: 'La Ley General de la Seguridad Social (I)', descripcion: 'Campo de aplicacion. Regimen General. Afiliacion, cotizacion y recaudacion. Accion protectora.', disponible: true },
      { id: 16, titulo: 'La Ley General de la Seguridad Social (II)', descripcion: 'Prestaciones: incapacidad temporal, maternidad, paternidad, jubilacion, muerte y supervivencia.', disponible: true },
      { id: 17, titulo: 'Atencion Ciudadana en el Principado de Asturias', descripcion: 'Derechos de los ciudadanos. Quejas y sugerencias. Registro de documentos. Atencion al publico.', disponible: false },
      { id: 18, titulo: 'La documentacion administrativa', descripcion: 'El documento administrativo. Clases de documentos. Registro y archivo. Gestion documental.', disponible: true },
      { id: 19, titulo: 'Proteccion de datos y transparencia', descripcion: 'Reglamento General de Proteccion de Datos. Ley Organica de Proteccion de Datos. Ley de Transparencia.', disponible: true },
      { id: 20, titulo: 'Igualdad y discapacidad', descripcion: 'Ley Organica de Igualdad. Politicas de igualdad. Medidas contra la violencia de genero. Derechos de las personas con discapacidad.', disponible: true },
    ]
  },
  {
    id: 'bloque3',
    titulo: 'Bloque III: Ofimatica',
    icon: '💻',
    count: 5,
    temas: [
      { id: 21, titulo: 'Sistema operativo Windows', descripcion: 'Entorno grafico de Windows. Configuracion del sistema. Gestion de archivos y carpetas. Accesorios del sistema.', disponible: true },
      { id: 22, titulo: 'Explorador de Windows', descripcion: 'Navegacion por el sistema de archivos. Busqueda de archivos. Gestion de unidades. Herramientas del sistema.', disponible: true },
      { id: 23, titulo: 'Procesador de textos Word', descripcion: 'Creacion y edicion de documentos. Formato de texto y parrafos. Tablas. Insercion de objetos. Combinacion de correspondencia.', disponible: true },
      { id: 24, titulo: 'Hoja de calculo Excel', descripcion: 'Creacion y edicion de hojas de calculo. Formulas y funciones. Graficos. Formato condicional. Tablas dinamicas.', disponible: true },
      { id: 25, titulo: 'Base de datos Access', descripcion: 'Creacion de bases de datos. Tablas, consultas, formularios e informes. Relaciones entre tablas.', disponible: true },
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
            Temario Auxiliar Administrativo Principado de Asturias
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial del BOPA
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por que Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-asturias"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo Principado de Asturias</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-asturias/temario/tema-${tema.id}`}>
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
