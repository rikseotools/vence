# Detección de Oposiciones Duplicadas

## 📋 Problema Original

**Fecha:** 08/01/2025
**Reportado por:** Usuario observó que el perfil de David no mostraba la proyección de preparación

### Causa Raíz

Cuando un usuario creaba una **oposición personalizada** con un nombre que coincidía con una oposición oficial (ej: "Auxiliar Administrativo del Estado"), el sistema:

1. Creaba una nueva fila en la tabla `oposiciones` con un UUID
2. Guardaba ese **UUID en `target_oposicion`** en lugar del slug oficial (`auxiliar_administrativo_estado`)
3. Esto causaba que:
   - ✅ El nombre se mostraba correctamente (función `getOposicionName()` convertía UUID a nombre)
   - ❌ La proyección de preparación NO se mostraba (comparación fallaba porque buscaba string, no UUID)

### Ejemplo del Problema

```javascript
// ❌ ANTES: Usuario David
target_oposicion: "60798ede-09d3-49b9-ad1e-712201d2169c" (UUID)

// UserProfileModal.js línea 303
{profileData.target_oposicion === 'auxiliar_administrativo_estado' ? (
  // ❌ Esta condición NUNCA se cumplía porque comparaba con UUID
  <TemasDominados />
) : (
  <TestsCompletados />
)}
```

---

## ✅ Solución Implementada

### 1. Detección Automática de Duplicados

Se añadió lógica en `OnboardingModal.js` para detectar cuando un usuario intenta crear una oposición personalizada que coincide con una oficial.

#### Funciones Añadidas

**`normalizeOposicionName(name)`**
```javascript
// Normaliza nombres para comparación:
// - Minúsculas
// - Sin acentos
// - Caracteres especiales → espacios
// - Espacios normalizados

"Auxiliar Administrativo del Estado" → "auxiliar administrativo del estado"
"AUX ADMIN ESTADO" → "aux admin estado"
```

**`findMatchingOfficialOposicion(customName)`**
```javascript
// Busca coincidencias con oposiciones oficiales:
// - Coincidencia exacta (100%)
// - Coincidencia parcial (≥70% de palabras)

// Ejemplos que COINCIDEN:
"Auxiliar Administrativo del Estado" ✅
"Auxiliar Administrativo Estado" ✅
"AUX ADMIN ESTADO" ✅

// Ejemplos que NO coinciden:
"Auxiliar Enfermería" ❌
"Bombero" ❌
```

### 2. Flujo del Usuario

Cuando un usuario intenta crear una oposición personalizada:

```
Usuario escribe: "Auxiliar Administrativo del Estado"
         ↓
   Normalización
         ↓
Detección de duplicados (findMatchingOfficialOposicion)
         ↓
¿Coincide con oficial?
    ↙        ↘
   SÍ        NO
    ↓         ↓
Modal:     Crear
"Ya existe  nueva
oficial"
    ↓
Usuario elige:
- Usar oficial ✅
- Crear custom
```

#### Modal de Confirmación

```
⚠️ Ya existe una oposición oficial similar: "Auxiliar Administrativo del Estado"

¿Quieres usar la oposición oficial en lugar de crear una personalizada?

Recomendamos usar la oficial para acceder a todas las funcionalidades.

[Sí, usar oficial] [No, crear personalizada]
```

---

## 🧪 Testing

Se creó un script de pruebas: `scripts/test-oposicion-detection.js`

### Casos de Prueba

| Input | ¿Coincide? | Oposición Detectada |
|-------|------------|---------------------|
| "Auxiliar Administrativo del Estado" | ✅ | auxiliar_administrativo_estado |
| "auxiliar administrativo del estado" | ✅ | auxiliar_administrativo_estado |
| "Auxiliar Administrativo Estado" | ✅ | auxiliar_administrativo_estado |
| "AUX ADMIN ESTADO" | ✅ | auxiliar_administrativo_estado |
| "Policía Nacional" | ✅ | policia_nacional |
| "Policia Nacional Escala Basica" | ✅ | policia_nacional |
| "Auxiliar Enfermería" | ❌ | (no match) |
| "Bombero" | ❌ | (no match) |
| "Maestro de Primaria" | ❌ | (no match) |

**Resultado:** ✅ 9/9 tests pasaron

```bash
node scripts/test-oposicion-detection.js
```

---

## 🔧 Corrección Manual Aplicada

Para el usuario David que ya tenía el problema:

```javascript
// Script: scripts/fix-david-oposicion.js
UPDATE user_profiles
SET target_oposicion = 'auxiliar_administrativo_estado'
WHERE id = 'b375abac-c2a8-41c3-9c2b-bf937c9a5619'
  AND target_oposicion = '60798ede-09d3-49b9-ad1e-712201d2169c'
```

**Verificación posterior:**
- Se analizaron todos los 146 usuarios en la BD
- David era el ÚNICO con este problema
- ✅ Todos los demás usuarios tienen valores correctos

---

## 📊 Impacto

### Antes de la Solución
- ❌ Usuarios podían crear oposiciones oficiales duplicadas
- ❌ UUIDs en lugar de slugs → proyección no se mostraba
- ❌ Experiencia inconsistente

### Después de la Solución
- ✅ Sistema detecta automáticamente duplicados
- ✅ Sugiere usar oposición oficial
- ✅ Previene futuros casos del problema
- ✅ Proyección se muestra correctamente para todos

---

## 🔄 Archivos Modificados

1. **`components/OnboardingModal.js`**
   - Añadido `normalizeOposicionName()`
   - Añadido `findMatchingOfficialOposicion()`
   - Modificado `handleCreateCustom()` con detección

2. **`scripts/fix-david-oposicion.js`** (nuevo)
   - Script para corregir caso existente

3. **`scripts/test-oposicion-detection.js`** (nuevo)
   - Tests automatizados para la detección

4. **`docs/fixes/deteccion-oposiciones-duplicadas.md`** (nuevo)
   - Esta documentación

---

## 💡 Mejoras Futuras (Opcionales)

1. **Migración automática:** Script que detecte y corrija automáticamente todos los UUIDs existentes
2. **Sugerencias en tiempo real:** Mostrar oposiciones oficiales similares mientras el usuario escribe
3. **Analytics:** Trackear cuántas veces se detectan duplicados para mejorar UX

---

## 📝 Notas Técnicas

- La detección usa **70% de coincidencia** como umbral (ajustable)
- Soporta abreviaturas comunes (AUX, ADMIN, etc.)
- Insensible a mayúsculas, acentos, y caracteres especiales
- Prioriza coincidencias exactas sobre parciales

---

**Autor:** Claude Code
**Fecha:** 08/01/2025
**Estado:** ✅ Implementado y Testeado
