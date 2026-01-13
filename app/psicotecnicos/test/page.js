import PsicotecnicosTestClient from './PsicotecnicosTestClient'

export const metadata = {
  title: 'Tests Psicotécnicos Online - Vence | Practica Gratis',
  description: 'Practica tests psicotécnicos gratuitos con Vence. Más de 500 preguntas de razonamiento, lógica, matemáticas y capacidad administrativa. ¡Prepárate para tu oposición!',
  keywords: 'tests psicotécnicos online, examen psicotécnico, pruebas psicotécnicas gratis, razonamiento lógico, capacidad administrativa, oposiciones, Vence',
  openGraph: {
    title: 'Tests Psicotécnicos Online Gratuitos - Vence',
    description: 'Entrena con tests psicotécnicos reales. Razonamiento numérico, verbal, capacidad administrativa y más. Ideal para oposiciones.',
    url: 'https://www.vence.es/psicotecnicos/test',
    type: 'website',
    siteName: 'Vence'
  },
  twitter: {
    card: 'summary',
    title: 'Tests Psicotécnicos Online - Vence',
    description: 'Practica tests psicotécnicos gratuitos. Más de 500 preguntas para preparar tu oposición.'
  },
  alternates: {
    canonical: `${process.env.SITE_URL || 'https://www.vence.es'}/psicotecnicos/test`
  }
}

export default function PsicotecnicosTest() {
  return <PsicotecnicosTestClient />
}