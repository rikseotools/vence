// app/auxiliar-administrativo-clm/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// Static generation: cache infinito, invalidar con revalidateTag('temario')
export const revalidate = false

export const metadata = {
  title: 'Temario Auxiliar Administrativo Castilla-La Mancha | Vence.es',
  description: 'Temario oficial de Auxiliar Administrativo Castilla-La Mancha con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-clm/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-clm"
      oposicionDisplayName="Auxiliar Administrativo Castilla-La Mancha"
    />
  )
}
