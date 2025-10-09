# README Newsletter - Guía Completa

## Descripción General
El sistema de newsletters de Vence permite comunicar mejoras, nuevas funcionalidades y actualizaciones importantes a los usuarios registrados. Cada newsletter es una plantilla de email independiente que se envía desde el panel de administración.

## Ubicación del Sistema
- **Panel Admin**: `/app/admin/newsletters/page.js`
- **Templates**: `/lib/emails/templates.js`
- **Servicio de Email**: `/lib/emails/emailService.server.js`

## Estructura de una Newsletter

### 1. Plantilla en `templates.js`
Cada newsletter necesita una entrada en el objeto `emailTemplates`:

```javascript
nombre_funcionalidad: {
  subject: (userName, datos) => `🎯 ${datos.titulo} - Vence`,
  html: (userName, daysInactive, testUrl, unsubscribeUrl, datos) => `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${datos.titulo}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #374151;">
      <!-- CONTENIDO HTML DEL EMAIL -->
    </body>
    </html>
  `
}
```

### 2. Opción en el Panel Admin
Añadir la nueva plantilla en `/app/admin/newsletters/page.js`:

```javascript
{/* Nueva opción de plantilla */}
<div
  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
    selectedTemplate === 'nombre_funcionalidad' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'
  }`}
  onClick={() => {
    setSelectedTemplate('nombre_funcionalidad')
    setPreviewContent(/* HTML CONTENT */)
    setShowPreview(true)
  }}
>
  <div className="flex justify-between items-start">
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-2">
        <h5 className="font-medium text-gray-800 text-sm">
          🎯 Nombre de la Funcionalidad
        </h5>
      </div>
      <p className="text-xs text-gray-600">
        Descripción breve de qué comunica esta newsletter
      </p>
    </div>
  </div>
</div>
```

### 3. Actualizar `getEmailTypeName()`
Añadir el nuevo tipo en la función:

```javascript
export function getEmailTypeName(type) {
  const names = {
    'reactivacion': 'Reactivación',
    'rebranding': 'Rebranding',
    'filtrado_leyes': 'Filtrado por Leyes',
    'nombre_funcionalidad': 'Nombre Descriptivo',
    // ... otros tipos
  }
  return names[type] || type
}
```

## Elementos Estándar de una Newsletter

### Header con Branding Vence
```html
<div style="background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px;">
  <h1 style="margin: 0; font-size: 28px; font-weight: bold;">
    🎯 ${datos.titulo}
  </h1>
  <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">
    Una nueva mejora que hará tu estudio más eficiente
  </p>
</div>
```

### Sección de Contenido Principal
```html
<div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 20px 0;">
  <h3 style="color: #1e3a8a; margin-top: 0; font-size: 18px;">
    ✨ ¿Qué hemos mejorado?
  </h3>
  <p style="margin: 0; color: #475569; font-size: 15px; line-height: 1.6;">
    ${datos.descripcion}
  </p>
</div>
```

### Lista de Beneficios
```html
<div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 6px;">
  <h4 style="color: #047857; margin-top: 0; font-size: 16px;">✨ Beneficios:</h4>
  <ul style="color: #047857; font-size: 14px; margin: 10px 0; padding-left: 20px;">
    ${datos.beneficios.map(beneficio => `<li>${beneficio}</li>`).join('')}
  </ul>
</div>
```

### CTA (Call to Action)
```html
<div style="text-align: center; margin: 30px 0;">
  <a href="https://www.vence.es/auxiliar-administrativo-estado/test" 
     style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%); color: white; padding: 18px 35px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 12px rgba(30, 64, 175, 0.3);">
    🎯 Probar la Nueva Función
  </a>
</div>
```

### Sección de Feedback
```html
<div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 20px 0;">
  <p style="margin: 0; color: #92400e; font-size: 14px; text-align: center;">
    <strong>💡 ¿Detectas algún problema o tienes ideas?</strong><br>
    Responde a este email o usa el <strong>botón de feedback</strong> en la aplicación. ¡Tu opinión nos ayuda a mejorar!
  </p>
