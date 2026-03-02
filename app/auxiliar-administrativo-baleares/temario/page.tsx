// app/auxiliar-administrativo-baleares/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - CAIB
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Materias Comunes',
    icon: '🏛️',
    count: 20,
    temas: [
      { id: 1, titulo: 'CE y Estatuto de Autonomia de las Illes Balears', descripcion: 'La Constitucion Espanola de 1978 y el Estatuto de Autonomia de las Illes Balears.', disponible: true },
      { id: 2, titulo: 'Parlamento, Presidente y Gobierno de las Illes Balears', descripcion: 'El Parlamento de las Illes Balears. El Presidente. El Gobierno de las Illes Balears.', disponible: false },
      { id: 3, titulo: 'Regimen Juridico del Sector Publico y organizacion administrativa', descripcion: 'Ley 40/2015 de Regimen Juridico del Sector Publico. Organizacion administrativa.', disponible: true },
      { id: 4, titulo: 'Fuentes del derecho y jerarquia normativa', descripcion: 'Las fuentes del derecho. La jerarquia normativa. La ley y sus clases.', disponible: false },
      { id: 5, titulo: 'Procedimiento Administrativo Comun (I): disposiciones generales', descripcion: 'Ley 39/2015. Disposiciones generales. Los interesados. La actividad de las Administraciones Publicas.', disponible: true },
      { id: 6, titulo: 'Procedimiento Administrativo Comun (II): plazos, actos y recursos', descripcion: 'Plazos. Los actos administrativos. Revision de actos y recursos administrativos.', disponible: true },
      { id: 7, titulo: 'Procedimiento Administrativo Comun (III): procedimiento', descripcion: 'Iniciacion, ordenacion, instruccion y finalizacion del procedimiento.', disponible: true },
      { id: 8, titulo: 'El Butlleti Oficial de les Illes Balears', descripcion: 'Regulacion, estructura y publicacion del BOIB.', disponible: false },
      { id: 9, titulo: 'Archivos y gestion documental', descripcion: 'Archivos administrativos. Gestion documental. Conservacion y acceso.', disponible: false },
      { id: 10, titulo: 'Relaciones electronicas y atencion a la ciudadania', descripcion: 'Relaciones electronicas con la Administracion. Atencion ciudadana.', disponible: false },
      { id: 11, titulo: 'Oficinas de asistencia en materia de registros', descripcion: 'Las oficinas de asistencia en materia de registros. Funciones y organizacion.', disponible: false },
      { id: 12, titulo: 'Contratacion administrativa', descripcion: 'Ley de Contratos del Sector Publico. Tipos de contratos. Procedimientos de adjudicacion.', disponible: true },
      { id: 13, titulo: 'Personal funcionario: adquisicion y procesos selectivos', descripcion: 'Adquisicion de la condicion de funcionario. Procesos selectivos. Situaciones administrativas.', disponible: true },
      { id: 14, titulo: 'Derechos, deberes e incompatibilidades de los funcionarios', descripcion: 'Derechos y deberes de los empleados publicos. Regimen de incompatibilidades.', disponible: true },
      { id: 15, titulo: 'Presupuestos generales de las Illes Balears', descripcion: 'Los presupuestos generales de la CAIB. Estructura y ciclo presupuestario.', disponible: false },
      { id: 16, titulo: 'Prevencion de riesgos laborales', descripcion: 'Ley de Prevencion de Riesgos Laborales. Derechos y obligaciones. Servicios de prevencion.', disponible: true },
      { id: 17, titulo: 'Transparencia y acceso a la informacion publica', descripcion: 'Ley de Transparencia. Derecho de acceso a la informacion publica. Publicidad activa.', disponible: true },
      { id: 18, titulo: 'Funcionamiento electronico del sector publico', descripcion: 'Administracion electronica. Sede electronica. Registro electronico. Archivo electronico.', disponible: true },
      { id: 19, titulo: 'Igualdad, no discriminacion y violencia de genero', descripcion: 'Ley Organica de Igualdad. Politicas de igualdad. Medidas contra la violencia de genero.', disponible: true },
      { id: 20, titulo: 'Herramientas de administracion digital de la CAIB', descripcion: 'Herramientas y plataformas digitales de la administracion de las Illes Balears.', disponible: false },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Ofimatica',
    icon: '💻',
    count: 16,
    temas: [
      { id: 21, titulo: 'Word: conceptos basicos de edicion de texto', descripcion: 'Creacion, apertura y guardado de documentos. Edicion basica de texto.', disponible: true },
      { id: 22, titulo: 'Word: formato de fuente y parrafo', descripcion: 'Formato de caracteres: fuente, tamano, estilos. Formato de parrafos: alineacion, sangrias, espaciado.', disponible: true },
      { id: 23, titulo: 'Word: estilos', descripcion: 'Estilos de texto y parrafo. Creacion y modificacion de estilos. Galeria de estilos.', disponible: true },
      { id: 24, titulo: 'Word: formato de pagina, encabezados y pies', descripcion: 'Configuracion de pagina. Margenes. Encabezados y pies de pagina. Numeracion.', disponible: true },
      { id: 25, titulo: 'Word: imagenes y tablas', descripcion: 'Insercion de imagenes. Creacion y formato de tablas. Ajuste de texto.', disponible: true },
      { id: 26, titulo: 'Word: tabla de contenidos y notas al pie', descripcion: 'Generacion automatica de tabla de contenidos. Notas al pie y notas al final.', disponible: true },
      { id: 27, titulo: 'Word: combinacion de correspondencia', descripcion: 'Combinacion de correspondencia. Origen de datos. Campos de combinacion. Etiquetas.', disponible: true },
      { id: 28, titulo: 'Word: correccion ortografica y comparacion', descripcion: 'Revision ortografica y gramatical. Comparacion de documentos. Control de cambios.', disponible: true },
      { id: 29, titulo: 'Word: formularios con controles de contenido', descripcion: 'Creacion de formularios. Controles de contenido. Proteccion de formularios.', disponible: true },
      { id: 30, titulo: 'Excel: operaciones basicas y formato de celdas', descripcion: 'Operaciones basicas con hojas de calculo. Formato de celdas, filas y columnas.', disponible: true },
      { id: 31, titulo: 'Excel: tablas, graficos y filtrado', descripcion: 'Tablas de datos. Graficos. Ordenacion y filtrado de datos.', disponible: true },
      { id: 32, titulo: 'Excel: diseno de pagina e impresion', descripcion: 'Configuracion de pagina. Area de impresion. Vista previa e impresion.', disponible: true },
      { id: 33, titulo: 'Excel: formulas y funciones estadisticas', descripcion: 'Formulas y funciones. Funciones estadisticas. Referencias absolutas y relativas.', disponible: true },
      { id: 34, titulo: 'Excel: ortografia y proteccion de documentos', descripcion: 'Revision ortografica. Proteccion de hojas y libros. Permisos.', disponible: true },
      { id: 35, titulo: 'Excel: vistas y zoom', descripcion: 'Tipos de vista. Zoom. Inmovilizar paneles. Dividir ventanas.', disponible: true },
      { id: 36, titulo: 'Excel: tablas dinamicas y analisis de escenarios', descripcion: 'Tablas dinamicas. Graficos dinamicos. Analisis de escenarios y buscar objetivo.', disponible: true },
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
            Temario Auxiliar Administrativo CAIB
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial del BOIB
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-cyan-100 dark:bg-cyan-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por que Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-cyan-600 dark:text-cyan-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-baleares"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo CAIB</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-baleares/temario/tema-${tema.id}`}>
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
