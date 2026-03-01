// app/auxiliar-administrativo-galicia/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - Xunta de Galicia
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Parte General',
    icon: '\ud83c\udfdb\ufe0f',
    count: 13,
    temas: [
      { id: 1, titulo: 'CE: T.Preliminar, T.I (excepto cap 3), T.II, T.III (cap 1), T.IV, T.V, T.VIII', descripcion: 'Constitucion Espanola: Titulo Preliminar. Derechos y deberes fundamentales (Titulo I, excepto capitulo 3). La Corona (Titulo II). Las Cortes Generales, capitulo 1 (Titulo III). Del Gobierno y de la Administracion (Titulo IV). Relaciones Gobierno-Cortes (Titulo V). Organizacion territorial (Titulo VIII).', disponible: false },
      { id: 2, titulo: 'Estatuto de Autonomia de Galicia', descripcion: 'Ley Organica 1/1981, de 6 de abril, de Estatuto de Autonomia de Galicia.', disponible: false },
      { id: 3, titulo: 'Derecho derivado UE: reglamentos, directivas, decisiones', descripcion: 'El derecho derivado de la Union Europea: reglamentos, directivas y decisiones.', disponible: false },
      { id: 4, titulo: 'Instituciones UE: Parlamento, Consejo Europeo, Consejo, Comision', descripcion: 'Las instituciones de la Union Europea: Parlamento Europeo, Consejo Europeo, Consejo y Comision Europea.', disponible: false },
      { id: 5, titulo: 'Ley 31/1995 PRL: capitulo III', descripcion: 'Ley 31/1995, de 8 de noviembre, de prevencion de riesgos laborales: capitulo III, derechos y obligaciones.', disponible: false },
      { id: 6, titulo: 'Ley 16/2010 organizacion Administracion Galicia', descripcion: 'Ley 16/2010, de 17 de diciembre, de organizacion y funcionamiento de la Administracion general y del sector publico autonomico de Galicia.', disponible: false },
      { id: 7, titulo: 'Ley 39/2015 LPAC: titulos Preliminar, I, II, III, IV y V', descripcion: 'Ley 39/2015, de 1 de octubre, del procedimiento administrativo comun de las administraciones publicas: titulos Preliminar, I, II, III, IV y V.', disponible: false },
      { id: 8, titulo: 'Ley 40/2015 LRJSP: caps I-V titulo preliminar', descripcion: 'Ley 40/2015, de 1 de octubre, de regimen juridico del sector publico: capitulos I a V del titulo preliminar.', disponible: false },
      { id: 9, titulo: 'DL 1/1999 regimen financiero Galicia', descripcion: 'Decreto Legislativo 1/1999, de 7 de octubre, por el que se aprueba el texto refundido de la Ley de regimen financiero y presupuestario de Galicia.', disponible: false },
      { id: 10, titulo: 'Ley 1/2016 transparencia Galicia', descripcion: 'Ley 1/2016, de 18 de enero, de transparencia y buen gobierno de Galicia.', disponible: false },
      { id: 11, titulo: 'Ley 2/2015 empleo publico Galicia', descripcion: 'Ley 2/2015, de 29 de abril, del empleo publico de Galicia.', disponible: false },
      { id: 12, titulo: 'Ley 7/2023 igualdad Galicia', descripcion: 'Ley 7/2023, de 30 de noviembre, para la igualdad efectiva de mujeres y hombres de Galicia.', disponible: false },
      { id: 13, titulo: 'RDL 1/2013 discapacidad', descripcion: 'Real Decreto Legislativo 1/2013, de 29 de noviembre, por el que se aprueba el texto refundido de la Ley general de derechos de las personas con discapacidad y de su inclusion social.', disponible: false },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Parte Especifica',
    icon: '\ud83d\udcbb',
    count: 4,
    temas: [
      { id: 14, titulo: 'Gestion de documentos en la Xunta de Galicia', descripcion: 'Gestion de documentos en la Xunta de Galicia. Registro, archivo y clasificacion de documentos.', disponible: false },
      { id: 15, titulo: 'Informatica basica: componentes, redes, almacenamiento', descripcion: 'Informatica basica: componentes de un ordenador, redes informaticas y sistemas de almacenamiento.', disponible: false },
      { id: 16, titulo: 'Sistemas operativos: administrador de archivos', descripcion: 'Sistemas operativos: el administrador de archivos. Organizacion y gestion de ficheros.', disponible: false },
      { id: 17, titulo: 'Sistemas ofimaticos: Writer, Calc, Impress, correo electronico', descripcion: 'Sistemas ofimaticos: procesador de textos (Writer), hoja de calculo (Calc), presentaciones (Impress) y correo electronico.', disponible: false },
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
            Temario Auxiliar Administrativo Xunta de Galicia
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial del DOG
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{'\u00bfPor que Vence ofrece el temario gratis?'}</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-sky-600 dark:text-sky-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-galicia"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo Xunta de Galicia</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-galicia/temario/tema-${tema.id}`}>
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
