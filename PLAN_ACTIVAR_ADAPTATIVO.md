# 🎯 PLAN: Activar Sistema Adaptativo

## 📋 Objetivo
Hacer que el sistema adaptativo funcione: cuando el usuario falla preguntas (accuracy < 60%), el sistema debe mostrarle automáticamente preguntas más fáciles.

---

## ✅ Estado Actual

| Componente | Estado |
|------------|--------|
| Detección de accuracy bajo | ✅ Implementado (TestLayout.js:441-463) |
| Función adaptDifficulty() | ✅ Implementado (TestLayout.js:803-886) |
| Filtros con global_difficulty_category | ✅ Implementado (testFetchers.js) |
| **Generación de catálogo** | ❌ **FALTA** |

---

## 🛠️ PASO 1: Generar Catálogo Adaptativo

### Ubicación: `lib/testFetchers.js`

### Función a modificar: `fetchQuestionsByTopicScope()`

### Qué añadir al FINAL de la función (antes del return):

```javascript
// 🧠 MODO ADAPTATIVO: Generar catálogo si está activado
if (configParams.focusWeakAreas && user) {
  console.log('🧠 Generando catálogo adaptativo...')

  // 1. Obtener historial del usuario para saber qué ha respondido
  const { data: userTests } = await supabase
    .from('tests')
    .select('id')
    .eq('user_id', user.id)

  const testIds = userTests?.map(t => t.id) || []

  let answeredQuestionIds = new Set()
  if (testIds.length > 0) {
    const { data: answeredQuestions } = await supabase
      .from('test_questions')
      .select('question_id')
      .in('test_id', testIds)

    answeredQuestionIds = new Set(answeredQuestions?.map(q => q.question_id) || [])
  }

  // 2. Clasificar TODAS las preguntas por dificultad y estado
  const catalog = {
    neverSeen: { easy: [], medium: [], hard: [], extreme: [] },
    answered: { easy: [], medium: [], hard: [], extreme: [] }
  }

  allQuestions.forEach(question => {
    // Usar global_difficulty_category o fallback a difficulty
    const difficulty = question.global_difficulty_category || question.difficulty

    // Clasificar como "nunca vista" o "ya respondida"
    const isAnswered = answeredQuestionIds.has(question.id)

    if (isAnswered) {
      catalog.answered[difficulty]?.push(question)
    } else {
      catalog.neverSeen[difficulty]?.push(question)
    }
  })

  console.log('🧠 Catálogo generado:', {
    neverSeenEasy: catalog.neverSeen.easy.length,
    neverSeenMedium: catalog.neverSeen.medium.length,
    neverSeenHard: catalog.neverSeen.hard.length,
    answeredEasy: catalog.answered.easy.length,
    answeredMedium: catalog.answered.medium.length,
    answeredHard: catalog.answered.hard.length,
  })

  // 3. Retornar objeto especial con catálogo
  return {
    adaptiveCatalog: catalog,
    isAdaptive: true,
    activeQuestions: allQuestions.slice(0, configParams.numQuestions),
    questionPool: allQuestions
  }
}

// Modo normal (sin adaptativo)
return allQuestions
```

---

## 🎨 PASO 2: Añadir Opción en TestConfigurator

### Ubicación: `components/TestConfigurator.js`

### Qué añadir:

```jsx
// En el estado (cerca de línea 20):
const [focusWeakAreas, setFocusWeakAreas] = useState(false)

// En el render, añadir checkbox (después de excludeRecent):
<div className="flex items-center space-x-2">
  <input
    type="checkbox"
    id="focusWeakAreas"
    checked={focusWeakAreas}
    onChange={(e) => setFocusWeakAreas(e.target.checked)}
    className="w-4 h-4 text-blue-600 rounded"
  />
  <label htmlFor="focusWeakAreas" className="text-sm text-gray-700 dark:text-gray-300">
    🧠 Modo adaptativo (ajusta dificultad según tu rendimiento)
  </label>
</div>

// Al construir la URL (cerca de línea 150):
if (focusWeakAreas) queryParams.push('focus_weak=true')
```

---

## 🧪 PASO 3: Verificar que Funciona

### 3.1 Abrir DevTools Console

### 3.2 Iniciar test con "Modo adaptativo" activado

### 3.3 Buscar estos logs:

```
✅ "🧠 Generando catálogo adaptativo..."
✅ "🧠 Catálogo generado: { neverSeenEasy: X, ... }"
✅ "🧠 DETECTADO CATÁLOGO ADAPTATIVO - Configurando sistema inteligente"
✅ "🧠 Modo adaptativo disponible (pool cargado)"
```

### 3.4 Fallar intencionalmente 3-4 preguntas

### 3.5 Buscar este log:

