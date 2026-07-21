// app/celador-murcia/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) | Vence.es',
  description: 'Temario oficial de Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS) con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/celador-murcia/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="celador-murcia"
      oposicionDisplayName="Celador/a-Subalterno/a del Servicio Murciano de Salud (SMS)"
    />
  )
}
