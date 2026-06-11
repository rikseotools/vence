'use client'
import Script from 'next/script'
import { usePathname } from 'next/navigation'

const GA_ID = 'G-WXQ069CRY9'
const ADS_ID = 'AW-7929322521' // Cuenta Google Ads (enero 2026)

/**
 * Carga gtag.js (Google Analytics 4 + Google Ads) bajo Consent Mode v2.
 *
 * A diferencia de la versión anterior, el tag se carga SIEMPRE (no se
 * condiciona al consentimiento). Quien gobierna qué se almacena es el estado
 * de Consent Mode: `ConsentModeDefault` lo deja en "denied" por defecto y
 * `CookieConsent` lo actualiza cuando el usuario acepta. Con consentimiento
 * denegado Google funciona en modo cookieless (modela conversiones/audiencias);
 * con consentimiento concedido persiste cookies y puebla el remarketing.
 *
 * No se carga en /admin (no queremos medir el panel interno).
 */
export default function GoogleAnalytics() {
  const pathname = usePathname()

  if (pathname?.startsWith('/admin')) {
    return null
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = window.gtag || gtag;
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
          gtag('config', '${ADS_ID}');
        `}
      </Script>
    </>
  )
}
