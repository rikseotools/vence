// app/auxiliar-enfermeria-osakidetza/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// Static generation: cache infinito, invalidar con revalidateTag('temario')
export const revalidate = false

export const metadata = {
  title: 'Temario TCAE Osakidetza (País Vasco) | Vence.es',
  description: 'Temario oficial BOPV de TCAE (Auxiliar de Enfermería) de Osakidetza. 49 temas en 2 bloques: legislación sanitaria vasca y funciones TCAE. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/auxiliar-enfermeria-osakidetza/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="auxiliar-enfermeria-osakidetza"
      oposicionDisplayName="TCAE Osakidetza"
    />
  )
}
