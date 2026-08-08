# T-465 — resolución de las 2 preguntas en `needs_human` (08/08)

Ninguna de las dos acciones se ha aplicado: mi credencial (`VENCE_LECTOR_URL`) es de solo lectura.
Ambas están verificadas contra la fuente oficial (no contra lo que decía la ficha) y listas para
que alguien con escritura las aplique.

## 1) `8b5d00f1-b8ba-4e45-becb-6030c35d0056` — RETIRAR

**Pregunta:** "La persona titular de la Gerencia de una área sanitaria es nombrada:" (correcta: D,
"Por orden de la persona titular de la Consellería de Sanidad"), colgada del art. 68 de la Ley
8/2008 de salud de Galicia — que solo define qué son las áreas sanitarias y su demarcación, no
habla de nombramientos.

**Comprobado:** el único artículo de la Ley 8/2008 que cruza "gerencia" + "nombramiento" es el
121.7, y es una cláusula de REMISIÓN genérica ("la designación... será realizada por el órgano
competente en conformidad con la legislación vigente"), no nombra a la Consellería de Sanidad.
Revisado el banco completo: no existe ningún decreto de estructura orgánica del SERGAS ni de
áreas sanitarias de Galicia importado (`personal-estatutario-sergas-galicia` es un resumen de
estudio de una sola fila, no un texto articulado, y tampoco lo cubre). La norma que de verdad
atribuye el nombramiento (previsiblemente un decreto de estructura orgánica del SERGAS) no está
en nuestro banco — no se puede importar dentro del alcance de esta ficha (esfuerzo "rato").

**SQL a aplicar:**
```sql
SELECT public.transition_question_state(
  '8b5d00f1-b8ba-4e45-becb-6030c35d0056'::uuid,
  'needs_human',
  'retired_irreparable',
  'admin_content_not_in_law',
  NULL, NULL,
  'T-465: el unico articulo de la Ley 8/2008 (Galicia) que cruza gerencia+nombramiento es el 121.7, '
  || 'clausula de remision generica ("el organo competente...") que NO nombra a la Conselleria de '
  || 'Sanidad. Revisado el banco: no hay decreto de estructura organica del SERGAS/areas sanitarias '
  || 'importado que lo atribuya. La norma que de verdad lo dice no esta en el banco.'
);
```

## 2) `eab05295-5b08-45ef-8924-acf0399cd57a` — RESTAURAR a `approved` (la clave es correcta)

**Pregunta:** "¿Cuál de las siguientes es una competencia de la Consejería de Sanidad, Presidencia
y Emergencias?" (correcta: C, "La dirección, edición y publicación del Boletín Oficial de la Junta
de Andalucía en su sede electrónica"), colgada del art. 1 del Decreto 168/2025.

**El hallazgo de la sesión anterior era correcto en el diagnóstico pero la conclusión estaba a
medio camino:** nuestra copia del art. 1 (`articles.content`) es un RESUMEN parafraseado de 370
caracteres ("Atribuye a esta Consejería competencias en..."), no el texto literal — así que en
efecto "no se puede juzgar contra ella". Pero la pista que quedaba (*"traer el articulado real del
BOJA antes de decidir"*) SÍ se pudo completar en esta sesión.

**Verificado contra la fuente oficial** (BOJA Extraordinario nº 13/2025, `Decreto 168/2025, de 5 de
noviembre`, https://www.juntadeandalucia.es/boja/2025/513/1 — OJO: el `boe_url` guardado en
nuestra tabla `laws` para esta norma es OTRO documento distinto, una Orden sobre incendios
forestales; hallazgo aparte, ver abajo). Fetch RAW (no resumen de LLM, por la lección de T-679) del
HTML servido, texto del art. 1 apartado k):

> k) La dirección, edición y publicación del Boletín Oficial de la Junta de Andalucía en su sede
> electrónica, así como la coordinación de las actuaciones de la Administración Pública de la
> Junta de Andalucía con respecto a publicaciones en otros diarios oficiales.

**Coincide LITERAL con la opción correcta** (C). La pregunta está bien; lo que estaba mal es
nuestro `articles.content`, que es un resumen y no el texto legal.

