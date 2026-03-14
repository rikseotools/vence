// app/administrativo-estado/test/page.js - Hub de tests Administrativo del Estado (C1)
import TestHubPage from '@/components/test/TestHubPage'

export const metadata = {
  title: 'Tests Administrativo del Estado - Practica por Temas | Vence',
  description: 'Prepara tu oposición de Administrativo del Estado con tests organizados por temas. 45 temas en 6 bloques.',
  keywords: ['test administrativo estado', 'oposiciones estado C1', 'examen administrativo', 'test oposiciones'],
  openGraph: {
    title: 'Tests Administrativo del Estado - Practica por Temas',
    description: 'Prepara tu oposición de Administrativo del Estado con tests organizados por 6 bloques temáticos.',
    type: 'website',
  },
}

export default function Page() {
  return <TestHubPage oposicion="administrativo-estado" />
}
