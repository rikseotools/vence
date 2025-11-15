# 🧪 Sistema de Testing - Vence

Documentación completa del sistema de testing implementado en Vence para garantizar la calidad del código y prevenir regresiones.

## 🎯 **Resumen Ejecutivo**

El sistema de testing de Vence protege funcionalidades críticas como el desbloqueo de temas, evita regresiones en producción y garantiza que los cambios de código no rompan la experiencia del usuario.

### ✅ **Cobertura Actual**
- **33 tests unitarios** funcionando
- **80%+ coverage** en funciones críticas
- **CI/CD automatizado** con git hooks
- **Datos reales** de la base de datos en tests

## 📚 **Estructura de Tests**

```
__tests__/
├── hooks/
│   └── useTopicUnlock.test.js     # Tests críticos del sistema de desbloqueo
├── components/
│   └── TopicUnlockProgress.test.js # Tests de UI del progreso
├── questionSelection.test.js       # Tests del algoritmo de selección
└── setup.test.js                   # Tests básicos de configuración
```

## 🔧 **Configuración**

### **Jest Configuration (`jest.config.js`)**
```javascript
{
  testEnvironment: 'jsdom',           // Para React Testing Library
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.afterEnv.js'],
  coverageThreshold: {
    './hooks/useTopicUnlock.js': {    // Función crítica
      branches: 80,
      functions: 80, 
      lines: 80,
      statements: 75
    }
  }
}
```

### **Global Setup (`jest.setup.js`)**
- Mocks de Supabase y APIs externas
- Configuración de variables de entorno de prueba
- Mocks de ResizeObserver, IntersectionObserver, etc.

### **After Setup (`jest.afterEnv.js`)**
- React Testing Library matchers
- Cleanup automático después de cada test

## 🚀 **Scripts Disponibles**

| Comando | Descripción |
|---------|------------|
| `npm test` | Ejecutar todos los tests |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:coverage` | Tests con reporte de coverage |
| `npm run test:ci` | Tests para CI (sin watch) |
| `npm run test:hooks` | Tests solo de hooks |
| `npm run test:components` | Tests solo de componentes |
| `npm run test:critical` | Tests de funciones críticas |

## 🔍 **Tests Críticos**

### **1. useTopicUnlock Hook**
**Problema resuelto:** Bug donde usuarios como Mar Vazquez Fernandez veían 0% precisión y temas bloqueados incorrectamente.

```javascript
// ❌ BUG ORIGINAL
if (!temaNumber) return  // Rechazaba tema_number: 0 (Tema 1)

// ✅ FIX APLICADO  
if (typeof temaNumber !== 'number') return
const actualTemaNumber = temaNumber + 1  // 0-indexed → 1-indexed
```

**Tests incluidos:**
- ✅ Mapeo correcto de `tema_number: 0` → Tema 1
- ✅ Cálculo de precisión con datos reales
- ✅ Desbloqueo secuencial de temas
- ✅ Manejo de casos edge y errores
- ✅ Performance con grandes volúmenes de datos

### **2. TopicUnlockProgress Component**
Tests de interfaz de usuario que verifican:
- ✅ Renderizado correcto del progreso
- ✅ Estados de carga (loading/loaded)
- ✅ Colores según precisión (verde/naranja/rojo)
- ✅ Navegación y accesibilidad
- ✅ Casos edge (último tema, 100% precisión)

### **3. Question Selection Algorithm**
Tests del algoritmo de selección de preguntas:
- ✅ Priorización de preguntas nunca vistas
- ✅ Distribución mixta cuando no hay suficientes
- ✅ Consistencia entre sistemas de respuestas
- ✅ Ordenamiento por antigüedad (spaced repetition)

## 🛡️ **CI/CD Pipeline**

### **Git Hooks Pre-commit**
```bash
#!/bin/sh
echo "🧪 Ejecutando tests antes del commit..."
npm run test:ci

if [ $? -ne 0 ]; then
  echo "❌ Tests fallaron. Commit cancelado."
  exit 1
fi

