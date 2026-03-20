// app/auxilio-judicial/temario/page.tsx - Server Component para SEO
import { Suspense } from 'react'
import Link from 'next/link'
import InteractiveBreadcrumbs from '@/components/InteractiveBreadcrumbs'
import TemarioClient from './TemarioClient'

// Datos estáticos de los bloques y temas
const BLOQUES = [
  {
    id: 'bloque1',
    titulo: 'Bloque I: Derecho Constitucional y Organización del Estado',
    icon: '🏛️',
    count: 5,
    temas: [
      { id: 1, titulo: 'La Constitución Española de 1978', descripcion: 'Estructura y contenido. Las atribuciones de la Corona. Las Cortes Generales. El Tribunal Constitucional.' },
      { id: 2, titulo: 'Igualdad y no discriminación', descripcion: 'LO 3/2007, LO 1/2004, Ley 15/2022, Ley 4/2023. Violencia de género. Derechos LGTBI.' },
      { id: 3, titulo: 'El Gobierno y la Administración', descripcion: 'Presidente, Consejo de Ministros, Secretarios de Estado. Administración periférica. Secretaría de Estado de Justicia.' },
      { id: 4, titulo: 'Organización territorial del Estado', descripcion: 'El Estado de las Autonomías. Comunidades Autónomas. Administración Local: provincia y municipio.' },
      { id: 5, titulo: 'La Unión Europea', descripcion: 'Competencias de la UE. Instituciones: Parlamento, Consejo, Comisión, Tribunal de Justicia, Tribunal de Cuentas.' },
    ]
  },
  {
    id: 'bloque2',
    titulo: 'Bloque II: Organización Judicial y Funcionarios',
    icon: '⚖️',
    count: 10,
    temas: [
      { id: 6, titulo: 'El Poder Judicial', descripcion: 'CGPJ: composición y funciones. Jueces y Magistrados. Ministerio Fiscal. Sistemas de acceso.' },
      { id: 7, titulo: 'Organización y competencia de los órganos judiciales (I)', descripcion: 'Tribunal Supremo, Audiencia Nacional, Tribunales Superiores, Audiencias Provinciales.' },
      { id: 8, titulo: 'Organización y competencia de los órganos judiciales (II)', descripcion: 'Tribunales de Instancia, Tribunal Central de Instancia, Juzgados de Paz, Oficinas de Justicia.' },
      { id: 9, titulo: 'Carta de Derechos de los Ciudadanos ante la Justicia', descripcion: 'Derechos de información, atención, identificación. Plan de Transparencia Judicial. Justicia gratuita.' },
      { id: 10, titulo: 'La modernización de la oficina judicial', descripcion: 'Nuevo modelo organizativo. Expediente digital. Firma digital. Protección de datos.' },
      { id: 11, titulo: 'El Letrado de la Administración de Justicia', descripcion: 'Funciones y competencias. Secretario de Gobierno y Secretarios Coordinadores.' },
      { id: 12, titulo: 'Los Cuerpos de funcionarios al servicio de la Administración de Justicia', descripcion: 'Cuerpos Generales y Especiales. Médicos Forenses.' },
      { id: 13, titulo: 'Los Cuerpos Generales (I)', descripcion: 'Funciones, acceso, promoción interna. Derechos, deberes, incompatibilidades. Jornada, vacaciones, permisos.' },
      { id: 14, titulo: 'Los Cuerpos Generales (II)', descripcion: 'Situaciones administrativas. Provisión de puestos. Régimen disciplinario.' },
      { id: 15, titulo: 'Libertad sindical', descripcion: 'El Sindicato en la CE. Elecciones sindicales. Derecho de huelga. Prevención de riesgos laborales.' },
    ]
  },
  {
    id: 'bloque3',
    titulo: 'Bloque III: Procedimientos y Actos Procesales',
    icon: '📜',
    count: 11,
    temas: [
      { id: 16, titulo: 'Los procedimientos declarativos en la LEC', descripcion: 'Medios de solución de controversias no jurisdiccional. Juicio ordinario y verbal.' },
      { id: 17, titulo: 'Los procedimientos de ejecución en la LEC', descripcion: 'Clases de ejecución. Embargos, averiguación patrimonial, subastas. Medidas cautelares.' },
      { id: 18, titulo: 'Los procesos especiales en la LEC', descripcion: 'Procesos matrimoniales. Proceso monitorio y requerimiento de pago. Juicio cambiario.' },
      { id: 19, titulo: 'La jurisdicción voluntaria', descripcion: 'Naturaleza y clases de procedimientos. Actos de conciliación.' },
      { id: 20, titulo: 'Los procedimientos penales', descripcion: 'Procedimiento ordinario, abreviado y de jurado. Juicio sobre delitos leves. Juicios Rápidos.' },
      { id: 21, titulo: 'El recurso contencioso-administrativo', descripcion: 'Procedimientos ordinarios, abreviados y especiales.' },
      { id: 22, titulo: 'El proceso laboral', descripcion: 'Procedimiento ordinario. Procedimiento por despido. Procesos de seguridad social.' },
      { id: 23, titulo: 'Los actos procesales', descripcion: 'Requisitos: lugar, tiempo, forma. Términos y plazos. Nulidad, anulabilidad, subsanación.' },
      { id: 24, titulo: 'Las resoluciones de los órganos judiciales', descripcion: 'Clases de resoluciones. Resoluciones colegiadas. Resoluciones del LAJ.' },
      { id: 25, titulo: 'El Registro Civil', descripcion: 'Estructura. Oficinas del Registro Civil. Hechos y actos inscribibles. Certificaciones.' },
      { id: 26, titulo: 'El archivo judicial y la documentación', descripcion: 'Archivo y documentación judicial. Remisión de documentación. Juntas de expurgo.' },
    ]
  }
]

// Obtener fecha formateada en el servidor
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
        {/* Header - SSR para SEO */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Temario Auxilio Judicial
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-4">
            Contenido literal del BOE organizado conforme a los epígrafes oficiales. Haz clic en cualquier tema para ver la legislación completa.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Actualizado a <span className="font-semibold text-gray-700 dark:text-gray-200">{fechaActualizacion}</span>
          </p>
        </div>

        {/* Por qué es gratis - SSR para SEO */}
        <div className="max-w-4xl mx-auto mb-6 p-5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white mb-2">¿Por qué Vence ofrece el temario gratis?</h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>La legislación es pública y está disponible en el BOE.</p>
                <p>Vence lo organiza y estructura de forma adecuada, qué artículos y de qué leyes entran en cada tema, para que puedas estudiar de forma eficiente.</p>
                <p>Nos gusta mantener el temario de forma literal, artículo a artículo, ya que en el examen preguntarán de forma literal.</p>
                <p><Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">Regístrate</Link> para recibir las actualizaciones en tu correo y practicar haciendo tests.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Componente cliente para interactividad */}
        <TemarioClient
          bloques={BLOQUES}
          oposicion="auxilio-judicial"
          fechaActualizacion={fechaActualizacion}
        />

        {/* Lista de todos los temas para SEO (oculto visualmente pero indexable) */}
        <nav className="sr-only" aria-label="Índice completo del temario">
          <h2>Índice del Temario Auxilio Judicial</h2>
          {BLOQUES.map(bloque => (
            <section key={bloque.id}>
              <h3>{bloque.titulo}</h3>
              <ul>
                {bloque.temas.map(tema => (
                  <li key={tema.id}>
                    <Link href={`/auxilio-judicial/temario/tema-${tema.id}`}>
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
