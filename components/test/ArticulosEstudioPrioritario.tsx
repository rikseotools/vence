// components/test/ArticulosEstudioPrioritario.tsx
// Componente de análisis inteligente de artículos problemáticos
// Extraído de app/auxiliar-administrativo-estado/test/tema/[numero]/page.tsx
'use client'

import { useMemo } from 'react'

interface ArticulosEstudioPrioritarioProps {
  userAnswers: any[]
  tema: number
  totalRespuestas: number
  openArticleModal: (articleNumber: string, lawName: string) => void
}

interface ArticuloAgrupado {
  article_number: string | null
  law_name: string | null
  total_respuestas: number
  correctas: number
  incorrectas: number
  tiempo_promedio: number
  confianza_baja: number
  ultima_respuesta: string
  fallos_consecutivos: number
  ultima_correcta: string | null
}

interface ArticuloProblematico extends ArticuloAgrupado {
  precision: string
  porcentaje_confianza_baja: string
  tasa_fallos: string
  score_problema: number
}

interface Recomendacion {
  tipo: string
  prioridad: string
  titulo: string
  descripcion: string
  articulos: ArticuloProblematico[]
  accion: string
  iconoGrande?: string
  colorScheme: string
}

interface RecomendacionCardProps {
  recomendacion: Recomendacion
  openArticleModal: (articleNumber: string, lawName: string) => void
}

export { type ArticulosEstudioPrioritarioProps }

