import pathlib

NOTA = """
**🟢 INSERTADO Y VIVO (08/08).** El lote está servido en producción: el tema 7 de
`auxiliar-administrativo-canarias` pasa de **30 a 45 preguntas** (comprobado contra
www.vence.es, no contra la BD). Batch `gen_canarias_t7_ley3-2026_2026-08-08`.

Pipeline completo, sin saltarse nada:
- **Paso 3** dedup: 0 colisiones. **Paso 4**: los 6 invariantes de la pregunta de prueba en verde.
  **Paso 5**: 15/15 insertadas en `draft`. **Paso 5.bis**: `verificar-batch-generado` 15/15 OK.
- **Paso 8**: transición `draft → approved` por `transition_question_state` (la única vía), con el
  resumen de auditoría en `ai_verification_results`. Evento `question_batch_approved` emitido.
- **Paso 9 (obligatorio)**: agente Sonnet **NUEVO** —ni generó el lote ni hizo el Paso 7— leyendo
  las 15 **vivas desde BD**, no del borrador. **15/15 limpio**, confianza alta. Comprobó la
  truncadura de cita por los dos lados, la coherencia cabecera↔clave y, por ser el defecto que
  devolvió esta ficha, **verificó contra fuente externa que los tres organismos usados como
  distractores existen**; y contrastó el orden de letras del art. 6.2 contra el BOE.
- **Paso 11**: las tres capas. La MV se refrescó a mano y los tags/rutas se purgaron, pero
  **producción siguió sirviendo 30 durante ~4 minutos**: la capa que faltaba era Redis
  (`topic_data:…`), que no tiene tag y **no se puede invalidar desde fuera de la VPC** —
  ElastiCache es interno. Caducó sola por su ventana de 5 min. Anotado porque el siguiente lote
  se va a encontrar lo mismo y va a parecer que el Paso 11 falló.
- **Cierre**: `npm run batch:servido` en verde (1/1 temas sirviendo lo esperado, Paso 7 y Paso 9
  registrados en las 15).

**Lo que queda, y es la mayor parte:** 7 de los 48 artículos del scope cubiertos. Faltan los
**41 restantes** (Cap. II-III del Título I), en batches sucesivos con este mismo patrón.
"""

p = pathlib.Path('/home/manuel/vence-sessions/movil3/docs/roadmap/tareas-pendientes.md')
lineas = p.read_text().split('\n')
idx = next(i for i, l in enumerate(lineas) if l.startswith('### [T-680]'))
fin = next((i for i in range(idx + 1, len(lineas)) if lineas[i].startswith('### [')), len(lineas))
ins = fin
while ins > idx and not lineas[ins - 1].strip():
    ins -= 1
lineas[ins:ins] = NOTA.rstrip('\n').split('\n')
p.write_text('\n'.join(lineas))
print('nota añadida a T-680')
