// Ejemplo de uso del template "mejoras_producto" para comunicar la mejora del modal
// Este archivo es un ejemplo de cómo enviar un email sobre la nueva funcionalidad

import { emailTemplates } from '../lib/emails/templates.js'

// Datos específicos para la mejora del modal de artículos problemáticos
const mejoraDatos = {
  titulo: "Modal inteligente para artículos problemáticos",
  descripcion: "Ahora puedes consultar la teoría de los artículos que más te cuestan sin perder el contexto de tu análisis de rendimiento. Una ventana flotante te muestra el contenido completo del artículo mientras mantienes visible tu progreso.",
  problema_anterior: "Antes, cuando querías consultar un artículo problemático, tenías que navegar a otra página, perder el contexto de tu análisis, y luego volver para continuar estudiando. Era frustrante e interrumpía tu flujo de estudio.",
  solucion: "Hemos implementado un modal (ventana flotante) que se abre sobre tu página actual. Puedes leer el artículo completo, ver si ha aparecido en exámenes oficiales, y cerrar la ventana para continuar donde lo dejaste. Sin navegación, sin pérdida de contexto.",
  beneficios: [
    "⚡ Acceso instantáneo a la teoría: consulta cualquier artículo en 1 click",
    "🎯 Sin pérdida de contexto: mantén visible tu análisis de rendimiento", 
    "📚 Información completa: contenido del artículo + datos de exámenes oficiales",
    "🚀 Flujo de estudio optimizado: estudia de forma más eficiente y fluida",
    "📱 Funciona en móvil y ordenador: la misma experiencia en todos tus dispositivos"
  ]
}

// Función para enviar el email (simulada)
async function enviarEmailMejora(usuario) {
  const emailData = {
    type: 'mejoras_producto',
    to: usuario.email,
    subject: emailTemplates.mejoras_producto.subject(usuario.name, mejoraDatos.titulo),
    html: emailTemplates.mejoras_producto.html(
      usuario.name,
      0, // days inactive no aplica para este tipo de email
      `https://www.vence.es/auxiliar-administrativo-estado/test/tema/1`, // URL del test
      `https://www.vence.es/unsubscribe?token=${usuario.unsubscribeToken}`, // URL unsubscribe  
      mejoraDatos
    )
  }

  console.log('📧 Email de mejora preparado para:', usuario.email)
  console.log('📋 Asunto:', emailData.subject)
  
  // Aquí se enviaría el email real usando Resend
  // await resend.emails.send(emailData)
  
  return emailData
}

// Ejemplo de uso para diferentes usuarios
const usuariosEjemplo = [
  {
    name: "María",
    email: "maria@example.com", 
    unsubscribeToken: "abc123"
  },
  {
    name: "Carlos",
    email: "carlos@example.com",
    unsubscribeToken: "def456"  
  }
]

// Simular envío masivo
async function enviarCampañaMejora() {
  console.log('🚀 Iniciando campaña de email sobre mejora del modal')
  
  for (const usuario of usuariosEjemplo) {
    await enviarEmailMejora(usuario)
  }
  
  console.log(`✅ Campaña completada para ${usuariosEjemplo.length} usuarios`)
}

// Exportar para uso en otros archivos
export { mejoraDatos, enviarEmailMejora, enviarCampañaMejora }

/* 
NOTAS PARA OPOSITOR:

Como opositor, esta mejora es especialmente valiosa porque:

1. **Tiempo es oro**: Cada segundo cuenta en la preparación. No perder tiempo navegando entre páginas.

2. **Concentración**: Mantener el foco en el análisis de rendimiento sin distracciones.

3. **Aprendizaje contextual**: Ver inmediatamente por qué un artículo es problemático y su contenido.

4. **Eficiencia**: Estudiar de forma más inteligente, no más dura.

5. **Confianza**: Saber que la plataforma evoluciona para hacerte la vida más fácil.

El email debe transmitir que entendemos las frustraciones del opositor y que trabajamos activamente para solucionarlas.
*/