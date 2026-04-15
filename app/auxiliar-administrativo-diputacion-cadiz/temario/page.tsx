// app/auxiliar-administrativo-diputacion-cadiz/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// Static generation: cache infinito, invalidar con revalidateTag('temario')
export const revalidate = false

export const metadata = {
  title: 'Temario Auxiliar Administrativo de la Diputación Provincial de Cádiz | Vence.es',
  description: 'Temario oficial de Auxiliar Administrativo de la Diputación Provincial de Cádiz con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-diputacion-cadiz/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-diputacion-cadiz"
      oposicionDisplayName="Auxiliar Administrativo de la Diputación Provincial de Cádiz"
    />
  )
}
