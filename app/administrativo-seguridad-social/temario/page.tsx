// app/administrativo-seguridad-social/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// Static generation: cache infinito, invalidar con revalidateTag('temario')
export const revalidate = false

export const metadata = {
  title: 'Temario Administrativo de la Seguridad Social | Vence.es',
  description: 'Temario oficial del Cuerpo Administrativo de la Administración de la Seguridad Social (BOE-A-2025-27158) con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/administrativo-seguridad-social/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="administrativo-seguridad-social"
      oposicionDisplayName="Administrativo de la Seguridad Social"
    />
  )
}
