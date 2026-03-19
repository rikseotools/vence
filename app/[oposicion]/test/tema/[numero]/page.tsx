// app/[oposicion]/test/tema/[numero]/page.tsx
import TemaTestPage from '@/components/test/TemaTestPage'
import { getOposicion, ALL_OPOSICION_SLUGS } from '@/lib/config/oposiciones'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  const params: { oposicion: string; numero: string }[] = []
  for (const slug of ALL_OPOSICION_SLUGS) {
    const config = getOposicion(slug)
    if (!config) continue
    for (const block of config.blocks) {
      for (const theme of block.themes) {
        params.push({ oposicion: slug, numero: String(theme.id) })
      }
    }
  }
  return params
}

export default async function Page({ params }: { params: Promise<{ oposicion: string }> }) {
  const { oposicion } = await params
  const config = getOposicion(oposicion)
  if (!config) notFound()
  return <TemaTestPage oposicionSlug={config.slug} />
}
