// app/layout.js - CORREGIDO para Next.js 15 + OAuth fix + Google Ads
import './globals.css'
import { headers } from 'next/headers'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'
const GA_MEASUREMENT_ID = 'G-JMT08L6G7D'
const GOOGLE_ADS_ID = 'AW-10842123204'

export const metadata = {
  title: 'Vence - Free Legal Practice Tests | US Law & International Law',
  description: 'Free practice tests for US law, Spanish Constitution, Bar exam prep. Available in multiple languages.',
  keywords: 'legal practice tests, bar exam prep, constitutional law, free law tests',
  authors: [{ name: 'Vence' }],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Vence - Free Legal Practice Tests',
    description: 'Practice tests for legal professionals and students',
    url: SITE_URL,
    siteName: 'Vence',
    locale: 'en_US',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

// ✅ FUNCIÓN ASYNC REQUERIDA para Next.js 15
export default async function RootLayout({ children }) {
  // ✅ Detectar idioma desde el servidor usando headers ASYNC
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  const isSpanish = pathname.startsWith('/es')
  const lang = isSpanish ? 'es' : 'en'
  const geoCountry = isSpanish ? 'ES' : 'US'
  const geoRegion = isSpanish ? 'ES' : 'US'

  return (
    <html lang={lang}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Canonical para SEO */}
        {pathname === '/' && (
          <link rel="canonical" href={`${SITE_URL}/es`} />
        )}
        
        {/* Geo targeting dinámico */}
        <meta name="geo.region" content={geoRegion} />
        <meta name="geo.country" content={geoCountry} />
        
        {/* 🆕 Google Ads Conversion Tracking */}
        {process.env.NODE_ENV === 'production' && (
          <>
            <script 
              async 
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
            />
            <script 
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GOOGLE_ADS_ID}');
                `
              }}
            />
          </>
        )}
        
        {/* Google Analytics - Optimizado para rendimiento */}
        {process.env.NODE_ENV === 'production' && (
          <>
            <script 
              async 
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            />
            <script 
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_MEASUREMENT_ID}', {
                    page_title: document.title,
                    page_location: window.location.href,
                    anonymize_ip: true,
                    send_page_view: false
                  });
                  
                  // Enviar page_view después de que la página cargue completamente
                  window.addEventListener('load', function() {
                    gtag('event', 'page_view', {
                      page_title: document.title,
                      page_location: window.location.href
                    });
                  });
                `
              }}
            />
          </>
        )}
        
        {/* JSON-LD Schema */}
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "iLoveTest",
              "url": SITE_URL,
              "logo": `${SITE_URL}/logo.png`,
              "description": "Free legal practice tests and bar exam preparation",
              "sameAs": [
                "https://twitter.com/ilovetest",
                "https://linkedin.com/company/ilovetest"
              ],
              "contactPoint": {
                "@type": "ContactPoint",
                "contactType": "Customer Service",
                "availableLanguage": ["English", "Spanish"]
              }
            })
          }}
        />

        {/* 🔧 SCRIPT DE REDIRECCIÓN CORREGIDO - EXCLUYE RUTAS DE AUTH */}
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              if (typeof window !== 'undefined') {
                const path = window.location.pathname;
                const hash = window.location.hash;
                const search = window.location.search;
                
                // Detectar bots
                const isBot = /bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent);
                if (isBot) {
                  console.log('🤖 Bot detected, skipping redirect');
                  return;
                }
                
                // ✅ RUTAS QUE NUNCA DEBEN SER REDIRIGIDAS
                const excludedRoutes = [
                  '/auth/',          // Cualquier ruta de auth (con trailing slash)
                  '/auth',           // Ruta de auth exacta
                  '/api/',           // API routes
                  '/login',          // Login pages
                  '/callback',       // Cualquier callback
                  '/_next/',         // Next.js internals
                  '/sitemap',        // SEO files
                  '/robots'          // SEO files
                ];
                
                // Verificar si la ruta actual debe ser excluida
                const shouldExclude = excludedRoutes.some(route => {
                  if (route.endsWith('/')) {
                    return path.startsWith(route);
                  }
                  return path === route || path.startsWith(route + '/');
                });
                
                if (shouldExclude) {
                  console.log('🚫 Excluded route detected, skipping redirect:', path);
                  return;
                }
                
                // ✅ DETECTAR SI HAY TOKENS OAUTH EN LA URL
                const hasOAuthTokens = hash.includes('access_token') || 
                                      hash.includes('refresh_token') ||
                                      hash.includes('id_token') ||
                                      search.includes('code=') ||
                                      search.includes('state=') ||
                                      search.includes('auth=');
                
                if (hasOAuthTokens) {
                  console.log('🔑 OAuth tokens detected in URL, skipping redirect');
                  console.log('🔍 Hash:', hash);
                  console.log('🔍 Search:', search);
                  return;
                }
                
                // ✅ DETECTAR SI VIENE DE OAUTH PROVIDER
                const referrer = document.referrer;
                const isFromOAuth = referrer && (
                  referrer.includes('google.com') ||
                  referrer.includes('supabase.co') ||
                  referrer.includes('accounts.google.com')
                );
                
                if (isFromOAuth) {
                  console.log('🔑 Coming from OAuth provider, skipping redirect:', referrer);
                  return;
                }
                
                // ✅ SOLO REDIRIGIR DESDE ROOT
                if (path === '/') {
                  console.log('🔄 Redirecting from / to /es');
                  localStorage.setItem('langPreference', 'es');
                  window.location.href = '/es';
                }
              }
            })();
          `
        }} />
      </head>
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  )
}