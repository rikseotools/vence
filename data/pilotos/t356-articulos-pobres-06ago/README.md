# T-356 — priorización + primera pregunta nueva (06/08/2026, w2)

Contribución PARCIAL a T-356 (204 artículos cuyo único duplicado exacto es lo único que los
mantiene con ≥4 preguntas activas). Escribir contenido verificado para 204 artículos de 84
leyes es un trabajo de varias sesiones — aquí van dos piezas completas y honestas: la
**priorización** (para que quien siga no tenga que rederivarla) y **una pregunta nueva**
para el artículo de mayor impacto, verificada de extremo a extremo.

## 1. Priorización (`articulos-protegidos-priorizados.json`, 202 artículos)

`npm run huerfanos:plan` (la herramienta que la propia ficha recomienda) usa `DATABASE_URL`
de escritura para cruzar con `user_profiles.target_oposicion` — permiso que este worker no
tiene (`vence_coordinacion`, solo las 4 tablas de coordinación). Reproducido el mismo
espíritu con lo que SÍ es legible por `VENCE_LECTOR_URL`: en vez de "usuarios reales" se
usa **nº de `topic_scope` que referencian el artículo** como proxy de alcance (a cuántos
temas de cuántas oposiciones les importa). No es lo mismo que la cifra de `huerfanos:plan`,
pero ordena en la misma dirección — un artículo citado por 86 `topic_scope` pesa mucho más
que uno citado por 1.

**⚠️ CORRECCIÓN (08/08, revisión de w4): la cifra "200 (204 el 31/07, drift normal)" estaba
mal explicada.** La lista original se generó transcribiendo A MANO la query de
`scripts/calidad/duplicados-exactos.cjs` contra `VENCE_LECTOR_URL` (en vez de correr la
herramienta canónica sobrescribiendo `DATABASE_URL`, que sí funciona). La transcripción
perdió **3 artículos genuinamente protegidos** — no era solo drift temporal, una parte del
descenso 204→200 era un hueco de la propia reproducción.

**Regenerado (08/08, w2) corriendo la herramienta real, no una transcripción:**
`DATABASE_URL="$VENCE_LECTOR_URL" node scripts/calidad/duplicados-exactos.cjs --limite 999`
(el `--limite` en el listado de críticos no existía — hardcodeaba `slice(0,8)` sin mirar el
flag, arreglado aquí para poder ver la lista completa; cambio de una línea, no toca el
cómputo) da **grupos: 217 · artículos que se quedarían por debajo de 4: 202**, estable en
sucesivas ejecuciones. `regenerar-lista.cjs` en este mismo directorio reproduce el MISMO
número (202, coincide exacto) extrayendo `SQL_GRUPOS` y usando `decidirSuperviviente` del
propio `lib/calidad/duplicados.js` — sin retipear la query. **Gotcha real que costó una
vuelta de depuración, documentado en el propio script:** extraer el texto de un template
literal por regex desde el FICHERO FUENTE da la representación cruda (`\\s+`, con DOS
backslashes) en vez del valor evaluado en tiempo de ejecución (`\s+`, uno) — un solo
carácter que cambiaba la normalización de `question_text` en Postgres lo bastante como
para perder 3 grupos completos (217→214 grupos en la primera versión del script). Arreglado
volviendo a pasar el texto extraído por `eval()` de un template literal, verificado byte a
byte contra `SQL_GRUPOS.length` real (1132).

**De paso, un falso positivo NUEVO detectado y corregido, no pedido por la revisión pero
del mismo origen (la transcripción a mano):** `Ley 19/2013 (Transparencia) art.6` (id
`47be85a2…`, `n_topic_scope=44`) estaba en la lista original como "protegido", pero sus 2
preguntas activas hoy (`c4d6f353…`, `ac95728d…`) tienen enunciados y opciones COMPLETAMENTE
distintos — no son duplicados entre sí, así que ese artículo nunca debió estar en la lista.
Verificado en BD, no solo con el script. Ya no aparece en la lista regenerada.

