'use client'
import Script from 'next/script'

export default function GoogleAnalytics() {
  return (
    <>
      {/* Google Analytics - Nueva cuenta limpia para evitar mezcla con otros dominios */}
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-WXQ069CRY9"
        strategy="lazyOnload"
      />
      <Script id="google-analytics" strategy="lazyOnload">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-WXQ069CRY9');
          
          // Google Ads configuration
          gtag('config', 'AW-10842123204');
        `}
      </Script>
    </>
  )
}