# 🚀 Testing Quick Start - Vence

Guía rápida para desarrolladores que necesitan trabajar con el sistema de testing de Vence.

## ⚡ **Comandos Esenciales**

```bash
# Ejecutar todos los tests
npm test

# Tests en modo desarrollo (watch)
npm run test:watch

# Tests con coverage completo
npm run test:coverage

# Tests solo de funciones críticas
npm run test:critical
```

## 🎯 **Antes de Hacer Commit**

El sistema **automáticamente** ejecuta tests antes de cada commit. Si fallan:

```bash
# 1. Ver qué tests están fallando
npm test

# 2. Arreglar el código

# 3. Verificar que todo pasa
npm run test:ci

# 4. Intentar commit nuevamente
git commit -m "tu mensaje"
```

## 🐛 **¿Tests Fallando? Debugging Rápido**

### **1. Tests de useTopicUnlock**
```bash
# Ejecutar solo estos tests
npm test -- --testPathPattern=useTopicUnlock

# Si fallan, probablemente tocaste:
# - hooks/useTopicUnlock.js
# - Alguna función que use get_user_theme_stats
# - Lógica de desbloqueo de temas
```

### **2. Tests de Componentes**
```bash
# Ejecutar solo tests de UI
npm run test:components

# Si fallan, probablemente tocaste:
# - Componentes React
# - Cambios en props o estructura
# - CSS/estilos que afectan renderizado
```

### **3. Coverage Bajo**
```bash
# Ver qué líneas no están cubiertas
npm run test:coverage

# Las funciones críticas DEBEN tener >80% coverage
# Si modificaste useTopicUnlock.js, asegúrate de no bajar coverage
```

## ✅ **Crear Tests para Nueva Funcionalidad**

### **1. Hook Nuevo**
```javascript
// __tests__/hooks/tuNuevoHook.test.js
import { renderHook } from '@testing-library/react'
import { tuNuevoHook } from '../../hooks/tuNuevoHook'

describe('tuNuevoHook', () => {
  test('debe hacer lo que promete', () => {
    const { result } = renderHook(() => tuNuevoHook())
    expect(result.current.valor).toBe('esperado')
  })
})
```

### **2. Componente Nuevo**
```javascript
// __tests__/components/TuComponente.test.js
import { render, screen } from '@testing-library/react'
import TuComponente from '../../components/TuComponente'

describe('TuComponente', () => {
  test('debe renderizar correctamente', () => {
    render(<TuComponente prop="valor" />)
    expect(screen.getByText('texto esperado')).toBeInTheDocument()
  })
})
```

## 🚨 **Casos Críticos a NO Romper**

### **❌ NUNCA hagas esto:**
```javascript
// En hooks/useTopicUnlock.js
if (!temaNumber) return  // ❌ Rompe tema_number: 0
```

### **✅ SIEMPRE verifica:**
```bash
# Antes de tocar useTopicUnlock.js
npm run test:hooks

# Después de hacer cambios  
npm run test:hooks

# Si coverage baja, añade más tests
```

## 🎯 **Datos de Prueba Realistas**

### **❌ NO uses datos inventados:**
```javascript
// ❌ MAL - datos falsos
{ tema_number: 1, precision: 82 }
```

### **✅ USA datos como en la BD real:**
```javascript
// ✅ BIEN - datos reales
{ tema_number: 0, accuracy: 82, total: 416 }  // 0-indexed!
```

## 🔧 **Troubleshooting Común**

### **"Tests pasan local, fallan en commit"**
```bash
# Limpiar cache de Jest
npm test -- --no-cache

# Verificar que no hay archivos sin trackear
git status

# Ejecutar exactamente lo mismo que el hook
npm run test:ci
```

### **"Coverage threshold not met"**
```bash
# Ver coverage actual
npm run test:coverage | grep useTopicUnlock

# Si bajó de 80%, añadir más tests o revisar código eliminado
```

### **"ReferenceError: afterEach is not defined"**
```bash
# Problema en jest.setup.js - ya está solucionado
# Si aparece de nuevo, verificar imports en tests
```

## 📊 **Métricas de Calidad Requeridas**

| Archivo | Coverage Mínimo |
|---------|----------------|
| `hooks/useTopicUnlock.js` | **80%** |
| Otros hooks | Informativo |
| Componentes | Informativo |
| Funciones críticas | **75%+** |

## 🚀 **Tips de Performance**

```bash
# Tests específicos (más rápido)
npm test -- --testPathPattern=nombreDelTest

# Skip setup pesado
npm test -- --no-setup

# Solo archivos cambiados (git)
npm test -- --onlyChanged
```

## 📝 **Checklist Antes de PR**

- [ ] `npm test` pasa al 100%
- [ ] `npm run test:ci` pasa (simula CI)
- [ ] Coverage de funciones críticas >80%
- [ ] Tests incluidos para nueva funcionalidad
- [ ] No hay `console.log` olvidados en tests
- [ ] Datos de prueba son realistas (no inventados)

## 🆘 **¿Necesitas Ayuda?**

1. **Lee los errores:** Jest da mensajes muy descriptivos
2. **Ejecuta tests específicos:** `npm test -- --testPathPattern=problema`
3. **Revisa la documentación:** `docs/testing/README.md`
4. **Verifica datos:** ¿Estás usando estructura real de BD?

---

**💡 Recuerda: Los tests están para ayudarte, no para molestarte. Si fallan, probablemente están protegiendo de un bug real!** 🛡️