**202 artículos, ordenados por ese proxy. Top 6:**

| ley | artículo | topic_scope que lo referencian |
|---|---|---|
| Ley 39/2015 (LPACAP) | 49 | 86 |
| Ley 39/2015 (LPACAP) | 120 | 85 |
| RDL 5/2015 (TREBEP) | 24 | 71 |
| **Ley 40/2015 (LRJSP)** | **44** | **54** ← nuevo, uno de los 3 que faltaban en la lista original |
| Excel 365 Escritorio | 30 | 22 |
| LO 2/2007 Estatuto Autonomía Andalucía | 67 | 13 |

Los cuatro primeros son leyes troncales que escopa casi cualquier oposición de la
Administración General — mucho más impacto que un convenio internacional citado 1 vez.

## 2. Una pregunta nueva, completa y verificada: Ley 39/2015 art. 49

Elegido por ser el nº1 del ranking. El artículo tiene DOS reglas distintas:

> 1. La nulidad o anulabilidad de un acto no implicará la de los sucesivos en el
> procedimiento que sean independientes del primero.
> 2. La nulidad o anulabilidad en parte del acto administrativo no implicará la de las
> partes del mismo independientes de aquélla, salvo que la parte viciada sea de tal
> importancia que sin ella el acto administrativo no hubiera sido dictado.

**Las 4 preguntas activas de este artículo (leídas antes de escribir nada, para no
duplicar) se concentran casi todas en el apartado 1** (tres preguntas, cada una una
reformulación de la misma regla general) y **solo una toca el apartado 2**, y ninguna de
las 4 pregunta por la EXCEPCIÓN del apartado 2 (la parte viciada "de tal importancia que
sin ella el acto no hubiera sido dictado") — es el hueco real, no un hueco inventado.

`ley-39-2015-art49.json` es la pregunta nueva: pregunta por esa excepción, con explicación
estructurada (`explanation_data` v1, formato canónico — el manual manda escribir directo en
estructura, no narrar con letras) y cita literal del art. 49.2.

**Validado con `validar.ts`** (los mismos gates reales de la campaña de calidad, importados
sin reimplementar: `isStructuredExplanation`, `structuredNarrativeStaleLetters`,
`explanationReferencesLetters`, `citaNoLiteral`) **+ una comprobación propia de este lote**:
que el enunciado normalizado no coincide con NINGUNA de las 4 preguntas activas del
artículo — el motivo mismo por el que existe T-356 es no añadir otra copia. Las 5
comprobaciones en verde:

```
npx tsx --env-file=.env.local data/pilotos/t356-articulos-pobres-06ago/validar.ts
✅ pregunta nueva válida (nOptions=4), gates en verde, no duplica ninguna de las 4 activas del artículo.
```

## No aplicado

Como en las entregas anteriores de este worker: sin `DATABASE_URL` de escritura no hay
INSERT posible. Falta que alguien con permiso:
1. Inserte la pregunta de `ley-39-2015-art49.json` en `questions` (con su `explanation_data`).
2. Verifique que el artículo pasa de 4 a 5 activas, y que la guarda de
   `scripts/calidad/duplicados-exactos.cjs` deja de proteger su grupo duplicado si con eso
   ya no baja de 4 al jubilar la copia — o vuelva a proteger igual (5-1=4, sigue justo en el
   límite; haría falta una SEGUNDA pregunta nueva para dar margen real).
3. Doble auditoría antes de activar, por el manual (`docs/maintenance/generar-preguntas-con-ia.md`).

## Lo que NO se ha hecho (alcance real, sin adornar)

**199 artículos más, cada uno necesitando el mismo tratamiento** (leer sus 1-3 preguntas
existentes para no duplicar, leer el artículo, identificar el hueco real, escribir y
verificar). A ese ritmo es trabajo genuino de varias sesiones — no un checklist rápido. El
ranking de este lote es la parte reutilizable: empezar por Ley 39/2015 art. 120 (85
topic_scope) y RDL 5/2015 art. 24 (70) es la continuación natural.