**Verbatim del artículo 1 completo**, extraído y formateado (ver
`scratchpad/t465/decreto168-2025-articulo1-verbatim.txt`), listo para reemplazar el resumen:

```sql
UPDATE articles
   SET content = <contenido de decreto168-2025-articulo1-verbatim.txt>
 WHERE law_id = 'acec8243-5d54-4741-b27a-09ea6a02ee00' AND article_number = '1';

SELECT public.transition_question_state(
  'eab05295-5b08-45ef-8924-acf0399cd57a'::uuid,
  'needs_human',
  'approved',
  'admin_marked_perfect',
  NULL, NULL,
  'T-465: verificado contra el BOJA Extraordinario 13/2025 (fetch RAW, no resumen de LLM) -- el '
  || 'art.1.k) del Decreto 168/2025 dice literalmente "La direccion, edicion y publicacion del '
  || 'Boletin Oficial de la Junta de Andalucia en su sede electronica", exacto a la opcion C. La '
  || 'clave es correcta; lo que fallaba era que articles.content es un resumen parafraseado (370 '
  || 'caracteres) y no el texto legal. Re-importado el articulo 1 verbatim antes de esta transicion.'
);
```

**Verificar el otro art.1 activo tras aplicar** (`9bd877f4-6b2a-436c-aa65-8bb46f671573`, sobre
"confesiones religiosas") — también confirmado contra el mismo fetch (apartado s), pero no
necesita transición porque ya está `approved`; solo se beneficia de que el artículo deje de ser un
resumen.

## 3) Hallazgo NUEVO, medido pero fuera del alcance de esta ficha (no resuelto aquí)

**El Decreto 168/2025 entero (21 artículos, `law_id=acec8243-5d54-4741-b27a-09ea6a02ee00`) está
importado como resúmenes parafraseados, no texto literal.** Medido: los 21 artículos miden entre
215 y 386 caracteres cada uno — un artículo real de "Competencias" con apartados a) a t) (como el
1, verificado) mide ~4.650. Cuelgan **8 preguntas** de esos 21 artículos (7 activas + la
`eab05295` de arriba). Muestreadas 5 de las 6 activas del art. 2 contra el texto real (también
extraído, ver abajo): **las 5 tienen clave correcta** (Viceconsejería de Sanidad y Consumo →
Dirección General de Consumo; adscripciones del Instituto de Salud de Andalucía y el SAS a la
Viceconsejería; Centro de Estudios Andaluces a la Consejería) — el patrón se repite: resumen malo,
clave buena. La sexta (`20c697b1`, sobre departamentos internos del SAS) **no encaja con el texto
del art. 2** que sí tengo (que habla de la estructura de la Consejería, no de la del SAS) — puede
estar colgada del artículo equivocado (el SAS tiene su propia estructura en otro punto del
decreto) o necesitar un artículo posterior del mismo decreto que no comprobé.

**Por qué no lo resuelvo aquí:** son 20 artículos más por re-importar (con la disciplina de
literalidad y doble verificación que exige el manual), y esta ficha declaraba esfuerzo "rato" para
LOS DOS `needs_human` pendientes, no para re-importar un decreto entero. Queda anotado con cifras
para quien lo retome — no hace falta re-descubrirlo.

**Hallazgo aparte, menor:** `laws.boe_url` para este decreto apunta a
`https://www.juntadeandalucia.es/boja/2025/511/2` (una Orden de octubre/2025 sobre peligrosidad de
incendios forestales, verificado con WebFetch — NO es el Decreto 168/2025). La URL correcta es
`https://www.juntadeandalucia.es/boja/2025/513/1` (BOJA Extraordinario nº 13/2025). Vale la pena
corregirlo junto con el re-import del resto de artículos, para que el botón "ver fuente" no lleve
a un documento equivocado.

## Artículo 2 verbatim (para cuando se aborde el resto del decreto)

Extraído del mismo fetch, sin reformatear en apartados (estructura más compleja, con listas
anidadas a)/b) y numeración 1-15) — dejado en bruto para que quien lo aborde lo formatee según
convención al re-importarlo:

Ver `scratchpad/t465/decreto168-2025-articulo2-raw.txt`.
