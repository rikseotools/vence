// app/auxiliar-administrativo-extremadura/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estaticos de los bloques y temas - Junta de Extremadura
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Empleo Publico y Organizacion',
    icon: '🏛️',
    count: 14,
    temas: [
      { id: 1, titulo: 'Gobierno y Administracion de la CAE (I)', descripcion: 'Estructura de la Comunidad Autonoma de Extremadura. Titulo Preliminar. El Presidente de la Junta de Extremadura. La Junta de Extremadura.', disponible: false },
      { id: 2, titulo: 'Gobierno y Administracion de la CAE (II)', descripcion: 'Los miembros de la Junta de Extremadura. Las relaciones entre la Asamblea y la Junta. Principios de la Administracion. Los organos y oficinas.', disponible: false },
      { id: 3, titulo: 'Estatuto Basico del Empleado Publico', descripcion: 'Objeto y ambito de aplicacion. Clases de personal al servicio de las Administraciones Publicas. Derechos individuales. Carrera profesional y evaluacion del desempeno. Retribuciones.', disponible: true },
      { id: 4, titulo: 'Funcion Publica de Extremadura (I)', descripcion: 'Objeto y principios. Organos competentes. Personal al servicio de la Administracion. Ordenacion de los recursos humanos.', disponible: false },
      { id: 5, titulo: 'Funcion Publica de Extremadura (II)', descripcion: 'Adquisicion y perdida de la condicion de funcionario. Acceso al empleo publico. Situaciones administrativas.', disponible: false },
      { id: 6, titulo: 'Funcion Publica de Extremadura (III)', descripcion: 'Derechos de los funcionarios. Jornada de trabajo. Permisos y licencias. Vacaciones.', disponible: false },
      { id: 7, titulo: 'Funcion Publica de Extremadura (IV)', descripcion: 'Promocion profesional. Evaluacion del desempeno. Provision de puestos de trabajo. Movilidad.', disponible: false },
      { id: 8, titulo: 'Funcion Publica de Extremadura (V)', descripcion: 'Retribuciones. Deberes de los empleados publicos. Codigo de conducta. Incompatibilidades.', disponible: false },
      { id: 9, titulo: 'Funcion Publica de Extremadura (VI)', descripcion: 'Formacion y perfeccionamiento. Regimen disciplinario.', disponible: false },
      { id: 10, titulo: 'Personal Laboral CC (I)', descripcion: 'Ambito de aplicacion. Organizacion del trabajo. Clasificacion profesional. Retribuciones.', disponible: false },
      { id: 11, titulo: 'Personal Laboral CC (II)', descripcion: 'Movilidad funcional y geografica. Puestos de trabajo. Permutas. Provision de vacantes. Jornada de trabajo.', disponible: false },
      { id: 12, titulo: 'Personal Laboral CC (III)', descripcion: 'Horas extraordinarias. Vacaciones. Permisos y licencias. Conciliacion de la vida familiar. Regimen disciplinario.', disponible: false },
      { id: 13, titulo: 'Prevencion de Riesgos Laborales', descripcion: 'Objeto y ambito de aplicacion. Definiciones. Derechos y obligaciones. Servicios de prevencion.', disponible: true },
      { id: 14, titulo: 'Igualdad y violencia de genero en Extremadura', descripcion: 'Igualdad entre mujeres y hombres. Politicas de igualdad en Extremadura. Medidas contra la violencia de genero.', disponible: false },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Derecho Administrativo y Ofimatica',
    icon: '💻',
    count: 11,
    temas: [
      { id: 15, titulo: 'Regimen Juridico del Sector Publico (I)', descripcion: 'Disposiciones generales. De los organos de las Administraciones Publicas. De los convenios. Relaciones interadministrativas.', disponible: true },
      { id: 16, titulo: 'Regimen Juridico del Sector Publico (II)', descripcion: 'De los principios de la potestad sancionadora. De la responsabilidad patrimonial de las Administraciones Publicas.', disponible: true },
      { id: 17, titulo: 'Procedimiento Administrativo Comun (I)', descripcion: 'Disposiciones generales. De los interesados en el procedimiento.', disponible: true },
      { id: 18, titulo: 'Procedimiento Administrativo Comun (II)', descripcion: 'De la actividad de las Administraciones Publicas. De los actos administrativos.', disponible: true },
      { id: 19, titulo: 'Procedimiento Administrativo Comun (III)', descripcion: 'Disposiciones sobre el procedimiento administrativo comun. De la revision de los actos en via administrativa. De la iniciativa legislativa y de la potestad para dictar reglamentos.', disponible: true },
      { id: 20, titulo: 'Contratacion del Sector Publico', descripcion: 'Disposiciones generales. Tipos de contratos del sector publico.', disponible: true },
      { id: 21, titulo: 'Documento, registro y archivo', descripcion: 'Funciones del documento. Clases de documentos. Gestion documental. Tecnologias aplicadas.', disponible: false },
      { id: 22, titulo: 'Administracion electronica Extremadura (I)', descripcion: 'Disposiciones generales. Puntos de acceso electronico. Registro electronico.', disponible: false },
      { id: 23, titulo: 'Administracion electronica Extremadura (II)', descripcion: 'Expediente electronico. Comunicaciones electronicas. Notificaciones electronicas.', disponible: false },
      { id: 24, titulo: 'Windows 10', descripcion: 'Entorno grafico de Windows 10. El explorador de archivos. Gestion de carpetas y archivos. Correo electronico. Seguridad y mantenimiento.', disponible: false },
      { id: 25, titulo: 'Office 365: Word y Excel', descripcion: 'Procesadores de texto: Word para Microsoft 365. Hojas de calculo: Excel para Microsoft 365.', disponible: false },
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
            Temario Auxiliar Administrativo Junta de Extremadura
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epigrafes oficiales. Haz clic en cualquier tema para ver la legislacion completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span> conforme al{' '}
            programa oficial del DOE
          </p>
        </div>

        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por que Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislacion es publica y esta disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, que articulos y de que leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, articulo a articulo, ya que en el examen preguntaran de forma literal.</p>
                <p><Link href="/login" className="text-teal-600 dark:text-teal-400 hover:underline font-medium">Registrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxiliar-administrativo-extremadura"
          fechaActualizacion={fechaActualizacion}
        />

        <nav className="sr-only" aria-label="Indice completo del temario">
          <h2>Indice del Temario Auxiliar Administrativo Junta de Extremadura</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxiliar-administrativo-extremadura/temario/tema-${tema.id}`}>
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
