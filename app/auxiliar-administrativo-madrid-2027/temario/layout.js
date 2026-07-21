const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Comunidad de Madrid 2027 (examen junio 2027) | Vence',
  description: 'Temario completo de la convocatoria 2026 (Orden 1628, examen junio 2027) del Auxiliar Administrativo Comunidad de Madrid. 21 temas oficiales en 2 bloques con teoría. Ofimática Windows 11.',
  keywords: [
    'temario auxiliar administrativo madrid 2027',
    'temario auxiliar madrid junio 2027',
    'temario oficial auxiliar madrid orden 1628',
    'temario oposiciones comunidad de madrid 2027',
    'temas auxiliar administrativo madrid windows 11',
    'teoría auxiliar madrid 2027',
    'temario gratis auxiliar madrid 2027'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Temario Auxiliar Administrativo Comunidad de Madrid 2027 (examen junio 2027) | Teoría Oficial',
    description: 'Accede al temario completo de la convocatoria 2026 (examen junio 2027) del Auxiliar Administrativo Comunidad de Madrid. 21 temas oficiales con teoría completa.',
    url: `${SITE_URL}/auxiliar-administrativo-madrid-2027/temario`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Temario Auxiliar Administrativo Comunidad de Madrid (examen junio 2027)',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Temario Auxiliar Administrativo Comunidad de Madrid 2027 | Vence',
    description: 'Temario completo de la convocatoria examen junio 2027. 21 temas oficiales con teoría.',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/auxiliar-administrativo-madrid-2027/temario`,
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

export default function TemarioLayout({ children }) {
  return children
}