export default function ArticulosEstudioPrioritario({ userAnswers, tema, totalRespuestas, openArticleModal }: ArticulosEstudioPrioritarioProps) {
  const { articulosFallados, recomendaciones } = useMemo(() => {
    const totalRespuestasReales = userAnswers.length

    if (totalRespuestasReales === 0) {
      return {
        articulosFallados: [] as ArticuloProblematico[],
        recomendaciones: generarRecomendacionesInteligentes([], 0, tema),
      }
    }

    // Agrupar por artículo
    const articulosAgrupados = userAnswers.reduce((acc: Record<string, ArticuloAgrupado>, respuesta: any) => {
      const key = respuesta.articleNumber || 'sin-articulo'

      if (!acc[key]) {
        acc[key] = {
          article_number: respuesta.articleNumber,
          law_name: respuesta.lawName,
          total_respuestas: 0,
          correctas: 0,
          incorrectas: 0,
          tiempo_promedio: 0,
          confianza_baja: 0,
          ultima_respuesta: respuesta.createdAt,
          fallos_consecutivos: 0,
          ultima_correcta: null
        }
      }

      acc[key].total_respuestas++
      if (respuesta.isCorrect) {
        acc[key].correctas++
        acc[key].ultima_correcta = respuesta.createdAt
        acc[key].fallos_consecutivos = 0
      } else {
        acc[key].incorrectas++
        acc[key].fallos_consecutivos++
      }

      acc[key].tiempo_promedio += respuesta.timeSpentSeconds || 0
      if (respuesta.confidenceLevel === 'unsure' || respuesta.confidenceLevel === 'guessing') {
        acc[key].confianza_baja++
      }

      return acc
    }, {})

    const articulosProblematicos = (Object.values(articulosAgrupados) as ArticuloAgrupado[])
      .map(articulo => {
        const precision = (articulo.correctas / articulo.total_respuestas) * 100
        const tiempo_promedio = articulo.tiempo_promedio / articulo.total_respuestas
        const porcentaje_confianza_baja = (articulo.confianza_baja / articulo.total_respuestas) * 100
        const tasa_fallos = (articulo.incorrectas / articulo.total_respuestas) * 100

        return {
          ...articulo,
          precision: precision.toFixed(1),
          tiempo_promedio: Math.round(tiempo_promedio),
          porcentaje_confianza_baja: porcentaje_confianza_baja.toFixed(1),
          tasa_fallos: tasa_fallos.toFixed(1),
          score_problema: (100 - precision) + porcentaje_confianza_baja + (articulo.fallos_consecutivos * 10)
        }
      })
      .filter(articulo => {
        if (totalRespuestasReales < 10) {
          return articulo.incorrectas >= 1
        } else {
          return (
            articulo.total_respuestas >= 2 &&
            (
              parseFloat(articulo.precision) < 75 ||
              parseFloat(articulo.porcentaje_confianza_baja) > 25 ||
              articulo.incorrectas >= 2
            )
          )
        }
      })
      .sort((a, b) => b.score_problema - a.score_problema)
      .slice(0, 12)

    return {
      articulosFallados: articulosProblematicos,
      recomendaciones: generarRecomendacionesInteligentes(articulosProblematicos, totalRespuestasReales, tema),
    }
  }, [userAnswers, tema])

  function generarRecomendacionesInteligentes(articulosFalladosParam: ArticuloProblematico[], totalRespuestasReales: number, temaNumero: number): Recomendacion[] {
    const recomendacionesGeneradas: Recomendacion[] = []

    if (totalRespuestasReales === 0) {
      recomendacionesGeneradas.push({
        tipo: 'sin_datos',
        prioridad: 'info',
        titulo: `EMPIEZA TU ESTUDIO DEL TEMA ${temaNumero}`,
        descripcion: `No tienes respuestas registradas en el Tema ${temaNumero} aún.`,
        articulos: [],
        accion: 'Completa tu primer test para comenzar el análisis personalizado',
        iconoGrande: '🎯',
        colorScheme: 'blue'
      })
      return recomendacionesGeneradas
    }

    if (totalRespuestasReales < 10) {
      recomendacionesGeneradas.push({
        tipo: 'datos_insuficientes',
        prioridad: 'info',
        titulo: 'DATOS INSUFICIENTES PARA ANÁLISIS COMPLETO',
        descripcion: `Solo tienes ${totalRespuestasReales} respuesta${totalRespuestasReales > 1 ? 's' : ''} en el Tema ${temaNumero}. Necesitas al menos 10-15 para un análisis confiable.`,
        articulos: [],
        accion: 'Completa más tests para obtener recomendaciones personalizadas detalladas',
        iconoGrande: '📈',
        colorScheme: 'yellow'
      })

      if (articulosFalladosParam.length > 0) {
        recomendacionesGeneradas.push({
          tipo: 'observacion_preliminar',
          prioridad: 'info',
          titulo: 'PRIMERAS OBSERVACIONES',
          descripcion: `Hemos detectado ${articulosFalladosParam.length} artículo${articulosFalladosParam.length > 1 ? 's' : ''} con fallos iniciales en el Tema ${temaNumero}.`,
          articulos: articulosFalladosParam.slice(0, 3),
          accion: 'Estos artículos podrían necesitar atención, pero necesitamos más datos para confirmarlo',
          colorScheme: 'blue'
        })
      }

      return recomendacionesGeneradas
    }

    if (totalRespuestasReales < 25) {
      recomendacionesGeneradas.push({
        tipo: 'analisis_limitado',
        prioridad: 'info',
        titulo: 'ANÁLISIS PRELIMINAR',
        descripcion: `Con ${totalRespuestasReales} respuestas en el Tema ${temaNumero} podemos dar recomendaciones básicas. Para análisis completo necesitas 25+ respuestas.`,
        articulos: articulosFalladosParam.slice(0, 3),
        accion: 'Continúa practicando para obtener análisis más detallado y confiable',
        iconoGrande: '📊',
        colorScheme: 'yellow'
      })

      if (articulosFalladosParam.length > 0) {
        const articulosMasFallados = articulosFalladosParam.slice(0, 3)
        recomendacionesGeneradas.push({
          tipo: 'fallos_detectados',
          prioridad: 'media',
          titulo: 'ÁREAS DE MEJORA DETECTADAS',
          descripcion: `${articulosMasFallados.length} artículo${articulosMasFallados.length > 1 ? 's' : ''} del Tema ${temaNumero} que ya muestra${articulosMasFallados.length > 1 ? 'n' : ''} dificultades`,
          articulos: articulosMasFallados,
          accion: 'Revisar estos conceptos específicos del temario',
          colorScheme: 'orange'
        })
      } else {
        recomendacionesGeneradas.push({
          tipo: 'buen_inicio',
          prioridad: 'positiva',
          titulo: `BUEN INICIO EN EL TEMA ${temaNumero}`,
          descripcion: 'No se detectan problemas graves en tus primeras respuestas.',
          articulos: [],
          accion: 'Sigue practicando para consolidar tu conocimiento',
          colorScheme: 'green'
        })
      }

      return recomendacionesGeneradas
    }

    if (articulosFalladosParam.length > 0) {
      recomendacionesGeneradas.push({
        tipo: 'fallos_importantes',
        prioridad: 'alta',
        titulo: `REVISAR CONCEPTOS DEL TEMA ${temaNumero}`,
        descripcion: `${articulosFalladosParam.length} artículo${articulosFalladosParam.length > 1 ? 's' : ''} que necesita${articulosFalladosParam.length > 1 ? 'n' : ''} más práctica`,
        articulos: articulosFalladosParam.slice(0, 6),
        accion: `Repasar los conceptos fundamentales del Tema ${temaNumero}`,
        colorScheme: 'red'
      })
    } else {
      recomendacionesGeneradas.push({
        tipo: 'excelente_dominio',
        prioridad: 'positiva',
        titulo: `EXCELENTE DOMINIO DEL TEMA ${temaNumero}`,
        descripcion: `Con ${totalRespuestasReales} respuestas analizadas, no se detectan áreas problemáticas.`,
        articulos: [],
        accion: 'Mantén este excelente nivel y considera avanzar a otros temas',
        iconoGrande: '🏆',
        colorScheme: 'green'
      })
    }

    return recomendacionesGeneradas
  }

  return (
    <div className="space-y-6">

      {recomendaciones.length > 0 && (
        <div>
          <div className="space-y-3">
            {recomendaciones.map((rec, index) => (
              <RecomendacionCard key={index} recomendacion={rec} openArticleModal={openArticleModal} />
            ))}
          </div>
        </div>
      )}

      {articulosFallados.length > 0 && totalRespuestas >= 10 && (
        <div>
          <h5 className="font-bold text-gray-800 mb-3">Artículos que Necesitan Atención</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {articulosFallados.slice(0, 6).map((articulo, index) => (
              <div
                key={index}
                className="p-3 rounded-lg border bg-yellow-50 border-yellow-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-gray-800">
                      Artículo {articulo.article_number}
                    </div>
                    <div className="text-xs text-gray-600">{articulo.law_name}</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${
                      parseFloat(articulo.precision) >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {articulo.precision}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {articulo.correctas}/{articulo.total_respuestas}
                    </div>
                    <div className="text-xs text-red-600 font-medium">
                      {articulo.incorrectas} fallos
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-600 space-y-1">
                  <div>Tiempo: {articulo.tiempo_promedio}s promedio</div>
                  <div>Dudas: {articulo.porcentaje_confianza_baja}%</div>
                  {articulo.fallos_consecutivos > 0 && (
                    <div className="text-red-600 font-medium">
                      {articulo.fallos_consecutivos} fallos consecutivos
                    </div>
                  )}
                  {articulo.ultima_correcta && (
                    <div className="text-green-600">
                      Última correcta: {new Date(articulo.ultima_correcta).toLocaleDateString()}
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => openArticleModal(articulo.article_number || '', articulo.law_name || '')}
                    className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-2 py-1 rounded-md font-medium transition-colors flex items-center"
                  >
                    Ver artículo {articulo.article_number} de {articulo.law_name}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {articulosFallados.length > 6 && (
            <div className="text-center mt-3">
              <span className="text-sm text-gray-500">
                Y {articulosFallados.length - 6} artículo{articulosFallados.length - 6 > 1 ? 's' : ''} más que necesita{articulosFallados.length - 6 > 1 ? 'n' : ''} atención
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// COMPONENTE: Card de Recomendación
function RecomendacionCard({ recomendacion, openArticleModal }: RecomendacionCardProps) {
  const estilosColor = {
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      texto: 'text-blue-800',
      titulo: 'text-blue-900'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      texto: 'text-yellow-800',
      titulo: 'text-yellow-900'
    },
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      texto: 'text-red-800',
      titulo: 'text-red-900'
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      texto: 'text-green-800',
      titulo: 'text-green-900'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      texto: 'text-orange-800',
      titulo: 'text-orange-900'
    }
  }

  const colores = estilosColor[recomendacion.colorScheme as keyof typeof estilosColor] || estilosColor.blue

  return (
    <div className={`p-4 rounded-lg border ${colores.bg} ${colores.border}`}>
      {recomendacion.iconoGrande && (
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">{recomendacion.iconoGrande}</div>
        </div>
      )}

      <div className="flex items-start justify-between mb-2">
        <h6 className={`font-bold ${colores.titulo} ${recomendacion.iconoGrande ? 'text-center w-full text-lg' : ''}`}>
          {recomendacion.titulo}
        </h6>
        {recomendacion.articulos.length > 0 && !recomendacion.iconoGrande && (
          <span className={`px-2 py-1 rounded-full text-xs font-bold bg-white bg-opacity-50 ${colores.texto}`}>
            {recomendacion.articulos.length} artículo{recomendacion.articulos.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <p className={`text-sm mb-3 ${colores.texto} ${recomendacion.iconoGrande ? 'text-center' : ''}`}>
        {recomendacion.descripcion}
      </p>

      <div className={`text-sm font-medium ${colores.titulo} ${recomendacion.iconoGrande ? 'text-center' : ''}`}>
        {recomendacion.accion}
      </div>

      {recomendacion.articulos.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium mb-2 text-gray-700">
            Artículos detectados:
          </div>
          <div className="flex flex-wrap gap-2">
            {recomendacion.articulos.slice(0, 6).map((articulo, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded text-xs font-medium bg-white bg-opacity-50"
              >
                Art. {articulo.article_number}
                {articulo.precision && ` (${articulo.precision}%)`}
                {articulo.incorrectas && ` ${articulo.incorrectas} fallos`}
              </span>
            ))}
            {recomendacion.articulos.length > 6 && (
              <span className="text-xs text-gray-500 self-center">
                +{recomendacion.articulos.length - 6} más
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
