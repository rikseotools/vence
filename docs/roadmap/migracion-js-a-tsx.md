# Migración de archivos .js a .tsx

## Contexto

Hay 4 archivos de páginas en `app/test/` que siguen en `.js` en vez de `.tsx`. Funcionan porque `tsconfig.json` tiene `allowJs: true`, pero no pasan por TypeScript strict mode y pueden acumular errores silenciosos.

## Archivos pendientes

| Archivo | Líneas | Complejidad |
|---------|--------|-------------|
| `app/test/personalizado/page.js` | 113 | Baja — pocos useState, props simples |
| `app/test/aleatorio-examen/page.js` | 529 | Alta — mapa EXAM_POSITION_MAP local duplicado, muchos useState |
| `app/test/aleatorio/page.js` | 754 | Alta — lógica compleja de fetching y state |
| `app/auxiliar-administrativo-estado/test/test-aleatorio-examen/page.js` | 462 | Alta — similar a aleatorio-examen |

## Problemas encontrados al intentar migrar

Probado con `personalizado/page.js` (el más pequeño):

1. `parseInt(searchParams.get('n'))` — `get()` returns `string | null`, `parseInt` espera `string`
2. `useState(null)` sin genérico — TypeScript infiere `useState<null>` y rechaza el setter con objetos
3. Mapas locales sin tipado (EXAM_POSITION_MAP duplicado)
4. Props de componentes sin interfaces

Cada archivo necesita 10-20 correcciones de tipos.

## Plan de migración

Orden: del más pequeño al más grande.

### Paso 1: `app/test/personalizado/page.js` (113 líneas)
- [ ] Renombrar a `.tsx`
- [ ] Tipar searchParams con `|| 'default'` en parseInt
- [ ] Tipar useState con genéricos
- [ ] Tipar oposicionConfig
- [ ] Verificar build + tests

### Paso 2: `app/auxiliar-administrativo-estado/test/test-aleatorio-examen/page.js` (462 líneas)
- [ ] Renombrar a `.tsx`
- [ ] Eliminar EXAM_POSITION_VALUES local, importar de `lib/config/exam-positions.ts`
- [ ] Tipar todos los useState
- [ ] Tipar testConfig y questions
- [ ] Verificar build + tests

### Paso 3: `app/test/aleatorio-examen/page.js` (529 líneas)
- [ ] Renombrar a `.tsx`
- [ ] Eliminar EXAM_POSITION_MAP local duplicado, importar del centralizado
- [ ] Tipar useState, config objects
- [ ] Verificar build + tests

### Paso 4: `app/test/aleatorio/page.js` (754 líneas)
- [ ] Renombrar a `.tsx`
- [ ] Tipar todo el state management
- [ ] Tipar fetching logic
- [ ] Verificar build + tests

## Mejora adicional: eliminar mapas locales duplicados

Los archivos `aleatorio-examen/page.js` y `test-aleatorio-examen/page.js` tienen copias locales de `EXAM_POSITION_MAP` que deberían importar de `lib/config/exam-positions.ts`. Al migrar a `.tsx`, aprovechar para centralizar.

## Riesgo

Medio. Los archivos funcionan correctamente como `.js`. La migración no añade funcionalidad, solo mejora la robustez del tipado. Hacerlo archivo por archivo con build + tests entre cada paso minimiza el riesgo.
