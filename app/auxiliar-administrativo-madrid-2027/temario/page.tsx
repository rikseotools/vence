// app/auxiliar-administrativo-madrid-2027/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics). Gemela de auxiliar-administrativo-madrid (Windows 11 / examen junio 2027).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Auxiliar Administrativo Madrid 2027 (examen junio 2027) | Vence.es',
  description: 'Temario oficial de la convocatoria 2026 (Orden 1628, examen junio 2027) del Auxiliar Administrativo de la Comunidad de Madrid con legislación literal del BOE. Ofimática Windows 11 y Microsoft 365.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-administrativo-madrid-2027/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-administrativo-madrid-2027"
      oposicionDisplayName="Auxiliar Administrativo Madrid (examen junio 2027)"
    />
  )
}
