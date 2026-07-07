// app/subalterno-gva/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Subalterno/a Generalitat Valenciana | Vence.es',
  description: 'Temario oficial de Subalterno/a de la Generalitat Valenciana (Conv. 80/26) con legislación literal. Acceso gratuito a los 15 temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/subalterno-gva/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="subalterno-gva"
      oposicionDisplayName="Subalterno/a de la Generalitat Valenciana"
    />
  )
}
