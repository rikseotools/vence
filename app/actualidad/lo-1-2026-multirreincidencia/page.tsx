// app/actualidad/lo-1-2026-multirreincidencia/page.tsx
// Artículo sobre la LO 1/2026 de multirreincidencia — cambios en CP y LECrim
import type { Metadata } from 'next'
import Link from 'next/link'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
const PAGE_URL = `${SITE_URL}/actualidad/lo-1-2026-multirreincidencia`

export const metadata: Metadata = {
  title: 'LO 1/2026 de Multirreincidencia: Cambios en el Código Penal y la LECrim | Vence',
  description: 'Resumen completo de la Ley Orgánica 1/2026, de 8 de abril, en materia de multirreincidencia. Qué artículos del Código Penal y la LECrim cambian, qué oposiciones afecta y cómo prepararte.',
  keywords: [
    'LO 1/2026', 'multirreincidencia', 'código penal 2026', 'LECrim 2026',
    'reforma código penal', 'hurto multirreincidencia', 'estafa multirreincidencia',
    'oposiciones derecho penal', 'cambios legislativos oposiciones 2026',
    'tramitación procesal temario', 'policía nacional temario',
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: PAGE_URL,
  },
  openGraph: {
    title: 'LO 1/2026 de Multirreincidencia: Cambios en el Código Penal y la LECrim',
    description: 'Resumen completo de los cambios legislativos que afectan a oposiciones de Justicia, Policía Nacional y Guardia Civil.',
    url: PAGE_URL,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'article',
  },
}

