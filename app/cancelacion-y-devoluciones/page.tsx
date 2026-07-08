// app/cancelacion-y-devoluciones/page.tsx - Política de cancelación y devoluciones
import Link from 'next/link'

export default function CancelacionDevolucionesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Cancelación y Garantía de Devolución
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Tu satisfacción es nuestra prioridad. Aquí te explicamos tus opciones.
          </p>
        </div>

        {/* Comparación Visual */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Garantía de Devolución */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-2 border-green-200 dark:border-green-700">
            <div className="flex items-center mb-4">
              <span className="text-4xl mr-3">🤝</span>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Garantía de Devolución</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Devolvemos tu dinero si no estás satisfecho
            </p>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Solo primeros <strong>15 días</strong> desde el pago</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Sin uso abusivo del servicio</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span><strong>Solo UNA vez</strong> por cliente</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Reembolso completo si cumples requisitos</span>
              </li>
            </ul>
          </div>

          {/* Cancelación */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border-2 border-blue-200 dark:border-blue-700">
            <div className="flex items-center mb-4">
              <span className="text-4xl mr-3">🔄</span>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cancelación</h2>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Paras la renovación automática pero sigues siendo Premium
            </p>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Puedes cancelar cuando quieras</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Sigues siendo Premium hasta fin de periodo</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>No hay devolución de dinero</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Puedes reactivar más adelante</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Sección 1: Garantía de Devolución */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <span className="text-3xl mr-3">🤝</span>
            Garantía Total de Satisfacción
          </h2>

          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 p-6 rounded-lg mb-6">
            <p className="text-lg text-gray-800 dark:text-gray-200 font-medium mb-2">
              En Vence, confiamos en la calidad de nuestro servicio.
            </p>
            <p className="text-gray-700 dark:text-gray-300">
              Si dentro de los <strong>primeros 15 días</strong> desde tu pago no estás satisfecho,
              te devolvemos el <strong>100% de tu dinero</strong>, sin preguntas.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                ✅ Requisitos para la Garantía de Devolución:
              </h3>
              <ul className="space-y-3 text-gray-600 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 mt-1 font-bold">1.</span>
                  <span>La solicitud debe hacerse <strong>dentro de los 15 días naturales</strong> desde la fecha de pago. Consideramos que has tenido tiempo suficiente para probarlo, tanto en el plan free durante tiempo indefinido así como durante estos 15 días de plan premium</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 mt-1 font-bold">2.</span>
                  <span>No haber hecho un <strong>uso abusivo</strong> del servicio (por ejemplo, completar cientos de tests en pocos días solo para extraer contenido)</span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 mt-1 font-bold">3.</span>
                  <span>Es la <strong>primera vez</strong> que solicitas la Garantía de Devolución en Vence</span>
                </li>
              </ul>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg border-l-4 border-orange-500">
              <h3 className="text-lg font-semibold text-orange-800 dark:text-orange-300 mb-2">
                ⚠️ Política de &quot;Una Sola Vez&quot;
              </h3>
              <p className="text-gray-700 dark:text-gray-300 mb-2">
                La Garantía de Devolución <strong>solo puede utilizarse una vez por cliente</strong>.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Esto nos ayuda a evitar abusos y mantener precios justos para todos nuestros usuarios.
                Si ya has utilizado la garantía anteriormente, no podrás solicitar otra devolución en futuras suscripciones.
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                💬 Cómo solicitar una devolución:
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                <Link
                  href="/soporte"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  Abre un chat de soporte
                </Link> y solicítalo. Ya tenemos tus datos en el sistema, así que solo necesitas indicarnos que deseas acogerte a la Garantía de Devolución.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                ⏱️ ¿Cuánto tarda la devolución?
              </h3>
              <div className="space-y-3 text-gray-600 dark:text-gray-300">
                <p>
                  En Vence procesamos los pagos a través de <strong>Stripe</strong>, una plataforma de pagos segura y confiable.
                </p>
                <p>
                  <strong>Nuestro proceso:</strong>
                </p>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">1️⃣</span>
                    <span>Recibes tu solicitud de devolución a través del chat de soporte</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">2️⃣</span>
                    <span>Verificamos que cumples los requisitos de la Garantía</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2 mt-1">3️⃣</span>
                    <span><strong>Procesamos la devolución al momento</strong> en Stripe</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2 mt-1">4️⃣</span>
                    <span>Stripe envía el reembolso a tu banco/tarjeta</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-2 mt-1">5️⃣</span>
                    <span>El dinero aparece en tu cuenta en <strong>5-10 días hábiles</strong> (depende de tu entidad bancaria)</span>
                  </li>
                </ul>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  ℹ️ El tiempo de espera lo establece tu banco o entidad emisora de la tarjeta, no Vence ni Stripe.
                  Puedes verificar esta información en la{' '}
                  <a
                    href="https://docs.stripe.com/refunds?locale=es-ES"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    documentación oficial de Stripe
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sección 2: Cómo Cancelar */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <span className="text-3xl mr-3">🔄</span>
            Cómo Cancelar tu Suscripción
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                ¿Qué sucede al cancelar?
              </h3>
              <ul className="space-y-2 text-gray-600 dark:text-gray-300">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 mt-1">✓</span>
                  <span>Tu suscripción <strong>no se renovará automáticamente</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 mt-1">✓</span>
                  <span>Sigues teniendo acceso <strong>Premium hasta el final del periodo que pagaste</strong></span>
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2 mt-1">✓</span>
                  <span>Mantienes todo tu progreso, estadísticas y racha</span>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-500 mr-2 mt-1">ℹ️</span>
                  <span>Cuando termine tu periodo, pasarás automáticamente al plan Free</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
                📝 Pasos para cancelar:
              </h3>
              <ol className="space-y-2 text-gray-700 dark:text-gray-300 list-decimal list-inside">
                <li>Ve a tu <strong>Perfil</strong> en Vence</li>
                <li>Haz clic en <strong>&quot;Gestionar suscripción&quot;</strong></li>
                <li>Selecciona <strong>&quot;Cancelar suscripción&quot;</strong></li>
                <li>Confirma tu cancelación</li>
              </ol>
              <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                También puedes{' '}
                <Link
                  href="/soporte"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  abrir un chat de soporte
                </Link>{' '}
                y nosotros lo tramitaremos.
              </p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                💡 ¿Puedo reactivar después?
              </h3>
              <p className="text-gray-700 dark:text-gray-300">
                <strong>Sí, por supuesto.</strong> Puedes reactivar tu suscripción en cualquier momento desde tu perfil.
                Tu progreso, estadísticas y racha se mantendrán intactos.
              </p>
            </div>
          </div>
        </section>

        {/* Sección 3: Preguntas Frecuentes */}
        <section className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
            <span className="text-3xl mr-3">❓</span>
            Preguntas Frecuentes
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                ¿Pierdo mi progreso si cancelo mi suscripción?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>No.</strong> Tu progreso, estadísticas, racha y todo tu historial se mantienen intactos.
                Cuando tu periodo Premium termine, pasarás al plan Free pero conservarás todos tus datos.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                ¿Qué se considera &quot;uso abusivo&quot; del servicio?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Uso abusivo sería, por ejemplo, completar cientos de tests en muy pocos días con el único objetivo de extraer
                todo el contenido y luego pedir devolución. El uso normal y honesto del servicio, aunque sea intensivo,
                <strong> no se considera abusivo</strong>.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Ya usé la Garantía hace tiempo, ¿puedo volver a suscribirme?
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                <strong>Sí, claro.</strong> Puedes suscribirte de nuevo sin problema. Solo ten en cuenta que la Garantía
                de Devolución solo puede usarse una vez, así que en futuras suscripciones no podrías solicitar otra devolución
                (aunque sí podrías cancelar normalmente).
              </p>
            </div>

          </div>
        </section>

        {/* Sección 4: Contacto */}
        <section className="bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">¿Necesitas Ayuda?</h2>
          <p className="text-lg mb-6">
            Estamos aquí para ayudarte. Si tienes dudas sobre cancelaciones o devoluciones:
          </p>
          <Link
            href="/soporte"
            className="inline-block bg-white text-blue-600 font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            💬 Ábrenos un chat de soporte
          </Link>
        </section>

        {/* Footer Legal */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Esta política está sujeta a nuestros{' '}
            <Link href="/terminos" className="text-blue-600 dark:text-blue-400 hover:underline">
              Términos y Condiciones
            </Link>{' '}
            y{' '}
            <Link href="/privacidad" className="text-blue-600 dark:text-blue-400 hover:underline">
              Política de Privacidad
            </Link>.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Última actualización: 21 de enero de 2026
          </p>
        </div>
      </div>
    </div>
  )
}
