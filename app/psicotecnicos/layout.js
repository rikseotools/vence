export const metadata = {
  title: 'Examen psicotécnico',
  description: 'Realiza todos los exámenes psicotécnicos que quieras, con este test online clasificados por temas',
  keywords: 'test psicotécnico, examen psicotécnico, pruebas psicotécnicas, aptitudes, razonamiento, cálculo numérico, series numéricas, analogías, ortografía',
  openGraph: {
    title: 'Examen psicotécnico - Tests Online Gratuitos',
    description: 'Realiza todos los exámenes psicotécnicos que quieras, con este test online clasificados por temas',
    url: 'https://vence.es/psicotecnicos',
    type: 'website',
    siteName: 'Vence - Preparación de Oposiciones'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Examen psicotécnico - Tests Online Gratuitos',
    description: 'Realiza todos los exámenes psicotécnicos que quieras, con este test online clasificados por temas'
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
  alternates: {
    canonical: `${process.env.SITE_URL || 'https://www.vence.es'}/psicotecnicos`
  }
}

export default function PsicotecnicosLayout({ children }) {
  return children
}