export default function MultirreincidenciaPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">

        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:text-blue-600">Inicio</Link>
          <span className="mx-2">/</span>
          <span>Actualidad legislativa</span>
        </nav>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-3 py-1 rounded-full text-xs font-bold uppercase">
              Cambio legislativo
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">9 de abril de 2026</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            LO 1/2026 de Multirreincidencia: Cambios en el Código Penal y la LECrim
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            La Ley Orgánica 1/2026, de 8 de abril, modifica el Código Penal y la Ley de Enjuiciamiento Criminal.
            Entra en vigor el <strong>10 de abril de 2026</strong>.
          </p>
        </div>

        {/* Oposiciones afectadas */}
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 mb-10">
          <h2 className="text-lg font-bold text-red-800 dark:text-red-200 mb-3">Oposiciones afectadas</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { name: 'Tramitación Procesal', temas: 'T20 y T21 (LECrim + CP)', href: '/tramitacion-procesal' },
              { name: 'Policía Nacional', temas: 'T16 (Derecho Penal)', href: '/policia-nacional' },
              { name: 'Guardia Civil', temas: 'T8 (Código Penal)', href: '/guardia-civil' },
              { name: 'Auxilio Judicial', temas: 'Derecho Procesal', href: '/auxilio-judicial' },
            ].map(op => (
              <Link key={op.href} href={op.href}
                className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg p-3 hover:shadow-md transition-shadow">
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">{op.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{op.temas}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Contexto */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">¿Qué es la LO 1/2026?</h2>
          <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
            <p>
              La Ley Orgánica 1/2026, de 8 de abril, en materia de <strong>multirreincidencia</strong>, endurece las
              penas para delincuentes reincidentes en delitos patrimoniales (hurto, estafa) e introduce nuevos tipos
              penales. También refuerza las medidas cautelares en la LECrim para proteger a las víctimas.
            </p>
            <p>
              El objetivo principal es combatir la reincidencia en delitos menores como el hurto en comercios,
              que hasta ahora se castigaba con multas que no disuadían a los multirreincidentes.
            </p>
          </div>
        </section>

        {/* Cambios en el Código Penal */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Cambios en el Código Penal</h2>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Arts. 234-235 — Hurto: multirreincidencia y robo de móviles
              </h3>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="font-semibold text-red-600 dark:text-red-400 text-sm mb-1">ANTES</p>
                  <p className="text-sm">El hurto leve (menos de 400€) se castigaba con multa de 1 a 3 meses, independientemente de los antecedentes.</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="font-semibold text-green-600 dark:text-green-400 text-sm mb-1">AHORA</p>
                  <p className="text-sm">Si el condenado tiene <strong>3 o más condenas previas</strong> por delitos similares (al menos uno leve), se le impone la pena del hurto agravado (prisión de 6 a 18 meses).</p>
                </div>
                <p className="text-sm">Además, se añade un nuevo <strong>numeral 10.º al art. 235</strong>: el robo de <strong>teléfonos móviles y dispositivos digitales</strong> con datos personales se considera hurto agravado.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Arts. 248-250 — Estafa: misma regla de multirreincidencia
              </h3>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="font-semibold text-green-600 dark:text-green-400 text-sm mb-1">AHORA</p>
                  <p className="text-sm">La estafa leve (menos de 400€) con <strong>3+ condenas previas similares</strong> pasa a castigarse con la pena de estafa agravada. Se añade el numeral 8.º al art. 250 como agravante por multirreincidencia.</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Art. 255 — Fraude eléctrico para cultivo de drogas
              </h3>
              <div className="text-gray-700 dark:text-gray-300">
                <p className="text-sm">Nuevo apartado 3: el fraude de energía eléctrica destinado al <strong>cultivo de drogas</strong> se castiga con prisión de 6 a 18 meses o multa de 12 a 24 meses.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Art. 568 — Combustibles líquidos inflamables
              </h3>
              <div className="text-gray-700 dark:text-gray-300">
                <p className="text-sm">Nuevo apartado 2: la tenencia no autorizada de <strong>combustibles líquidos inflamables</strong> se castiga con prisión de 3 a 5 años, con posibilidad de pena inferior para conductas de menor entidad.</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Arts. 22, 66, 80 — Reincidencia, penas y suspensión
              </h3>
              <div className="text-gray-700 dark:text-gray-300 space-y-2 text-sm">
                <p><strong>Art. 22 (circunstancia 8.ª):</strong> La reincidencia excluye antecedentes cancelados y delitos leves, salvo para los tipos agravados por multirreincidencia.</p>
                <p><strong>Art. 66.2:</strong> Añade salvedad para los tipos agravados por multirreincidencia de delitos leves.</p>
                <p><strong>Art. 80.2:</strong> La suspensión de condena excluye delitos leves e imprudentes de los requisitos, excepto si integran la agravante de multirreincidencia.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Cambios en la LECrim */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Cambios en la LECrim</h2>

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Art. 105 — Entidades locales pueden perseguir hurtos
              </h3>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="font-semibold text-green-600 dark:text-green-400 text-sm mb-1">NUEVO APARTADO 3</p>
                  <p className="text-sm">Las <strong>entidades locales</strong> (ayuntamientos) podrán ejercer la acción penal por los delitos de hurto del Código Penal. Antes solo podían hacerlo el Ministerio Fiscal y el perjudicado.</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Art. 544 bis — Medidas cautelares reforzadas
              </h3>
              <div className="space-y-3 text-gray-700 dark:text-gray-300">
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <p className="font-semibold text-red-600 dark:text-red-400 text-sm mb-1">ANTES</p>
                  <p className="text-sm">El juez podía imponer prohibiciones de residencia y aproximación sin requisitos específicos de motivación.</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <p className="font-semibold text-green-600 dark:text-green-400 text-sm mb-1">AHORA</p>
                  <p className="text-sm">Las medidas deben ser <strong>motivadas</strong> y <strong>estrictamente necesarias</strong> para proteger a la víctima o <strong>evitar la reiteración delictiva</strong>. Se debe considerar la situación económica, salud, familia y actividad laboral del inculpado.</p>
                </div>
                <p className="text-sm">También se permite el uso de <strong>dispositivos telemáticos</strong> para controlar el cumplimiento en casos de delitos contra la libertad sexual (LO 10/2022).</p>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                Art. 13 — Primeras diligencias
              </h3>
              <div className="text-gray-700 dark:text-gray-300">
                <p className="text-sm">Las primeras diligencias ahora incluyen expresamente <strong>evitar la reiteración delictiva</strong> mediante medidas cautelares del art. 544 bis y órdenes de protección.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Resumen tabla */}
        <section className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Resumen de artículos modificados</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-700">
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Ley</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Artículos</th>
                  <th className="text-left p-3 font-semibold text-gray-900 dark:text-white">Materia</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">Código Penal</td>
                  <td className="p-3">22, 66, 80</td>
                  <td className="p-3">Reincidencia, penas, suspensión</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">Código Penal</td>
                  <td className="p-3">234, 235</td>
                  <td className="p-3">Hurto y multirreincidencia</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">Código Penal</td>
                  <td className="p-3">248, 250</td>
                  <td className="p-3">Estafa y multirreincidencia</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">Código Penal</td>
                  <td className="p-3">255</td>
                  <td className="p-3">Fraude eléctrico (drogas)</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">Código Penal</td>
                  <td className="p-3">568</td>
                  <td className="p-3">Combustibles inflamables</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">LECrim</td>
                  <td className="p-3">13</td>
                  <td className="p-3">Primeras diligencias</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">LECrim</td>
                  <td className="p-3">105</td>
                  <td className="p-3">Acción penal entidades locales</td>
                </tr>
                <tr className="border-t border-gray-200 dark:border-gray-600">
                  <td className="p-3 font-medium">LECrim</td>
                  <td className="p-3">544 bis</td>
                  <td className="p-3">Medidas cautelares reforzadas</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-8 text-center text-white mb-10">
          <h2 className="text-2xl font-bold mb-3">Estudia con la legislación actualizada</h2>
          <p className="text-blue-100 mb-6">
            Ya hemos actualizado todos los artículos y explicaciones en Vence. Practica con el temario vigente.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/tramitacion-procesal/test"
              className="inline-block bg-white text-blue-700 px-6 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors">
              Test Tramitación Procesal
            </Link>
            <Link href="/oposiciones"
              className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-400 transition-colors border border-blue-400">
              Ver todas las oposiciones
            </Link>
          </div>
        </section>

        {/* Fuente */}
        <div className="text-sm text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-6">
          <p>
            Fuente: <a href="https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7966"
              className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              BOE-A-2026-7966 — Ley Orgánica 1/2026, de 8 de abril
            </a>
          </p>
          <p className="mt-2">Última actualización: 9 de abril de 2026</p>
        </div>
      </div>
    </div>
  )
}
