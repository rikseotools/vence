// app/etgoa-sanidad-consumo/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario ETGOA Sanidad y Consumo | Vence.es',
  description: 'Temario oficial de ETGOA Sanidad y Consumo con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/etgoa-sanidad-consumo/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="etgoa-sanidad-consumo"
      oposicionDisplayName="ETGOA Sanidad y Consumo"
    />
  )
}
