// app/auxiliar-administrativo-valencia/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - Generalitat Valenciana
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Materias Comunes',
    icon: '\ud83c\udfdb\ufe0f',
    count: 10,
    temas: [
      { id: 1, titulo: 'CE: Titulo Preliminar, Titulo I, Titulo X', descripcion: 'Constitucion Espanola: Titulo Preliminar. Derechos y deberes fundamentales (Titulo I). La reforma constitucional (Titulo X).', disponible: false },
      { id: 2, titulo: 'CE: Titulo II Corona, Titulo III Cortes', descripcion: 'Constitucion Espanola: La Corona (Titulo II). Las Cortes Generales (Titulo III).', disponible: false },
      { id: 3, titulo: 'CE: Titulo IV Gobierno, Titulo V', descripcion: 'Constitucion Espanola: Del Gobierno y de la Administracion (Titulo IV). De las relaciones entre el Gobierno y las Cortes Generales (Titulo V).', disponible: false },
      { id: 4, titulo: 'CE: Titulo VI Poder Judicial, Titulo IX TC', descripcion: 'Constitucion Espanola: Del Poder Judicial (Titulo VI). Del Tribunal Constitucional (Titulo IX).', disponible: false },
      { id: 5, titulo: 'CE: Titulo VIII Organizacion territorial', descripcion: 'Constitucion Espanola: De la organizacion territorial del Estado (Titulo VIII).', disponible: false },
      { id: 6, titulo: 'Estatuto de Autonomia de la Comunitat Valenciana', descripcion: 'Ley Organica 5/1982, de 1 de julio, de Estatuto de Autonomia de la Comunitat Valenciana, reformada por LO 1/2006.', disponible: false },
      { id: 7, titulo: 'Ley 5/1983 del Consell (I)', descripcion: 'Ley 5/1983, de 30 de diciembre, del Consell. Primera parte: estructura y organizacion.', disponible: false },
      { id: 8, titulo: 'Ley 5/1983 del Consell (II)', descripcion: 'Ley 5/1983, de 30 de diciembre, del Consell. Segunda parte: funcionamiento y competencias.', disponible: false },
      { id: 9, titulo: 'Derecho de la UE', descripcion: 'Derecho de la Union Europea. Tratados originarios y derivados. Instituciones de la UE.', disponible: false },
      { id: 10, titulo: 'Igualdad: LO 3/2007, Ley 9/2003 GVA, LO 1/2004', descripcion: 'Igualdad efectiva de mujeres y hombres (LO 3/2007). Igualdad entre mujeres y hombres de la GVA (Ley 9/2003). Medidas de proteccion integral contra la violencia de genero (LO 1/2004).', disponible: false },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Materias Especificas',
    icon: '\u2696\ufe0f',
    count: 14,
    temas: [
      { id: 11, titulo: 'Ley 39/2015 (I)', descripcion: 'Procedimiento Administrativo Comun de las Administraciones Publicas. Primera parte.', disponible: false },
      { id: 12, titulo: 'Ley 39/2015 (II)', descripcion: 'Procedimiento Administrativo Comun de las Administraciones Publicas. Segunda parte.', disponible: false },
      { id: 13, titulo: 'Ley 39/2015 (III)', descripcion: 'Procedimiento Administrativo Comun de las Administraciones Publicas. Tercera parte.', disponible: false },
      { id: 14, titulo: 'Ley 39/2015 (IV)', descripcion: 'Procedimiento Administrativo Comun de las Administraciones Publicas. Cuarta parte.', disponible: false },
      { id: 15, titulo: 'Ley 39/2015 (V)', descripcion: 'Procedimiento Administrativo Comun de las Administraciones Publicas. Quinta parte.', disponible: false },
      { id: 16, titulo: 'Organos AAPP', descripcion: 'Los organos de las Administraciones Publicas. Organizacion administrativa.', disponible: false },
      { id: 17, titulo: 'Contratos del Sector Publico', descripcion: 'Ley 9/2017, de Contratos del Sector Publico. Tipos de contratos. Procedimientos de adjudicacion.', disponible: false },
      { id: 18, titulo: 'Admin electronica CV + Proteccion de datos', descripcion: 'Administracion electronica de la Comunitat Valenciana. Proteccion de datos personales.', disponible: false },
      { id: 19, titulo: 'Funcion Publica Valenciana (I)', descripcion: 'Funcion publica valenciana. Primera parte: ordenacion, acceso y provision.', disponible: false },
      { id: 20, titulo: 'Funcion Publica Valenciana (II)', descripcion: 'Funcion publica valenciana. Segunda parte: derechos, deberes y regimen disciplinario.', disponible: false },
      { id: 21, titulo: 'Presupuestos', descripcion: 'Los presupuestos de la Generalitat. Concepto, estructura y elaboracion.', disponible: false },
      { id: 22, titulo: 'Ejecucion presupuestaria', descripcion: 'La ejecucion del presupuesto. Fases del procedimiento de gasto.', disponible: false },
      { id: 23, titulo: 'Gestion presupuestaria GVA', descripcion: 'La gestion presupuestaria en la Generalitat Valenciana. Control y fiscalizacion.', disponible: false },
      { id: 24, titulo: 'LibreOffice 6.1', descripcion: 'LibreOffice 6.1: Writer, Calc e Impress. Funcionalidades basicas.', disponible: false },
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
            Temario Auxiliar Administrativo Generalitat Valenciana
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial del DOGV
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
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">{'\u00bfPor que Vence ofrece el temario gratis?'}</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-red-600 dark:text-red-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-valencia"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo Generalitat Valenciana</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-valencia/temario/tema-${tema.id}`}>
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