</div>
```

### Firma Estándar
```html
<p style="margin-top: 30px;">
  <strong>Manuel</strong><br>
  <strong>Vence.es</strong><br>
  <em>Preparando tu futuro, pregunta a pregunta</em>
</p>
```

## Datos de Ejemplo para Testing

Cada newsletter debería incluir un objeto de datos de ejemplo:

```javascript
const datosEjemplo = {
  titulo: "Título de la Funcionalidad",
  descripcion: "Descripción detallada de la mejora implementada",
  problema_anterior: "Qué problema existía antes de la mejora",
  solucion: "Cómo se resuelve el problema ahora",
  beneficios: [
    "⚡ Beneficio 1: descripción del beneficio",
    "🎯 Beneficio 2: descripción del beneficio",
    "📚 Beneficio 3: descripción del beneficio"
  ]
}
```

## Colores y Branding

### Colores Principales de Vence
- **Azul Principal**: `#1e40af` 
- **Azul Oscuro**: `#1e3a8a`
- **Gradiente Header**: `linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)`

### Colores para Estados
- **Éxito/Beneficios**: `#10b981` (verde)
- **Advertencia/Feedback**: `#fbbf24` (amarillo)
- **Información**: `#3b82f6` (azul claro)
- **Fondo Neutral**: `#f8fafc` (gris muy claro)

## Proceso de Creación de Nueva Newsletter

### 1. Planificación
- Definir el objetivo de la comunicación
- Identificar la audiencia objetivo
- Estructurar el mensaje principal

### 2. Implementación
- Crear entrada en `emailTemplates` en `templates.js`
- Añadir opción en el panel admin (`/app/admin/newsletters/page.js`)
- Actualizar función `getEmailTypeName()`
- Crear archivo de ejemplo en `/examples/newsletter-nombre.js`

### 3. Testing
- Probar el preview en el panel admin
- Verificar responsive design
- Testear enlaces y CTAs
- Revisar ortografía y tono

### 4. Validación
- Confirmar que el HTML se renderiza correctamente
- Verificar que todos los datos dinámicos se muestran
- Comprobar que el unsubscribe funciona
- Testear en diferentes clientes de email

## Mejores Prácticas

### Contenido
- **Título claro**: Explica el beneficio principal en el subject
- **Problema → Solución**: Estructura que conecta con el usuario
- **Beneficios concretos**: Lista específica de mejoras
- **CTA claro**: Acción específica que queremos que tome el usuario

### Diseño
- **Mobile-first**: Asegurar que se ve bien en móvil
- **Jerarquía visual**: Headers, secciones y espaciado consistente
- **Branding coherente**: Usar colores y tipografías de Vence
- **Accesibilidad**: Contraste adecuado y texto legible

### Técnico
- **HTML semántico**: Usar estructura HTML correcta
- **Inline CSS**: Máxima compatibilidad con clientes de email
- **Fallbacks**: Colores y fuentes de respaldo
- **Testing**: Probar en múltiples clientes de email

## Ejemplo Completo

Ver `/examples/newsletter-modal-mejora.js` para un ejemplo completo de implementación de newsletter con todos los elementos estándar.

## Notas Importantes

1. **Siempre incluir unsubscribe**: Requisito legal y buena práctica
2. **Personalización**: Usar el nombre del usuario cuando sea posible
3. **Tracking**: Las aperturas y clicks se trackean automáticamente
4. **Frecuencia**: No sobrecargar a los usuarios con demasiados emails
5. **Feedback**: Siempre incluir manera de que los usuarios respondan

## Troubleshooting

### Email no se envía
- Verificar configuración de Resend
- Comprobar que el template existe en `templates.js`
- Revisar logs del servidor

### HTML se ve mal
- Verificar que CSS está inline
- Comprobar caracteres especiales
- Testear en diferentes clientes

### Datos no aparecen
- Verificar que los datos se pasan correctamente
- Comprobar sintaxis de template literals
- Revisar tipos de datos esperados