/**
 * Inline script que captura errores ANTES de que React monte.
 *
 * Sin esto, errores en otros scripts inline (analytics, GTM, polyfills,
 * Sentry SDK arrancando) o en el primer paint NO los pilla
 * installClientObservability porque se ejecuta tras hidratación.
 *
 * Funcionamiento:
 *  1. Este script se inserta antes que cualquier otro script en <head>.
 *  2. Guarda errores en window.__earlyErrors[].
 *  3. Cuando installClientObservability() corre tras hydration, lee
 *     window.__earlyErrors y los emite a observable_events.
 *
 * NO usa imports — debe ejecutarse antes de que React/Next carguen.
 *
 * Bloque 4 Gap 1 del manual de observabilidad — §5 «EarlyErrorsBridge».
 */
const earlyErrorsScript = `
(function() {
  if (typeof window === 'undefined') return;
  if (window.__earlyErrors) return; // ya instalado
  window.__earlyErrors = [];
  window.addEventListener('error', function(e) {
    try {
      window.__earlyErrors.push({
        msg: String(e && e.message ? e.message : 'unknown'),
        stack: e && e.error && e.error.stack ? String(e.error.stack).slice(0, 2000) : undefined,
        ts: Date.now()
      });
      // limit buffer
      if (window.__earlyErrors.length > 50) window.__earlyErrors.length = 50;
    } catch (_) {}
  });
  window.addEventListener('unhandledrejection', function(e) {
    try {
      var reason = e && e.reason;
      window.__earlyErrors.push({
        msg: '[unhandled-rejection] ' + (reason && reason.message ? reason.message : String(reason)),
        stack: reason && reason.stack ? String(reason.stack).slice(0, 2000) : undefined,
        ts: Date.now()
      });
      if (window.__earlyErrors.length > 50) window.__earlyErrors.length = 50;
    } catch (_) {}
  });
})();
`.trim()

export function EarlyErrorsBridge() {
  return (
    <script
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: earlyErrorsScript }}
    />
  )
}