```
✅ "🧠 Accuracy < 60%, adaptando a preguntas más fáciles..."
✅ "🧠 ADAPTACIÓN INTELIGENTE: Necesita preguntas easy"
✅ "🧠 Adaptación exitosa: X preguntas nunca vistas easy"
```

### 3.6 Verificar que las siguientes preguntas son más fáciles

---

## 🔧 PASO 4 (Opcional): Mejoras Adicionales

### 4.1 Activar automáticamente para usuarios nuevos

En `TestConfigurator.js`:
```jsx
useEffect(() => {
  // Activar adaptativo por defecto para usuarios nuevos
  if (user && !hasCompletedTests) {
    setFocusWeakAreas(true)
  }
}, [user])
```

### 4.2 Mostrar indicador visual cuando adapta

Ya implementado en `TestLayout.js` - muestra badge "Modo Adaptativo" cuando `isAdaptiveMode = true`

### 4.3 Añadir analytics

```javascript
// En TestLayout cuando adapta:
if (currentAccuracy < 60) {
  // Trackear evento
  trackEvent('adaptive_difficulty_triggered', {
    accuracy: currentAccuracy,
    direction: 'easier',
    tema: tema
  })
}
```

---

## 📊 Cómo Funciona (Diagrama de Flujo)

```
Usuario inicia test con "Modo adaptativo" ✓
    ↓
fetchQuestionsByTopicScope genera catálogo
    ↓
TestLayout detecta isAdaptive = true
    ↓
adaptiveMode = true
    ↓
Usuario responde preguntas
    ↓
Después de cada respuesta, calcula accuracy
    ↓
Si accuracy < 60% y >= 3 respuestas:
    ↓
Llama adaptDifficulty('easier')
    ↓
Busca preguntas "easy" en catalog.neverSeen
    ↓
Reemplaza preguntas restantes del test
    ↓
Usuario ve preguntas más fáciles
    ↓
Accuracy mejora (esperamos)
    ↓
Si accuracy > 70%: vuelve a dificultad normal
```

---

## ⚡ Ventajas del Sistema

1. **Automático**: No requiere configuración del usuario
2. **Inteligente**: Prioriza preguntas nunca vistas
3. **Adaptable**: Ajusta en tiempo real según rendimiento
4. **Motivacional**: Evita frustración del usuario
5. **Compatible**: Usa global_difficulty_category calculada

---

## 🎯 Métricas a Monitorear

Después de implementar, monitorear:

1. **Tasa de activación**: ¿Cuántos usuarios activan modo adaptativo?
2. **Mejora de accuracy**: ¿El accuracy mejora después de adaptar?
3. **Tasa de completado**: ¿Más usuarios completan tests con adaptativo?
4. **Distribución de dificultades**: ¿Qué % de tests terminan en "easy"?

---

## 🚀 Código Completo para Copiar

### Archivo 1: `lib/testFetchers.js`

Añadir al FINAL de `fetchQuestionsByTopicScope()`, justo antes del `return` final:

```javascript
// 🧠 MODO ADAPTATIVO: Generar catálogo si está activado
if (configParams.focusWeakAreas && user) {
  console.log('🧠 Generando catálogo adaptativo...')

  const { data: userTests } = await supabase
    .from('tests')
    .select('id')
    .eq('user_id', user.id)

  const testIds = userTests?.map(t => t.id) || []

  let answeredQuestionIds = new Set()
  if (testIds.length > 0) {
    const { data: answeredQuestions } = await supabase
      .from('test_questions')
      .select('question_id')
      .in('test_id', testIds)

    answeredQuestionIds = new Set(answeredQuestions?.map(q => q.question_id) || [])
  }

  const catalog = {
    neverSeen: { easy: [], medium: [], hard: [], extreme: [] },
    answered: { easy: [], medium: [], hard: [], extreme: [] }
  }

  allQuestions.forEach(question => {
    const difficulty = question.global_difficulty_category || question.difficulty
    const isAnswered = answeredQuestionIds.has(question.id)

    if (isAnswered) {
      catalog.answered[difficulty]?.push(question)
    } else {
      catalog.neverSeen[difficulty]?.push(question)
    }
  })

  console.log('🧠 Catálogo generado:', {
    neverSeenEasy: catalog.neverSeen.easy.length,
    neverSeenMedium: catalog.neverSeen.medium.length,
    neverSeenHard: catalog.neverSeen.hard.length,
    answeredEasy: catalog.answered.easy.length,
    answeredMedium: catalog.answered.medium.length,
    answeredHard: catalog.answered.hard.length,
  })

  return {
    adaptiveCatalog: catalog,
    isAdaptive: true,
    activeQuestions: allQuestions.slice(0, configParams.numQuestions),
    questionPool: allQuestions
  }
}
```

---

¿Quieres que implemente esto ahora?
