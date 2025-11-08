# 📊 Configuración de Google AdSense

## 🎯 Implementación Completada

✅ **AdSense integrado en tests** con la opción segura (1 anuncio por pregunta después de respuesta)

### 📍 Ubicaciones de Anuncios

1. **Después de cada respuesta** en TestLayout.js
   - Aparece después de ver explicación
   - Antes del botón "Siguiente Pregunta" 
   - Se muestra a partir de la pregunta 2 (`currentQuestion > 0`)

2. **Al finalizar test** en TestLayout.js
   - Después de estadísticas finales
   - Antes de botones de navegación

3. **Tests dinámicos con IA** en DynamicTest.js
   - Después de cada respuesta (igual lógica)
   - Al finalizar test dinámico

### 🔧 Configuración Técnica

**Script de AdSense cargado en:** `app/layout.js`
```javascript
<script
  async
  src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5346427920432730"
  crossOrigin="anonymous"
/>
```

**Componente AdSense:** `components/AdSenseComponent.js`
- Maneja la inicialización automática
- Configuración responsive
- Gestión de errores

**Configuración:** `lib/adsense-config.js` 
- IDs centralizados
- Fácil cambio de ad slots
- Helper functions

### 🚀 Para Activar en Producción

1. **Esperar aprobación de Google AdSense**
   - El sitio debe tener contenido y tráfico real
   - Google revisará manualmente

2. **Cambiar ad slots reales**
   - Actualizar `ADSENSE_CONFIG.AD_SLOTS` en `lib/adsense-config.js`
   - Reemplazar `'1234567890'` con slots reales

3. **Optimizar ubicaciones según performance**
   - Usar Google AdSense dashboard para ver métricas
   - Ajustar frecuencia si es necesario

### 💰 Revenue Esperado

**Con 25 preguntas por test:**
- ✅ 25 impresiones por test completado
- ✅ 1 impresión adicional en pantalla final
- ✅ Revenue incremental sin saturar UX

### 📊 Métricas a Monitorear

- **CTR (Click Through Rate)**: Objetivo >1%
- **CPC (Cost Per Click)**: Depende de nicho jurídico  
- **Abandono**: Vigilar que no aumente por anuncios
- **Tiempo en test**: Mantener engagement alto

### ⚠️ Notas Importantes

- **NO usar más anuncios**: Podría violar políticas de Google
- **Mantener UX**: Los anuncios no deben ser intrusivos
- **Compliance**: El texto "Publicidad" cumple normativas EU
- **Mobile-friendly**: Responsive design implementado

¡Sistema listo para monetizar cuando Google apruebe el sitio! 🎉