// app/guardia-civil/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Guardia Civil 2026 - Escala Cabos y Guardias | Vence.es',
  description: 'Temario oficial de Guardia Civil (Escala de Cabos y Guardias) con 25 temas: Derecho, Seguridad, TIC, Inglés. Legislación actualizada del BOE.',
  alternates: {
    canonical: 'https://www.vence.es/guardia-civil/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="guardia-civil"
      oposicionDisplayName="Guardia Civil - Escala de Cabos y Guardias"
    />
  )
}
