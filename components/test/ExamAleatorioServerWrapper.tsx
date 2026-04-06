// components/test/ExamAleatorioServerWrapper.tsx
// Server component que lee nombres de temas desde BD y los pasa al client.
// Fuente de verdad: tabla topics. Sin dependencia de oposiciones.ts para nombres.
import { slugToPositionType } from '@/lib/config/oposiciones'
import { getTopicNamesMap } from '@/lib/api/topic-names/queries'
import { notFound } from 'next/navigation'
import ExamAleatorioClient from './ExamAleatorioClient'

interface Props {
  oposicionSlug: string
}

export default async function ExamAleatorioServerWrapper({ oposicionSlug }: Props) {
  const positionType = slugToPositionType(oposicionSlug)
  if (!positionType) notFound()

  const themeNames = await getTopicNamesMap(positionType)

  return (
    <ExamAleatorioClient
      oposicionSlug={oposicionSlug}
      positionType={positionType}
      themeNames={themeNames}
    />
  )
}
