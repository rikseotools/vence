// app/subalterno-parlamento-andalucia/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Subalternos del Parlamento de Andalucía | Vence.es',
  description: 'Temario oficial de Subalternos del Parlamento de Andalucía con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/subalterno-parlamento-andalucia/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="subalterno-parlamento-andalucia"
      oposicionDisplayName="Subalternos del Parlamento de Andalucía"
    />
  )
}
