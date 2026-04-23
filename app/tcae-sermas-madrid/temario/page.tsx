// app/tcae-sermas-madrid/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// Static generation: cache infinito, invalidar con revalidateTag('temario')
export const revalidate = false

export const metadata = {
  title: 'Temario TCAE SERMAS Madrid | Vence.es',
  description: 'Temario oficial BOCM de TCAE (Auxiliar de Enfermeria) del SERMAS. 30 temas en 2 bloques: legislacion sanitaria y cuidados auxiliares de enfermeria. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/tcae-sermas-madrid/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="tcae-sermas-madrid"
      oposicionDisplayName="TCAE SERMAS"
    />
  )
}
