# Oposiciones, Temas, Epígrafes y Preguntas — Índice de Manuales

Este README mapea qué manual usar según el caso de uso. Todos los manuales relacionados con oposiciones, temas, epígrafes, preguntas y convocatorias.

## 🎯 Tabla rápida: ¿qué manual usar?

| Síntoma / Caso de uso | Manual |
|-----------------------|--------|
| Usuario reporta "título no coincide con contenido" en un tema | [verificar-epigrafe-topic-scope.md](./verificar-epigrafe-topic-scope.md) |
| Usuario reporta "falta la ley X en el tema" | [verificar-epigrafe-topic-scope.md](./verificar-epigrafe-topic-scope.md) |
| Usuario reporta "respuesta incorrecta en pregunta X" | [revisar-temas-con-agente.md](./revisar-temas-con-agente.md) + [impugnaciones-claude-code.md](./impugnaciones-claude-code.md) |
| Crear una oposición nueva desde cero | [crear-nueva-oposicion.md](./crear-nueva-oposicion.md) |
| Añadir un tema a oposición existente (1 tema manual) | [agregar-tema.md](./agregar-tema.md) |
| Importar preguntas scrapeadas (OpositaTest, etc.) | [importar-preguntas-scrapeadas.md](./importar-preguntas-scrapeadas.md) |
| Verificar calidad de preguntas con IA (bulk) | [revisar-temas-con-agente.md](./revisar-temas-con-agente.md) |
| El cron de seguimiento detectó cambios en BOE/BOP | [seguimiento-cambios-convocatorias.md](./seguimiento-cambios-convocatorias.md) |
| El cron de BOE detectó cambios en una ley | [monitoreo-boe.md](./monitoreo-boe.md) |
| Caso específico: Tramitación Procesal | [importar-tema-tramitacion-procesal.md](./importar-tema-tramitacion-procesal.md) |

## 📋 Principios compartidos (se aplican a TODOS los manuales)

### 1. Fuente oficial LITERAL del boletín

Todo epígrafe, título y scope debe provenir del **boletín oficial** que publicó la convocatoria:
- **BOE** → Estado, Aux Admin Estado, Auxilio Judicial, Tramitación Procesal, Administrativo
- **BOCM** → Madrid
- **BOCYL** → Castilla y León
- **BOJA** → Andalucía
- **DOG** → Galicia
- **DOGV** → Comunitat Valenciana
- **BORM** → Región de Murcia
- **BOP Valencia** → Ayuntamiento de Valencia

**NUNCA copiar de webs de academias** (opositatest, adams, etc.). Cada oposición tiene `programa_url` apuntando al PDF oficial.

### 2. Importación desactivada hasta verificar

Preguntas y artículos se importan `is_active=false` hasta que un agente verifica su calidad. Tras verificación positiva, se reactivan automáticamente.

### 3. BD = fuente única de verdad

Desde 05/04/2026 el temario es dinámico: no hay datos hardcoded en `page.tsx`. Modificaciones al temario = SQL + `POST /api/admin/revalidate-temario`.

## 🔄 Flujos completos

### Flujo A: Crear nueva oposición de cero

```
1. crear-nueva-oposicion.md
   ↓
2. Obtener PDF oficial del boletín → guardar en programa_url
   ↓
3. Importar topics + oposicion_bloques con epígrafes LITERALES
   ↓
4. verificar-epigrafe-topic-scope.md — ajustar scope de cada tema
   ↓
5. importar-preguntas-scrapeadas.md (si tienes preguntas scrapeadas)
   ↓
6. revisar-temas-con-agente.md — validar preguntas con IA
   ↓
7. Activar oposición (is_active=true)
```

### Flujo B: Usuario reporta bug en un tema

```
1. gestionar-feedback-bug.md — identificar naturaleza del bug
   ↓
2. Si es "título no coincide": verificar-epigrafe-topic-scope.md
   ↓
3. Si es "respuesta errónea": revisar-temas-con-agente.md
   ↓
4. Aplicar fix + invalidar cache: POST /api/admin/revalidate-temario
   ↓
5. Responder al usuario
```

### Flujo C: Cambio detectado en boletín oficial

```
1. Cron detecta cambio (check-boe-changes / check-seguimiento)
   ↓
2. seguimiento-cambios-convocatorias.md — analizar qué cambió
   ↓
3. Decidir si afecta al temario (nuevos temas, cambios en epígrafes)
   ↓
4. Aplicar cambios + invalidar cache
```

## 🔗 Manuales relacionados (no-oposiciones)

- [gestionar-feedback-bug.md](../procedures/gestionar-feedback-bug.md) — Procedimiento para feedbacks de usuarios
- [investigar-journey-usuario.md](../procedures/investigar-journey-usuario.md) — Timeline interacciones usuario
- [impugnaciones-claude-code.md](./impugnaciones-claude-code.md) — Gestión de impugnaciones
- [monitoreo-boe.md](./monitoreo-boe.md) — Detección cambios en leyes

## 📝 Mantenimiento de este índice

Cuando añadas un manual nuevo relacionado con oposiciones/temas/preguntas, añádelo a este README en la tabla apropiada.
