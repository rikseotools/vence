# 🧪 Sistema de Validación Automática

Este sistema de validación detecta problemas **antes** de que ocurran, evitando errores como el "data.forEach is not a function" que experimentamos hoy.

## 🚀 Comandos Disponibles

### Verificación Rápida (2 segundos)
```bash
npm run test:system
```
**¿Qué valida?**
- ✅ Conexión a base de datos
- ✅ Estructura de preguntas de gráficos (evita forEach errors)  
- ✅ Algoritmo de priorización funciona
- ✅ Validaciones básicas

**Úsalo:** Antes de cada sesión de desarrollo

### Validación Completa (10 segundos)
```bash
npm run test:full
```
**¿Qué valida?**
- ✅ Todo lo anterior +
- ✅ Cada pregunta de gráfico individualmente
- ✅ Estructuras de datos de line charts y pie charts
- ✅ Compatibilidad de componentes React
- ✅ Conteos de preguntas por tipo
- ✅ Validaciones exhaustivas

**Úsalo:** Antes de commits importantes o deployments

## 🎯 ¿Qué problemas detecta?

### ❌ Errores que habría detectado HOY:
```
❌ Bar chart 2: data.forEach is not a function
   Structure: { quarters: [...] } - Invalid for current component
```

### ❌ Otros errores que detecta:
- Preguntas con `content_data` vacío o malformado
- Algoritmo de priorización roto (preguntas vistas aparecen primero)
- Conteos de UI incorrectos
- Estructuras incompatibles entre componentes
- Conexión a BD perdida

## 🔧 ¿Cómo funciona internamente?

### Validación de Gráficos de Barras
```javascript
// Simula exactamente lo que hace BarChartQuestion.js línea 30
const chartData = question.content_data?.chart_data

if (chartData.quarters && Array.isArray(chartData.quarters)) {
  // Nueva estructura (coches) ✅
  console.log('✅ Valid: New structure')
} else if (Array.isArray(chartData)) {
  // Estructura antigua (frutas) ✅  
  console.log('✅ Valid: Legacy structure')
} else {
  // ❌ Estructura no reconocida - CAUSARÍA ERROR
  throw new Error('Invalid structure - would cause forEach error')
}
```

### Validación de Priorización
```javascript
// Simula el algoritmo adaptativo
const neverSeen = questions.filter(q => !answeredIds.has(q.id))
const answered = questions.filter(q => answeredIds.has(q.id))
const finalOrder = [...neverSeen, ...answered]

// Verifica que nunca vistas aparezcan primero
if (finalOrder[0] !== expectedNeverSeenQuestion) {
  throw new Error('Prioritization broken')
}
```

## 📋 Flujo de Trabajo Recomendado

### Desarrollo Diario
```bash
# Al empezar a trabajar
npm run test:system

# Si todo está verde, continúa desarrollando
# Si algo está rojo, investiga antes de continuar
```

### Antes de Commits Importantes
```bash
# Antes de commit/push
npm run test:full

# Solo procede si está todo verde
git add .
git commit -m "Nueva feature"
git push origin main
```

### Debugging
Si encuentras un error:
```bash
# 1. Reproduce el error
npm run test:full

# 2. Identifica qué validación falla
# 3. Arregla el problema
# 4. Verifica que esté solucionado
npm run test:system
```

## 🎉 Beneficios

✅ **Detecta errores antes de que ocurran**
✅ **Ejecuta en 2-10 segundos** 
✅ **Valida caminos críticos del sistema**
✅ **Evita regresiones** cuando cambias código
✅ **Da confianza para desarrollar** sin miedo a romper cosas

## 💡 Próximos Pasos (Opcional)

1. **Pre-commit hooks**: Ejecutar automáticamente antes de cada commit
2. **GitHub Actions**: Validar en cada push
3. **Tests de componentes React**: Testing Library para UI
4. **Tests de integración**: Flujos completos de usuario

---

**💬 ¿Preguntas?** Estos scripts están diseñados para ser **rápidos y útiles**. Si algo no funciona o necesitas más validaciones, podemos añadirlas fácilmente.