// Templates de emails con unsubscribe
export const emailTemplates = {
  reactivacion: {
    subject: (userName, daysInactive) => `¡${userName}! Te echamos de menos - ${daysInactive} días sin estudiar`,
    html: (userName, daysInactive, testUrl, unsubscribeUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">Vence</h1>
          <p style="color: #6b7280; margin: 5px 0;">Tu sistema de preparación de oposiciones</p>
        </div>
        
        <h2 style="color: #2563eb;">¡Hola ${userName}! 👋</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Hace <strong style="color: #dc2626;">${daysInactive} días</strong> que no te vemos por Vence.
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Tu progreso te está esperando... ¡no pierdas el ritmo! 🚀
        </p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1f2937; margin-top: 0;">🎯 Te recomendamos:</h3>
          <p style="margin-bottom: 0;">Empezar con un <strong>test rápido de 10 preguntas</strong> para volver a coger el ritmo.</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${testUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            🚀 Empezar Test Ahora
          </a>
        </div>
        
        <div style="background: #fef3c7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            💡 <strong>Tip:</strong> Solo 15 minutos al día pueden marcar la diferencia en tu oposición.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="color: #6b7280; font-size: 12px; text-align: center;">
          <p>Este email se envió porque llevabas tiempo sin estudiar.</p>
          <p>
            Si no quieres recibir estos recordatorios, puedes 
            <a href="${unsubscribeUrl}" style="color: #2563eb;">desactivarlos en tu perfil</a>.
          </p>
          <p style="margin-top: 15px;">
            Vence - Preparación de Oposiciones<br>
            <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
          </p>
        </div>
      </div>
    `
  },
  
  urgente: {
    subject: (userName, daysInactive) => `🚨 ${userName}, ¡Han pasado ${daysInactive} días! Tu oposición no espera`,
    html: (userName, daysInactive, testUrl, unsubscribeUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px; background: #fef2f2; padding: 20px; border-radius: 8px;">
          <h1 style="color: #dc2626; margin: 0;">🚨 Vence - ALERTA</h1>
          <p style="color: #7f1d1d; margin: 5px 0; font-weight: bold;">Sistema de Reactivación Urgente</p>
        </div>
        
        <h2 style="color: #dc2626;">¡Alerta de Estudio, ${userName}!</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Han pasado <strong style="color: #dc2626; font-size: 18px;">${daysInactive} días completos</strong> sin estudiar.
        </p>
        <p style="color: #dc2626; font-weight: bold; font-size: 16px;">
          ⚠️ El tiempo es tu enemigo más peligroso en las oposiciones.
        </p>
        
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <h3 style="color: #7f1d1d; margin-top: 0;">💡 Consejo de Experto:</h3>
          <p style="margin-bottom: 0; color: #7f1d1d;">
            <strong>15 minutos hoy valen más que 2 horas mañana.</strong><br>
            La constancia es la clave del éxito en cualquier oposición.
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${testUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 18px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            ⚡ RETOMAR AHORA - Test de 10 min
          </a>
        </div>
        
        <div style="background: #1f2937; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #f9fafb;">🎯 Tu futuro profesional está en juego</h3>
          <p style="margin-bottom: 0;">
            No dejes que la pereza decida tu futuro.<br>
            <strong>Tu futuro yo te lo agradecerá.</strong>
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="color: #6b7280; font-size: 12px; text-align: center;">
          <p>Este es un recordatorio urgente porque llevabas mucho tiempo sin estudiar.</p>
          <p>
            Puedes <a href="${unsubscribeUrl}" style="color: #dc2626;">ajustar la frecuencia en tu perfil</a>.
          </p>
          <p style="margin-top: 15px;">
            Vence - Preparación de Oposiciones<br>
            <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
          </p>
        </div>
      </div>
    `
  },

  bienvenida_inmediato: {
    subject: () => `¡Bienvenido a Vence.es! 🎉`,
    html: (userName, daysInactive, testUrl, unsubscribeUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">Vence.es</h1>
          <p style="color: #6b7280; margin: 5px 0;">Tu sistema de preparación de oposiciones</p>
        </div>
        
        <h2 style="color: #2563eb;">¡Bienvenido ${userName}! 🎉</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Te damos la bienvenida a <strong style="color: #2563eb;">Vence.es</strong>, tu plataforma de preparación para oposiciones.
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          Ya tienes acceso a más de <strong>5.000 preguntas</strong> para preparar tu oposición a Auxiliar Administrativo del Estado.
        </p>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h3 style="color: #1f2937; margin-top: 0;">🚀 ¿Por dónde empezar?</h3>
          <ul style="margin-bottom: 0; color: #374151;">
            <li>Haz tu primer <strong>test rápido</strong> de 10 preguntas</li>
            <li>Explora el <strong>temario oficial</strong> actualizado</li>
            <li>Configura tests <strong>personalizados</strong> por temas</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${testUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
            🎯 Hacer mi Primer Test
          </a>
        </div>
        
        <div style="background: #ecfdf5; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #059669; font-size: 14px;">
            💡 <strong>Tip:</strong> La consistencia es clave. Dedica solo 15 minutos al día y verás resultados sorprendentes.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="color: #6b7280; font-size: 12px; text-align: center;">
          <p>Este email se envió porque acabas de registrarte en Vence.es.</p>
          <p>
            Si no quieres recibir emails informativos, puedes 
            <a href="${unsubscribeUrl}" style="color: #2563eb;">gestionar tus preferencias aquí</a>.
          </p>
          <p style="margin-top: 15px;">
            Vence.es - Preparación de Oposiciones<br>
            <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
          </p>
        </div>
      </div>
    `
  },

  bienvenida_motivacional: {
    subject: (userName, daysSince) => `${userName}, ¿te ayudamos a dar el primer paso? 🚀`,
    html: (userName, daysSince, testUrl, unsubscribeUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">Vence</h1>
          <p style="color: #6b7280; margin: 5px 0;">Tu primer paso hacia el éxito en oposiciones</p>
        </div>
        
        <h2 style="color: #2563eb;">¡Hola ${userName}! 👋</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Te registraste hace <strong>${daysSince} días</strong> y queremos asegurarnos de que tengas todo lo que necesitas para empezar.
        </p>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
          <h3 style="color: #0c4a6e; margin-top: 0;">🤔 ¿Sabías que...?</h3>
          <p style="margin-bottom: 0; color: #0c4a6e;">
            <strong>El 80% de las personas que aprueban oposiciones empezaron con su primer test en los primeros 7 días.</strong><br>
            No importa si no sabes nada aún, ¡el objetivo es empezar!
          </p>
        </div>
        
        <div style="background: #fefce8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #a16207; margin-top: 0;">🎯 Te facilitamos el primer paso:</h3>
          <ul style="color: #a16207; margin: 10px 0; padding-left: 20px;">
            <li><strong>Solo 5 preguntas</strong> súper básicas para empezar</li>
            <li><strong>Nivel principiante</strong> - sin presión</li>
            <li><strong>3 minutos</strong> de tu tiempo</li>
            <li><strong>Retroalimentación inmediata</strong> para que aprendas</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${testUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            🚀 Mi Primer Test (5 preguntas)
          </a>
        </div>
        
        <div style="background: #1f2937; color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #f9fafb;">💪 Mensaje de motivación</h3>
          <p style="margin-bottom: 0; line-height: 1.6;">
            "Todos los expertos fueron una vez principiantes. La diferencia está en dar el primer paso."<br>
            <em style="color: #d1d5db;">- No necesitas ser perfecto, solo necesitas empezar.</em>
          </p>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 0; color: #374151; font-size: 14px; text-align: center;">
            <strong>Promesa:</strong> Si no te gusta, puedes dejarlo. Pero al menos sabrás que lo intentaste. 😊
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="color: #6b7280; font-size: 12px; text-align: center;">
          <p>Te enviamos este email porque queremos ayudarte a empezar tu preparación.</p>
          <p>
            Si prefieres no recibir emails de motivación, puedes 
            <a href="${unsubscribeUrl}" style="color: #2563eb;">ajustarlo en tu perfil</a>.
          </p>
          <p style="margin-top: 15px;">
            Vence - Tu compañero en oposiciones<br>
            <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
          </p>
        </div>
      </div>
    `
  },


  // 🆕 NUEVO TEMPLATE SEMANAL
  resumen_semanal: {
    subject: (userName, articlesCount) => `📊 ${userName}, tu resumen semanal: ${articlesCount} artículos por mejorar`,
    html: (userName, daysInactive, testUrl, unsubscribeUrl, articlesData = []) => {
      const articlesHtml = articlesData.map(article => `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 12px 8px; text-align: left;">
            <strong style="color: #1f2937;">${article.law_name} - Art. ${article.article_number}</strong>
          </td>
          <td style="padding: 12px 8px; text-align: center;">
            <span style="background: #fef2f2; color: #dc2626; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">
              ${article.accuracy_percentage}%
            </span>
          </td>
          <td style="padding: 12px 8px; text-align: center; color: #6b7280; font-size: 14px;">
            ${article.total_attempts} intentos
          </td>
          <td style="padding: 12px 8px; text-align: left; color: #7c2d12; font-size: 13px;">
            ${article.recommendation}
          </td>
        </tr>
      `).join('')

      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 20px; border-radius: 8px;">
            <h1 style="color: white; margin: 0;">📊 Resumen Semanal</h1>
            <p style="color: #fca5a5; margin: 5px 0;">Artículos que necesitan tu atención</p>
          </div>
          
          <h2 style="color: #dc2626;">¡Hola ${userName}! 👋</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Esta semana detectamos <strong style="color: #dc2626;">${articlesData.length} artículos</strong> donde puedes mejorar significativamente.
          </p>
          
          <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0; border-radius: 4px;">
            <h3 style="color: #7f1d1d; margin-top: 0;">🎯 Tus Artículos Problemáticos:</h3>
            <p style="margin-bottom: 0; color: #7f1d1d; font-size: 14px;">
              Estos son los artículos con menor accuracy en tus tests de esta semana:
            </p>
          </div>
          
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f9fafb;">
                  <th style="padding: 12px 8px; text-align: left; color: #374151; font-size: 13px; font-weight: bold;">Artículo</th>
                  <th style="padding: 12px 8px; text-align: center; color: #374151; font-size: 13px; font-weight: bold;">Accuracy</th>
                  <th style="padding: 12px 8px; text-align: center; color: #374151; font-size: 13px; font-weight: bold;">Intentos</th>
                  <th style="padding: 12px 8px; text-align: left; color: #374151; font-size: 13px; font-weight: bold;">Recomendación</th>
                </tr>
              </thead>
              <tbody>
                ${articlesHtml}
              </tbody>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${testUrl}" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(220, 38, 38, 0.3);">
              📚 Repasar + Test Dirigido
            </a>
          </div>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #0c4a6e; margin-top: 0;">💡 Estrategia Recomendada:</h3>
            <ol style="color: #0c4a6e; margin: 10px 0; padding-left: 20px;">
              <li><strong>Repasa la teoría</strong> de estos artículos específicos</li>
              <li><strong>Haz el test dirigido</strong> con solo estos artículos</li>
              <li><strong>Repite hasta conseguir +80%</strong> de accuracy</li>
              <li><strong>Vuelve la próxima semana</strong> para mantenerlos frescos</li>
            </ol>
          </div>
          
          <div style="background: #1f2937; color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #f9fafb;">🎯 Recuerda:</h3>
            <p style="margin-bottom: 0;">
              <strong>La consistencia vence al talento.</strong><br>
              15 minutos repasando estos artículos puede marcar la diferencia en tu examen.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <div style="color: #6b7280; font-size: 12px; text-align: center;">
            <p>Este resumen se envía semanalmente solo si tienes artículos por mejorar.</p>
            <p>
              Puedes <a href="${unsubscribeUrl}" style="color: #dc2626;">desactivar estos emails</a> en cualquier momento.
            </p>
            <p style="margin-top: 15px;">
              Vence - Tu progreso semanal<br>
              <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
            </p>
          </div>
        </div>
      `
    }
  },

  // 🆕 TEMPLATE ESPECÍFICO PARA MEJORA DEL MODAL
  modal_articulos_mejora: {
    subject: (userName) => `🚀 ${userName}, consulta artículos sin perder tu progreso`,
    html: (userName, daysInactive, testUrl, unsubscribeUrl) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 25px; border-radius: 12px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎯 Vence Mejora</h1>
          <p style="color: #a7f3d0; margin: 8px 0; font-size: 16px;">Flujo de estudio optimizado</p>
        </div>
        
        <h2 style="color: #059669; font-size: 22px;">¡Hola ${userName}! 👋</h2>
        <p style="font-size: 16px; line-height: 1.6; color: #374151;">
          ¿Te pasaba que cuando querías consultar un artículo problemático <strong style="color: #dc2626;">perdías el hilo de tu análisis</strong>? 
          Hemos solucionado este problema con una mejora que te va a encantar.
        </p>
        
        <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 25px; margin: 25px 0; border-radius: 6px;">
          <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">🎯 Modal inteligente para artículos problemáticos</h3>
          <p style="margin-bottom: 0; color: #065f46; font-size: 15px; line-height: 1.6;">
            Ahora puedes consultar la teoría de cualquier artículo problemático sin salir de tu página de análisis. 
            Una ventana flotante te muestra toda la información que necesitas.
          </p>
        </div>
        
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 6px;">
          <h4 style="color: #7f1d1d; margin-top: 0; font-size: 16px;">😤 El problema que tenías antes:</h4>
          <p style="margin-bottom: 0; color: #7f1d1d; font-size: 14px;">
            Cuando aparecía un artículo problemático, tenías que hacer clic, ir a otra página, leer el artículo, 
            volver atrás, y recordar dónde estabas en tu análisis. <strong>Interrumpía tu concentración</strong> 
            y hacía que perdieras tiempo valioso.
          </p>
        </div>
        
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
          <h4 style="color: #1e3a8a; margin-top: 0; font-size: 16px;">✨ La solución que hemos implementado:</h4>
          <p style="margin-bottom: 0; color: #1e3a8a; font-size: 14px;">
            Modal (ventana flotante) que se abre sobre tu página actual. Lees el artículo completo, 
            ves si ha aparecido en exámenes oficiales, y cierras la ventana para continuar exactamente donde lo dejaste. 
            <strong>Sin navegación, sin pérdida de contexto.</strong>
          </p>
        </div>
        
        <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 25px 0;">
          <h3 style="color: #059669; margin-top: 0; font-size: 18px; text-align: center;">🎉 Beneficios para ti como opositor:</h3>
          <ul style="list-style: none; padding: 0; margin: 15px 0;">
            <li style="margin: 8px 0; color: #059669; font-size: 15px;">
              <strong>⚡ Acceso instantáneo a la teoría: consulta cualquier artículo en 1 click</strong>
            </li>
            <li style="margin: 8px 0; color: #059669; font-size: 15px;">
              <strong>🎯 Sin pérdida de contexto: mantén visible tu análisis de rendimiento</strong>
            </li>
            <li style="margin: 8px 0; color: #059669; font-size: 15px;">
              <strong>📚 Información completa: contenido del artículo + datos de exámenes oficiales</strong>
            </li>
            <li style="margin: 8px 0; color: #059669; font-size: 15px;">
              <strong>🚀 Flujo de estudio optimizado: estudia de forma más eficiente y fluida</strong>
            </li>
            <li style="margin: 8px 0; color: #059669; font-size: 15px;">
              <strong>📱 Funciona en móvil y ordenador: la misma experiencia en todos tus dispositivos</strong>
            </li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${testUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
            🎯 Probar la Nueva Función
          </a>
        </div>
        
        <div style="background: #1f2937; color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #f9fafb; font-size: 18px;">💪 Mensaje del equipo</h3>
          <p style="margin-bottom: 0; line-height: 1.6; font-size: 15px;">
            <strong>Entendemos las frustraciones del opositor.</strong><br>
            Cada interrupcción en tu flujo de estudio cuenta. Por eso trabajamos para que puedas 
            concentrarte en lo que importa: <em>aprender y aprobar tu oposición</em>.
          </p>
        </div>
        
        <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
            <strong>💡 ¿Detectas algún problema o tienes ideas?</strong> Responde a este email. ¡Tu feedback nos ayuda a mejorar!
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="color: #6b7280; font-size: 12px; text-align: center;">
          <p>Te enviamos esta actualización porque creemos que mejorará tu experiencia de estudio.</p>
          <p>
            Si no quieres recibir notificaciones de mejoras, puedes 
            <a href="${unsubscribeUrl}" style="color: #059669;">ajustarlo en tu perfil</a>.
          </p>
          <p style="margin-top: 15px;">
            Vence - Optimizando tu preparación<br>
            <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
          </p>
        </div>
      </div>
    `
  },

  // 🆕 TEMPLATE PARA COMUNICAR MEJORAS DE PRODUCTO
  mejoras_producto: {
    subject: (userName, mejoraTitulo) => `🚀 ${userName}, nueva mejora que te va a encantar: ${mejoraTitulo}`,
    html: (userName, daysInactive, testUrl, unsubscribeUrl, mejoraDatos = {}) => {
      const { titulo, descripcion, beneficios = [], problema_anterior, solucion } = mejoraDatos
      
      const beneficiosHtml = beneficios.map(beneficio => `
        <li style="margin: 8px 0; color: #059669; font-size: 15px;">
          <strong>${beneficio}</strong>
        </li>
      `).join('')

      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 25px; border-radius: 12px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🚀 Vence Mejora</h1>
            <p style="color: #a7f3d0; margin: 8px 0; font-size: 16px;">Nuevas funcionalidades para tu éxito</p>
          </div>
          
          <h2 style="color: #059669; font-size: 22px;">¡Hola ${userName}! 👋</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #374151;">
            Hemos estado trabajando para hacer tu experiencia de estudio aún mejor. 
            <strong style="color: #059669;">Te presentamos una nueva mejora</strong> que creemos que te va a facilitar mucho la vida.
          </p>
          
          <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 25px; margin: 25px 0; border-radius: 6px;">
            <h3 style="color: #065f46; margin-top: 0; font-size: 18px;">🎯 ${titulo}</h3>
            <p style="margin-bottom: 0; color: #065f46; font-size: 15px; line-height: 1.6;">
              ${descripcion}
            </p>
          </div>
          
          ${problema_anterior ? `
          <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <h4 style="color: #7f1d1d; margin-top: 0; font-size: 16px;">😤 El problema que tenías antes:</h4>
            <p style="margin-bottom: 0; color: #7f1d1d; font-size: 14px;">
              ${problema_anterior}
            </p>
          </div>
          ` : ''}
          
          <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; margin: 20px 0; border-radius: 6px;">
            <h4 style="color: #1e3a8a; margin-top: 0; font-size: 16px;">✨ La solución que hemos implementado:</h4>
            <p style="margin-bottom: 0; color: #1e3a8a; font-size: 14px;">
              ${solucion}
            </p>
          </div>
          
          ${beneficios.length > 0 ? `
          <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 25px; margin: 25px 0;">
            <h3 style="color: #059669; margin-top: 0; font-size: 18px; text-align: center;">🎉 Beneficios para ti como opositor:</h3>
            <ul style="list-style: none; padding: 0; margin: 15px 0;">
              ${beneficiosHtml}
            </ul>
          </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${testUrl}" style="display: inline-block; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3);">
              🎯 Probar la Nueva Función
            </a>
          </div>
          
          <div style="background: #1f2937; color: white; padding: 25px; border-radius: 12px; text-align: center; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #f9fafb; font-size: 18px;">💪 Nuestro Compromiso</h3>
            <p style="margin-bottom: 0; line-height: 1.6; font-size: 15px;">
              <strong>Escuchamos cada feedback y mejoramos constantemente.</strong><br>
              Tu éxito en la oposición es nuestra prioridad. Seguiremos innovando para que estudiar sea más eficiente y menos estresante.
            </p>
          </div>
          
          <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
              <strong>💡 ¿Tienes ideas para mejorar?</strong> Responde a este email. ¡Leemos todos los mensajes!
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <div style="color: #6b7280; font-size: 12px; text-align: center;">
            <p>Te enviamos esta actualización porque creemos que te puede ser útil en tu preparación.</p>
            <p>
              Si no quieres recibir notificaciones de mejoras del producto, puedes 
              <a href="${unsubscribeUrl}" style="color: #059669;">ajustarlo en tu perfil</a>.
            </p>
            <p style="margin-top: 15px;">
              Vence - Innovando para tu éxito<br>
              <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
            </p>
          </div>
        </div>
      `
    }
  },

  soporte_respuesta: {
    subject: () => `💬 El equipo de Vence te ha respondido`,
    html: (userName, adminMessage, chatUrl, unsubscribeUrl) => {
      // Crear extracto corto del mensaje (máximo 60 caracteres)
      const messagePreview = adminMessage.length > 60 
        ? adminMessage.substring(0, 60) + "..."
        : adminMessage;
      
      return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">Vence</h1>
          <p style="color: #6b7280; margin: 5px 0;">Tu sistema de preparación de oposiciones</p>
        </div>
        
        <h2 style="color: #2563eb;">¡Hola ${userName}! 💬</h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          Tienes una <strong style="color: #2563eb;">nueva respuesta</strong> del equipo de soporte:
        </p>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <p style="margin: 0; font-style: italic; color: #374151; font-size: 16px; line-height: 1.5;">
            "${messagePreview}"
          </p>
        </div>
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="${chatUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
            💬 Continuar Conversación
          </a>
        </div>
        
        <div style="background: #ecfdf5; padding: 15px; border-radius: 6px; margin: 25px 0; border-left: 3px solid #10b981;">
          <p style="margin: 0; color: #065f46; font-size: 14px;">
            ⚡ <strong>Respuesta rápida:</strong> Continúa la conversación directamente desde tu navegador.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="color: #6b7280; font-size: 12px; text-align: center;">
          <p>Este email se envió porque tienes una conversación activa de soporte.</p>
          <p>
            Si no quieres recibir notificaciones de chat, puedes 
            <a href="${unsubscribeUrl}" style="color: #2563eb;">gestionar tus preferencias aquí</a>.
          </p>
          <p style="margin-top: 15px;">
            Vence.es - Preparación de Oposiciones<br>
            <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
          </p>
        </div>
      </div>
      `
    }
  },

  impugnacion_respuesta: {
    subject: (status) => {
      const statusTitles = {
        'resolved': '✅ Tu impugnación ha sido respondida',
        'rejected': '❌ Tu impugnación ha sido respondida',
        'reviewing': '🔍 Tu impugnación está siendo revisada'
      }
      return statusTitles[status] || '📋 Actualización de tu impugnación'
    },
    html: (userName, status, adminResponse, questionText, disputeUrl, unsubscribeUrl) => {
      const statusConfig = {
        'resolved': {
          color: '#059669',
          bgColor: '#ecfdf5',
          icon: '✅',
          title: 'Impugnación Respondida',
          description: 'Hemos revisado tu reporte.'
        },
        'rejected': {
          color: '#dc2626',
          bgColor: '#fef2f2',
          icon: '❌',
          title: 'Impugnación Respondida',
          description: 'Hemos revisado tu reporte.'
        },
        'reviewing': {
          color: '#2563eb',
          bgColor: '#f0f9ff',
          icon: '🔍',
          title: 'En Revisión',
          description: 'Estamos analizando tu reporte en detalle.'
        }
      }
      
      const config = statusConfig[status] || statusConfig['reviewing'];
      
      // Crear extracto corto de la respuesta del admin (máximo 80 caracteres)
      const responsePreview = adminResponse?.length > 80 
        ? adminResponse.substring(0, 80) + "..."
        : adminResponse;
      
      return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0;">Vence</h1>
          <p style="color: #6b7280; margin: 5px 0;">Tu sistema de preparación de oposiciones</p>
        </div>
        
        <h2 style="color: #2563eb;">¡Hola ${userName}! ${config.icon}</h2>
        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
          Tienes una <strong style="color: ${config.color};">actualización</strong> sobre tu impugnación de pregunta:
        </p>
        
        <div style="background: ${config.bgColor}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${config.color};">
          <h3 style="margin: 0 0 10px 0; color: ${config.color}; font-size: 18px;">
            ${config.icon} ${config.title}
          </h3>
          <p style="margin: 0; color: ${config.color}; font-size: 14px;">
            ${config.description}
          </p>
        </div>
        
        ${questionText ? `
        <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px solid #e5e7eb;">
          <h4 style="margin: 0 0 8px 0; color: #374151; font-size: 14px;">📋 Pregunta impugnada:</h4>
          <p style="margin: 0; color: #6b7280; font-size: 13px; font-style: italic;">
            "${questionText.length > 120 ? questionText.substring(0, 120) + "..." : questionText}"
          </p>
        </div>
        ` : ''}
        
        ${adminResponse ? `
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2563eb;">
          <h4 style="margin: 0 0 10px 0; color: #1e40af; font-size: 16px;">💬 Respuesta del equipo:</h4>
          <p style="margin: 0; font-style: italic; color: #374151; font-size: 15px; line-height: 1.5;">
            "${responsePreview}"
          </p>
        </div>
        ` : ''}
        
        <div style="text-align: center; margin: 35px 0;">
          <a href="${disputeUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
            📋 Ver Detalles Completos
          </a>
        </div>
        
        <div style="background: #f3f4f6; padding: 15px; border-radius: 6px; margin: 25px 0;">
          <p style="margin: 0; color: #374151; font-size: 14px;">
            💡 <strong>¿No estás de acuerdo?</strong> Puedes enviar una alegación adicional desde la página de detalles.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
        
        <div style="color: #6b7280; font-size: 12px; text-align: center;">
          <p>Este email se envió porque tienes una impugnación de pregunta registrada.</p>
          <p>
            Si no quieres recibir notificaciones de impugnaciones, puedes 
            <a href="${unsubscribeUrl}" style="color: #2563eb;">gestionar tus preferencias aquí</a>.
          </p>
          <p style="margin-top: 15px;">
            Vence.es - Preparación de Oposiciones<br>
            <a href="mailto:info@vence.es" style="color: #6b7280;">info@vence.es</a>
          </p>
        </div>
      </div>
      `
    }
  }
}

// Función actualizada con el nuevo tipo
export function getEmailTypeName(type) {
  const names = {
    'bienvenida_inmediato': 'Bienvenida Inmediata',
    'reactivacion': 'Reactivación',
    'urgente': 'Urgente',
    'bienvenida_motivacional': 'Motivacional',
    'resumen_semanal': 'Resumen Semanal',
    'modal_articulos': 'Modal Artículos - Mejora UX',
    'modal_articulos_mejora': 'Modal Artículos - Mejora UX',
    'mejoras_producto': 'Mejoras de Producto',
    'soporte_respuesta': 'Respuesta de Soporte',
    'impugnacion_respuesta': 'Respuesta de Impugnación'
  }
  return names[type] || type
}