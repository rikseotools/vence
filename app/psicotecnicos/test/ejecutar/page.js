import PsychometricTestExecutor from './PsychometricTestExecutor'

export const metadata = {
  title: 'Ejecutando Test Psicotécnico - Vence | Prueba en Curso',
  description: 'Realizando test psicotécnico personalizado en Vence. Evalúa tu razonamiento lógico, matemático y capacidades administrativas para oposiciones.',
  keywords: 'test psicotécnico en curso, examen psicotécnico online, evaluación aptitudes, Vence',
  openGraph: {
    title: 'Test Psicotécnico en Curso - Vence',
    description: 'Realizando evaluación psicotécnica personalizada para preparación de oposiciones.',
    url: 'https://www.vence.es/psicotecnicos/test/ejecutar',
    type: 'website',
    siteName: 'Vence'
  },
  robots: 'noindex, nofollow' // Los tests en curso no deben indexarse
}

export default function PsychometricTestPage() {
  return <PsychometricTestExecutor />
}