# Discrepancias de Epígrafes Pendientes

## Estado actual (22 marzo 2026)

### Oposiciones COMPLETAS y VERIFICADAS
- Auxiliar Administrativo Estado: 28/28 MATCH (BOE-A-2025-26262)
- Madrid: 21/21 MATCH (BOCM-20250513-3, corregido T13 o→y)
- Canarias: 40/40 muestras verificadas (BOC-A-2024-239-3965)
- Andalucía: 22/22 muestras verificadas (BOJA 2024/191/27)
- Galicia: 17/17 muestras verificadas (DOG 2025/11/25)
- CLM: 24/24 insertados (pendiente verificación muestra)
- Extremadura: 25/25 insertados (pendiente verificación muestra)
- Valencia: 24/24 insertados (pendiente verificación muestra)

### Tramitación Procesal - PROBLEMA ESTRUCTURAL
**Epígrafes T1-T28:** OK (verificados por muestras)
**Epígrafes T31-T37:** CORREGIDOS (estaban desplazados, ahora alinean con título)

**Problema de fondo:** Nuestros T29-T30 dividen el Registro Civil en 2 temas pero el BOE tiene 1 solo:
- Nuestro T29 "Registro Civil (I)" = BOE T29 completo
- Nuestro T30 "Registro Civil (II)" = BOE T30 (Archivo judicial) ← título incorrecto
- Nuestro T31 "Archivo judicial" = BOE T31 (Informática básica) ← título incorrecto

**El BOE real:**
- T29 = Registro Civil (un solo tema)
- T30 = Archivo judicial
- T31 = Informática básica
- T32 = Windows
- T33 = Explorador
- T34 = Word 365
- T35 = Outlook 365
- T36 = Internet
- NO hay T37 de Excel (el programa tiene 36 o 37 temas sin Excel)

**Impacto de renumerar:**
- topic_scope vinculado a topic_id (UUID, no cambia si renombramos)
- Preguntas no vinculadas directamente a topic_number
- Estadísticas de usuario sí usan topic_number
- oposiciones.ts blocks.themes[].id referencia topic_number
- URLs de tema usan topic_number

**Acción recomendada:**
1. Verificar si el BOE tiene 36 o 37 temas exactos
2. Decidir si fundir T29+T30 o renombrar T30→"Archivo judicial" y T31→"Informática básica"
3. Actualizar topic_scope, oposiciones.ts y tests

### Auxilio Judicial - VERIFICACIÓN MENOR
T6: Posible frase faltante "Sistemas de acceso a las carreras judicial y fiscal."
Necesita verificación definitiva contra el BOE antes de modificar.

### Oposiciones con discrepancias de numeración (NO tocadas)
| Oposición | BD | Programa | Problema |
|---|---|---|---|
| Administrativo Estado | 45 (1-11, 201-608) | 45 (por bloques 1-N) | Mapear numeración |
| CARM | 21 | 16 | 5 temas extra sin programa oficial |
| CyL | 28 | 28 | Verificar numeración |
| Aragón | 20 | 25+5 | Menos temas en BD |
| Asturias | 25 | 20+5 | Verificar mapeo ofimática |
| Baleares | 36 | 20 | 16 temas extra (ofimática separada) |

### Lecciones aprendidas
1. NUNCA insertar epígrafes sin verificar contra el PDF oficial
2. Verificar que el título del topic coincide con el inicio del epígrafe
3. Verificar el número total de temas antes de insertar
4. Crear test automático de alineación título↔epígrafe
