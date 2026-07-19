# Rebuild limpio: Instrucción 10/2025 SES — Procedimiento Integral de la Detención Policial

> **Estado (19/07/2026): FOUNDATION HECHA (fuente asegurada + scoping + verificación de muestra).
> Falta la fase de mutaciones (import verbatim + relink de ~75 preguntas + reactivar 18).**
> Origen: drenaje del cubo `needs_human` de mislink → el único cluster con ROI claro (19→ realmente ~75
> al ver el blast radius) es este. Decisión Manuel: **opción B (rebuild limpio)**, no parche mínimo.

## Por qué (el defecto)
Dos leyes DUPLICADAS en BD para la MISMA Instrucción, ambas **mal construidas** (de un resumen de academia,
no del texto oficial): títulos inventados, artículos con títulos-basura ("Artículo 11.1 Proc…"), nº de
artículo duplicados, **sin `boe_url`**. Sirven contenido y ocultan preguntas recuperables.
- `589645a5-1cdd-4dad-a601-00fc0fffb214` "Instrucción Detención Policial" — **75 preguntas** (20 visibles, 18 needs_human). Arts 1-13 (con duplicados/basura).
- `e52ad6a6-5b20-4133-9cc2-6ac4e3e57ca2` "Instrucción Detención Policial 2" (complementaria) — 4 preguntas (3 visibles). Arts 1,2,3,9.

## Fuente oficial ASEGURADA (verificada)
- **Instrucción NÚM. 10/2025 de la Secretaría de Estado de Seguridad**, por la que se actualiza el
  "Procedimiento Integral de la Detención Policial". **68 páginas**, documento firmado con
  **C.S.V. `GEN-f75f-9638-fb70-f3ce-6294-d0fa-66b2-d3b7`**, verificable en `https://run.gob.es/hsblF8yLcR`.
  (NO está en BOE — las Instrucciones SES no se publican en BOE; el documento oficial firmado ES la fuente.)
- PDF completo (texto extraíble, no escaneado): `https://s3.ppllstatics.com/lasprovincias/www/multimedia/2025/10/27/instruccion-detencion-policia.pdf`
- **Regenerar el texto:** `pdftotext -layout <pdf> out.txt` (da 68pp limpias; quitar líneas `INFORME DE FIRMA|DIRECCIÓN DE VALIDACIÓN|C.S.V.` y colapsar espacios).

## Estructura real (ANEXO "Procedimiento Integral de la Detención Policial")
**15 secciones numeradas + 4 apéndices** (el índice está en las pp. 6). Secciones top-level detectadas:
1-3 (previas), **4. Inmovilización, registro personal y uso de grilletes** · **5. Duración de la detención** ·
**6. Derechos de la persona detenida** · **7. Identificación y reseña** · **8. Estancia en dependencias
policiales** · **9** · **10. Particularidades (menores, extranjeros…)** · **11. Traslados** · **12** ·
**13. Otras medidas provisionales** · **14. Formación** · **15. Protección de la información y datos** ·
**Apéndices I-IV** (I libros de registro SES, II formulario información al detenido, III protocolo mujeres
gestantes, IV Protocolo Facultativo contra la Tortura).
→ Los "artículos" limpios deben ser estas 15 secciones (`article_number` = nº de sección, `title` = título
oficial, `content` = **texto verbatim** de la sección) + apéndices.

## Verificación de muestra (claves confirmadas contra el texto oficial) ✓
- **Rondas de vigilancia** (§8): "cada hora, como mínimo"; y **"al menos cada treinta minutos"** donde no hay
  cámaras o no cubren toda la celda → pregunta `05cce1c2` clave **B (30 min)** ✓.
- **Llamada del detenido** (§6): *"La llamada tendrá una duración máxima de cinco minutos"* → `12178ead` clave **A** ✓.
- **Nº de identificación profesional** del personal de custodia sobre el uniforme (§8) ✓.
- **Menores** 14-18 / <14 (§10): marco confirmado ✓.

## Plan de ejecución (fase de mutaciones — PENDIENTE)
1. **Extraer las 15 secciones + apéndices verbatim** del texto oficial (límites de sección ya localizados por línea en `norm.txt`).
2. **Rebuild de la ley:** consolidar en UNA sola ley limpia (reusar `589645a5`, poner `boe_url`=URL run.gob.es/C.S.V., `name` correcto), **crear los artículos-sección verbatim**, y **deprecar los artículos-basura** (no borrar hasta re-vincular sus preguntas).
3. **Re-vincular ~75 preguntas** (20+18 de la ley 1 + 3 de la ley 2 + las 19 del cluster) al artículo-sección correcto, **verificando cada una contra el texto** (NUNCA aplicar la sugerencia del modelo débil a ciegas; es el trabajo caro y no automatizable).
4. **Reactivar las 18 needs_human** vía `transition_question_state` con AVR nuevo (gate exige `*_ok=true`).
5. **Consolidar** la ley 2 (`e52ad6a6`) en la ley 1 y deprecarla.
6. Invalidar caché (`tag: questions`) + verificar en front.

## Herramientas dejadas
- `scripts/impugnaciones/triaje-drenaje-mislink.cjs` — triaje read-only del cubo needs_human de mislink (RESOLVABLE/import/manual).
- `scripts/impugnaciones/investiga-causa-raiz.cjs` — medidor de la campaña citas/causa-raíz (ya en main).

## Contexto del cubo mayor
Este cluster sale del **drenaje del cubo `needs_human` de mislink (348)**. El resto del cubo es **baja
recuperación** (doctrinal/academia/internacional; ~mismo perfil que el piloto ordenINT 79% retire) → NO
compensa mass-drain. Ver desglose por dominio en la sesión 19/07. Los 19 de `mislink_v1` = importar norma.
