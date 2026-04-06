// app/auxiliar-administrativo-la-rioja/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// Static generation: cache infinito, invalidar con revalidateTag('temario')
export const revalidate = false

export const metadata = {
  title: 'Temario Auxiliar Administrativo La Rioja | Vence.es',
  description: 'Temario oficial de Auxiliar Administrativo del Gobierno de La Rioja con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-la-rioja/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-la-rioja"
      oposicionDisplayName="Aux. La Rioja"
    />
  )
}
