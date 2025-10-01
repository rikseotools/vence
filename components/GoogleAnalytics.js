'use client'
import Script from 'next/script'

export default function GoogleAnalytics() {
  return (
    <>
      {/* Google Analytics - Carga lazy para máxima performance */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-MCKS9RWYNL"
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-MCKS9RWYNL');
        `}
      </Script>
    </>
  )
}