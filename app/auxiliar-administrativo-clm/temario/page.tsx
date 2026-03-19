// app/auxiliar-administrativo-clm/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - Junta de Castilla-La Mancha
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Organizacion Administrativa',
    icon: '🏛️',
    count: 12,
    temas: [
      { id: 1, titulo: 'La Constitucion Espanola de 1978', descripcion: 'Estructura y contenido. Los principios constitucionales. Derechos y deberes fundamentales. La Corona. Las Cortes Generales. El Gobierno y la Administracion. El Poder Judicial. El Tribunal Constitucional. La organizacion territorial del Estado.', disponible: true },
      { id: 2, titulo: 'Ley 39/2015 del Procedimiento Administrativo Comun', descripcion: 'Disposiciones generales. Los interesados en el procedimiento. La actividad de las Administraciones Publicas. De los actos administrativos. Disposiciones sobre el procedimiento administrativo comun. De la revision de los actos en via administrativa.', disponible: true },
      { id: 3, titulo: 'Ley 40/2015 de Regimen Juridico del Sector Publico (I)', descripcion: 'Disposiciones generales. De los organos de las Administraciones Publicas. De los principios de la potestad sancionadora. De la responsabilidad patrimonial de las Administraciones Publicas. Del funcionamiento electronico del sector publico. De los convenios.', disponible: true },
      { id: 4, titulo: 'Ley 40/2015 de Regimen Juridico del Sector Publico (II)', descripcion: 'Relaciones interadministrativas. De las relaciones electronicas entre las Administraciones. Principios de las relaciones interadministrativas. Deber de colaboracion. Relaciones de cooperacion.', disponible: true },
      { id: 5, titulo: 'Calidad de los servicios publicos en la JCCM', descripcion: 'Calidad de los servicios publicos en la Junta de Comunidades de Castilla-La Mancha. Cartas de Servicios. Quejas y sugerencias.', disponible: false },
      { id: 6, titulo: 'Transparencia en la JCCM', descripcion: 'Transparencia en la Junta de Comunidades de Castilla-La Mancha. Publicidad activa. Los archivos de Castilla-La Mancha.', disponible: true },
      { id: 7, titulo: 'Seguridad de la informacion y proteccion de datos', descripcion: 'Seguridad de la informacion en soporte digital. La proteccion de datos de caracter personal. Regimen juridico. Principios de la proteccion de datos. Derechos de las personas.', disponible: true },
      { id: 8, titulo: 'Personal al servicio de la JCCM', descripcion: 'El personal al servicio de la Junta de Comunidades de Castilla-La Mancha. El Estatuto Basico del Empleado Publico. Ley de Empleo Publico de Castilla-La Mancha. Clases de personal. Derechos y deberes.', disponible: true },
      { id: 9, titulo: 'El presupuesto de la JCCM', descripcion: 'El presupuesto de la Junta de Comunidades de Castilla-La Mancha. Ejecucion del presupuesto de gastos. Las subvenciones publicas: concepto y tipos.', disponible: true },
      { id: 10, titulo: 'Estatuto de Autonomia de Castilla-La Mancha', descripcion: 'El Estatuto de Autonomia de Castilla-La Mancha. La organizacion territorial de Castilla-La Mancha. La Administracion Local. El Gobierno y la Administracion regional.', disponible: false },
      { id: 11, titulo: 'CLM: caracteristicas historicas y geograficas', descripcion: 'Castilla-La Mancha: caracteristicas historicas, geograficas, sociales, culturales y economicas.', disponible: false },
      { id: 12, titulo: 'Igualdad efectiva de mujeres y hombres', descripcion: 'La igualdad efectiva de mujeres y hombres. Politicas publicas de igualdad.', disponible: true },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Ofimatica',
    icon: '💻',
    count: 12,
    temas: [
      { id: 13, titulo: 'Informatica basica', descripcion: 'Informatica basica: conceptos fundamentales sobre el hardware y el software. Almacenamiento de datos. Sistemas operativos. Nociones basicas de seguridad informatica.', disponible: false },
      { id: 14, titulo: 'Windows 10: entorno grafico', descripcion: 'Introduccion al sistema operativo Windows 10. El entorno grafico. Ventanas. El escritorio. El menu de Inicio. Configuracion del sistema.', disponible: false },
      { id: 15, titulo: 'El Explorador de Windows', descripcion: 'El Explorador de Windows. Carpetas y archivos. Busqueda de archivos. Gestion de impresoras. Accesorios del sistema.', disponible: false },
      { id: 16, titulo: 'Word 2019 (I)', descripcion: 'Procesadores de texto: Word 2019. Descripcion del entorno de trabajo. Creacion y gestion de documentos. Gestion de texto. Herramientas de escritura. Impresion de documentos. Gestion de archivos.', disponible: false },
      { id: 17, titulo: 'Word 2019 (II)', descripcion: 'Procesadores de texto: Word 2019. Composicion de un documento. Insercion de elementos. Combinacion de correspondencia. Esquemas y tablas de contenido. Graficos e imagenes.', disponible: false },
      { id: 18, titulo: 'Word 2019 (III)', descripcion: 'Procesadores de texto: Word 2019. Personalizacion del entorno de trabajo. Configuracion de opciones. Descripcion de menus y funciones.', disponible: false },
      { id: 19, titulo: 'Excel 2019 (I)', descripcion: 'Hojas de calculo: Excel 2019. Descripcion del entorno de trabajo. Libros y hojas. Celdas. Introduccion y edicion de datos. Formatos de datos y celdas. Formulas y funciones. Vinculos.', disponible: false },
      { id: 20, titulo: 'Excel 2019 (II)', descripcion: 'Hojas de calculo: Excel 2019. Graficos. Gestion de datos. Analisis de datos.', disponible: false },
      { id: 21, titulo: 'Excel 2019 (III)', descripcion: 'Hojas de calculo: Excel 2019. Personalizacion del entorno de trabajo. Configuracion de opciones. Descripcion de menus y funciones.', disponible: false },
      { id: 22, titulo: 'Internet: protocolos y servicios', descripcion: 'Internet: conceptos elementales sobre protocolos y servicios en Internet. Navegador Microsoft Edge 101. Navegador Google Chrome 105.', disponible: false },
      { id: 23, titulo: 'Outlook 2019', descripcion: 'Correo electronico: Outlook 2019. Mensajes. Administracion y gestion de mensajes. Reglas de mensajes. Libreta de direcciones. Agenda y calendario.', disponible: false },
      { id: 24, titulo: 'OneDrive y Microsoft Teams', descripcion: 'OneDrive y Microsoft Teams. Gestion de archivos. Trabajo colaborativo.', disponible: false },
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
            Temario Auxiliar Administrativo Junta de Castilla-La Mancha
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial de la JCCM
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por que Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-orange-600 dark:text-orange-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-clm"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo Junta de Castilla-La Mancha</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-clm/temario/tema-${tema.id}`}>
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
