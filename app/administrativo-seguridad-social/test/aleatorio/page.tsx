// app/administrativo-seguridad-social/test/aleatorio/page.tsx
import RandomTestPage from '@/components/test/RandomTestPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Test Aleatorio Administrativo Seguridad Social | Vence',
  description: 'Genera tests aleatorios personalizados para preparar las oposiciones de Administrativo de la Administración de la Seguridad Social.',
  keywords: ['test administrativo seguridad social', 'oposiciones seguridad social', 'test aleatorio', 'preparar oposiciones seguridad social'],
}

export default function TestAleatorioAdministrativoSSPage() {
  return <RandomTestPage oposicion="administrativo-seguridad-social" />
}