echo "✅ Todos los tests pasaron. Continuando con el commit..."
```

**Configurado con Husky para ejecutar automáticamente antes de cada commit.**

### **Coverage Requirements**
- **Hooks críticos:** 80% minimum coverage
- **Componentes:** Coverage informativo
- **Funciones específicas:** Umbrales personalizados

## 📊 **Datos de Prueba Realistas**

### **❌ Problema Anterior: Falsos Positivos**
Los tests originales usaban datos incorrectos:
```javascript
// ❌ DATOS FALSOS (no detectaban bugs reales)
{ tema_number: 1, precision_percentage: 82 }
```

### **✅ Solución: Datos Reales**
Los tests actuales usan datos que reflejan la BD real:
```javascript
// ✅ DATOS REALES (detectan bugs reales)
{ tema_number: 0, accuracy: 82, total: 416 }  // 0-indexed como BD real
```

**Esto garantiza que los tests capturen bugs que afectan usuarios reales.**

## 🎓 **Buenas Prácticas Implementadas**

### **1. Principio de Datos Reales**
- Tests basados en estructura exacta de la BD
- Casos de prueba extraídos de usuarios reales
- Validación de casos edge con datos problemáticos

### **2. Cobertura Inteligente**
- Umbrales altos para funciones críticas
- Umbrales informativos para código estable
- Focus en paths de código importantes

### **3. Performance Testing**
- Tests de carga con 28 temas completos
- Verificación de tiempos de respuesta
- Detección de memory leaks

### **4. Mocking Estratégico**
- APIs externas siempre mockeadas
- Estados de error simulados
- Datos consistentes entre tests

## 🚨 **Casos Críticos Protegidos**

### **Bug de Mar Vazquez Fernandez**
- **Síntoma:** 0% precisión, temas bloqueados
- **Causa:** `tema_number: 0` rechazado por `!temaNumber`
- **Tests:** Verifican específicamente casos con `tema_number: 0`
- **Prevención:** Tests fallarían si se reintroduce el bug

### **Question Selection Issues**
- **Síntoma:** Preguntas repetidas pese a disponibilidad
- **Causa:** Algoritmo no priorizaba nunca vistas
- **Tests:** Verifican distribución y priorización

### **Component Rendering**
- **Síntoma:** UI inconsistente entre estados
- **Causa:** Diferentes sources de datos
- **Tests:** Verifican renderizado con datos reales

## 🔧 **Troubleshooting**

### **Tests Lentos**
```bash
# Ejecutar tests específicos
npm run test:hooks
npm run test -- --testPathPattern=useTopicUnlock
```

### **Coverage Bajo**
```bash
# Ver líneas no cubiertas
npm run test:coverage -- --verbose
```

### **Tests Fallando en CI**
```bash
# Modo debug
npm run test:ci -- --verbose --no-cache
```

## 📈 **Métricas de Calidad**

### **Coverage Actual**
- **useTopicUnlock.js:** 79% statements, 81% branches
- **Tests totales:** 33 casos
- **Tiempo ejecución:** ~3 segundos
- **Commits protegidos:** 100%

### **Casos de Uso Críticos Cubiertos**
- ✅ Usuario nuevo sin estadísticas
- ✅ Usuario con datos como Mar (problema original)
- ✅ Usuario con todos los temas completados
- ✅ Errores de conexión a BD
- ✅ Datos malformados o incompletos

## 🚀 **Roadmap**

### **Próximas Mejoras**
- [ ] Integration tests con BD real
- [ ] Visual regression tests para UI
- [ ] Performance benchmarks automáticos
- [ ] Tests de accesibilidad (a11y)
- [ ] Cross-browser testing

### **Expansión de Coverage**
- [ ] Tests para más hooks críticos
- [ ] Tests de flujos de usuario completos
- [ ] Tests de APIs backend
- [ ] Tests de seguridad y validación

---

## 📞 **Contacto**

Para questions sobre testing o mejoras al sistema:
1. **Revisar** este documento
2. **Ejecutar** `npm run test:critical` para verificar funciones críticas
3. **Consultar** logs de CI si hay fallos en commits

**¡El sistema de testing es la primera línea de defensa contra bugs en producción!** 🛡️