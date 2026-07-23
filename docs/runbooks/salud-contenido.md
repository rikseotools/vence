# Runbook: Salud de contenido + salud de app (detección + alertas)

> **Cuándo consultarlo:** cuando el usuario diga *"salud de contenido"*, *"qué tarjetas/datos están mal"*, *"badge de contenido"*, *"revisa las incoherencias de datos"*, cuando llegue el **email semanal de contenido** o el **email de fallos de app**, o cuando el **indicador "Salud del contenido"** de `/admin/salud-sistema` se ponga ámbar/rojo. NO confundir con `health-check.md` (salud de infra: 5xx, pool, latencia) ni con `oeps-convocatorias-seguimiento.md` (señales OEP).

## Filosofía: dos salud distintas, urgencia distinta

- **🔴 Salud de la APP (fallos):** el usuario topa con un error AHORA — endpoints caídos (landing/temario/test ≠ 200), 500/502/503, render-errors, webhook roto, tema publicado sin preguntas. **Urgente.**
- **🟡 Salud del CONTENIDO (calidad):** el dato está mal pero la app funciona — tarjetas de plazas/temas incoherentes, dual-write de convocatoria incompleto, cobertura fina de temas, timeline sin hitos. **A revisar, no urgente.**

Mezclarlas genera fatiga de alertas. Por eso van separadas en cadencia y en superficie.

## Arquitectura: computa UNA vez, léelo en 3 sitios

```
scripts/health-sweep.cjs  (EventBridge → ECS Fargate, ~05:00 Madrid)
        │  recorre TODAS las is_active: HTTP + cobertura (MV) + coherencia + observable_events(24h)
        ▼
  content_health_findings   (TRUNCATE + INSERT cada run = estado ACTUAL)
        │
        ├── 📧 email        → APP (nightly, si hay fallos) · CONTENIDO (semanal, lunes)
        ├── 🖥️ panel        → indicador "Salud del contenido" en /admin/salud-sistema
        └── 🔢 badge nav    → /api/admin/content-health devuelve `badge` (❌+🟡 de contenido)
```

**Por qué una tabla y no calcular en vivo:** el badge/panel se abren en horas de usuarios; recalcular la auditoría (canary + coherencia sobre todo el catálogo) en cada carga machacaría la BD. El sweep computa de madrugada (tráfico mínimo) y todas las superficies leen el snapshot → cero carga extra en admin.

## Piezas

| Pieza | Qué |
|---|---|
| `scripts/health-sweep.cjs` | El barrido. Autocontenido con `pg` (la imagen standalone poda postgres-js) + `fetch` builtin. App: HTTP + cobertura(MV) + observable_events. Contenido: coherencia de tarjetas + dual-write + hitos. Escribe la tabla + manda emails. |
| `content_health_findings` (tabla) | Snapshot: `category` (app/content), `severity` (error/warn), `oposicion_slug`, `kind`, `message`, `detail`, `computed_at`. |
| `GET /api/admin/content-health` | Lee la tabla → `{counts, status, badge, computedAt, stale, content[], app[]}`. Auth admin. |
| Indicador `/admin/salud-sistema` | Card "Salud del contenido" (semáforo + lista). |
| Schedule `vence-health-digest` | EventBridge Scheduler → ECS, cron ~05:00 Madrid. |

## Cómo se ejecuta

- **Automático:** el schedule de AWS lo lanza cada madrugada. No lo lanzas tú.
- **A mano (probar/forzar):**
  ```bash
  DATABASE_URL=... RESEND_API_KEY=... node scripts/health-sweep.cjs        # real: escribe tabla + emails
  DRY_RUN=1 DATABASE_URL=... node scripts/health-sweep.cjs                  # escribe tabla, imprime emails, no envía
  DRY_RUN=1 FORCE_CONTENT_EMAIL=1 ...                                       # fuerza el email de contenido (sin ser lunes)
  NO_WRITE=1 ...                                                            # no toca la tabla (solo email)
  ```
- **Las herramientas CLI sueltas** (a demanda, para investigar): `npm run canary:oposiciones` (app) y `npm run audit:coherencia` (contenido). El sweep usa la misma lógica pero automática y persistida.

## Cuándo salta el email

- **App:** SIEMPRE que haya un fallo (la noche que sea). Silencio si verde.
- **Contenido:** solo los **lunes** (resumen semanal), porque el contenido cambia despacio y a diario spamearía. El badge/panel lo ven a diario.

## Qué hacer cuando algo está rojo

