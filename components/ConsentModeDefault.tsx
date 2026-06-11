'use client'
import Script from 'next/script'

/**
 * Google Consent Mode v2 — estado por DEFECTO.
 *
 * Debe ejecutarse ANTES que cualquier etiqueta de Google (gtag.js, Ads, GA).
 * Por eso va en <head> con strategy="beforeInteractive".
 *
 * Modelo "Advanced Consent Mode": las etiquetas de Google se cargan siempre,
 * pero arrancan con consentimiento DENEGADO. Mientras está denegado, Google NO
 * escribe cookies de publicidad/analítica; envía pings anónimos sin cookies que
 * le permiten MODELAR conversiones y audiencias de forma agregada (legal en la
 * UE). Cuando el usuario acepta en el banner, `CookieConsent` emite
 * `gtag('consent','update', …)` y a partir de ahí Google sí persiste.
 *
 * Esto es lo que permite que la audiencia de remarketing crezca respetando el
 * RGPD (antes el tag no se cargaba sin consentimiento → lista vacía).
 *
 * ⚠️ La clave y la versión deben coincidir con components/CookieConsent.tsx
 * (COOKIE_CONSENT_KEY / CONSENT_VERSION).
 */
export default function ConsentModeDefault() {
  return (
    <Script id="consent-mode-default" strategy="beforeInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = window.gtag || gtag;

        // 1) Estado por defecto: todo DENEGADO (security siempre concedido).
        gtag('consent', 'default', {
          'ad_storage': 'denied',
          'ad_user_data': 'denied',
          'ad_personalization': 'denied',
          'analytics_storage': 'denied',
          'security_storage': 'granted',
          'wait_for_update': 500
        });

        // 2) Si el usuario ya decidió en una visita anterior, aplicarlo cuanto
        //    antes para no perder señales en esta carga.
        try {
          var stored = localStorage.getItem('vence_cookie_consent');
          if (stored) {
            var c = JSON.parse(stored);
            if (c && c.version === '1.0') {
              gtag('consent', 'update', {
                'analytics_storage': c.analytics ? 'granted' : 'denied',
                'ad_storage': c.marketing ? 'granted' : 'denied',
                'ad_user_data': c.marketing ? 'granted' : 'denied',
                'ad_personalization': c.marketing ? 'granted' : 'denied'
              });
            }
          }
        } catch (e) {}
      `}
    </Script>
  )
}
