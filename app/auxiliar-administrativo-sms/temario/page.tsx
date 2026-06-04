// app/auxiliar-administrativo-sms/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Auxiliar Administrativo del Servicio Murciano de Salud | Vence.es',
  description: 'Temario oficial de Auxiliar Administrativo del Servicio Murciano de Salud con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-sms/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-sms"
      oposicionDisplayName="Auxiliar Administrativo del Servicio Murciano de Salud"
    />
  )
}