1. **App rojo** (endpoint caído, 5xx, tema vacío): es un bug. Investiga el endpoint/oposición. Los render-errors suelen traer la causa pg si el `catch` la loguea (ver instrumentación de `/api/v2/admin/validation-errors`).
2. **Contenido rojo** (tarjeta de plazas/temas incoherente, no_hitos):
   - **Tarjetas de plazas:** casi siempre la tarjeta muestra el **total de la OEP con reservas** en vez de las plazas reales de la convocatoria (militares, otras categorías…). **Verifica contra el boletín oficial** (`programa_url`/`boe_reference`) qué plazas se presenta un opositor de ESA categoría y corrige la tarjeta (o la convocatoria si es la que está mal). NUNCA inventar — ver §6g de `crear-nueva-oposicion.md`.
   - **`no_hitos`:** la convocatoria está con inscripción abierta sin timeline → poblar `convocatoria_hitos` con las fechas oficiales.
   - **`temas_card`:** usar `{temasCount}` para que se auto-resuelva.
3. **Contenido ámbar** (dual-write, cobertura fina): no urgente. Dual-write = completar los campos NULL de la fila `convocatorias`. Cobertura fina = generar más preguntas (§ generar-preguntas-con-ia.md).
4. **`audit_note_explanation`** (*"revisa las explicaciones rotas"*): preguntas visibles cuya `explanation` es en realidad la **crítica de un pase IA anterior** guardada por error (*"La explicación debería…"*, *"posible errata"*, *"Nota técnica:"*, *"Esta pregunta debería anularse"*) — defecto de pipeline (se remediaron ~46 el 10/07). Para cada una: **verificar la clave contra la ley/fuente** (leer otros artículos si hace falta) → si la clave es correcta, **reescribir la explicación** didáctica (cita literal + análisis A/B/C/D); si hay defecto de fondo (clave/artículo/opciones), **`needs_human`**. NUNCA auto-flip de clave. Flujo con agentes: `docs/maintenance/revisar-preguntas-con-agente.md` (generar/reparar → auditoría ciega → aplicar). Memoria `project_explicaciones_nota_auditoria`.
5. **`visual_deixis_no_image`** (*"revisa las preguntas sin imagen"*): preguntas activas cuyo enunciado **apunta a un icono/símbolo/imagen que no está almacenado** (*"¿qué significado tiene el siguiente icono?"*, *"el siguiente símbolo advierte de…"*, *"observa la siguiente figura"*, *"de las restas de la imagen, indica…"*) con `image_url` NULL y `content_data` vacío → **irresoluble**: el estudiante ve las opciones pero no el gráfico. Punto ciego que ningún otro detector veía (coherencia enunciado↔imagen) y que el re-verificador LLM puede dar por bueno porque solo mira el texto. Para cada una: **(a)** si el enunciado o las opciones ya describen el visual en palabras (p. ej. *"El icono muestra dos documentos superpuestos…"*, o los glifos van en las opciones) → **autocontenida, dejar**; **(b)** si necesita la imagen y hay **fuente oficial** recuperable → reconstruir la imagen y re-vincular; **(c)** si no hay fuente (típico en IA no-oficial) → **jubilar** con `transition_question_state(..., 'admin_image_unavailable', 'retired_irreparable', ...)` + invalidar caché `questions`. NUNCA inventar la imagen ni fijar una clave a ciegas. Caso raíz 22/07 (usuaria Concha, impugnación `7119bd5d`): icono de Outlook marcado `needs_human` 2× por *"requiere imagen no disponible"* y re-aprobado el 10/07 como falso positivo → visible y roto hasta que lo impugnó; barrido posterior jubiló 4 más.

## GOTCHAS

- **PDF escaneado que WebFetch/agente no leen** (p. ej. BOPA): WebFetch lo guarda a fichero → `pdftotext -layout <fichero>` extrae el texto (así se cerró el desglose de asturias, 10/07).
- **Alias en mayúscula:** pg pasa `SELECT plazas_libres L` a `row.l` (minúscula) — leer `row.plazas_libres`, no `row.L`.
- **La imagen ECS poda postgres-js** → el sweep usa `pg` (node-postgres), presente en la imagen. NO usar `postgres`/postgres-js en scripts que corran en la imagen.
- **Reusar la imagen del frontend** para el sweep acopla: cambiar el script exige re-deploy del frontend.

Detalle de diseño y de las 3 capas de detección: memoria `project_deteccion_oposiciones_3capas`.
