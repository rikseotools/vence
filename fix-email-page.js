// Código limpio para reemplazar en page.js líneas 108-119

      // Obtener conteo de suscripciones con función RPC
      const { data: subscriptionCount, error: rpcError } = await supabase
        .rpc('get_subscription_count')
      
      if (!rpcError && subscriptionCount && subscriptionCount.length > 0) {
        const counts = subscriptionCount[0]
        stats.subscriptionStatus.subscribed = counts.suscritos
        stats.subscriptionStatus.unsubscribed = counts.no_suscritos
        console.log(`✅ Conteo via RPC: ${counts.suscritos} suscritos, ${counts.no_suscritos} no suscritos de ${counts.total} usuarios totales`)
      } else {
        console.error('❌ Error obteniendo conteo RPC:', rpcError)
      }