# Adjudicación — 8 casos críticos de T-291 (30/07/2026)

> **✅ CERRADO el 30/07 — adjudicado y APLICADO.** Las dos pasadas de abajo (verificación + auditoría
> ciega) son la materia prima; esta sección es el veredicto, resuelto mirando las imágenes de opción
> una a una y cruzando cada afirmación de interfaz contra fuente.
>
> **Y al tirar del hilo apareció que el problema no eran 8 preguntas.** Dos de los ocho «defectos» lo
> eran del TEMARIO, y ese error resultó **sistémico**: los contenedores de Word llevaban el set de
> atajos **inglés** para notas al pie/al final. Barrido completo: **6 artículos y 8 preguntas más**
> reparados, 1 retirada. Detalle en [T-302]; el hecho fijado, en la memoria
> `project-informatica-atajos-es-vs-en`.

| pregunta | veredicto de la 3.ª pasada | acción propuesta |
|---|---|---|
| `55c6e0c9` | **clave mal** — C es el icono `fx` (Fórmulas); Valores es el `123` | clave C → **A** + volver a visible |
| `d0614236` | **clave mal** — C es `123`+brocha (*valores y formato de origen*); Formato es el de líneas+brocha | clave C → **D** + volver a visible |
| `d94d07d9` | **clave mal** — en Word **2016** la pestaña es *Presentación*; *Disposición* es de Word 365 | clave B → **C** + volver a visible |
| `a7ab2b0c` | **clave BIEN** — el botón sí se llama «Modificar» en el Excel español | volver a visible + corregir el contenedor (T-302) |
| `6f8d7590` | **sin defecto** — `Alt+Ctrl+O` **sí** es nota al pie en el Word español | ninguna + corregir la nota del contenedor (T-302) |
| `aad17666` | **sin defecto** — `Ctrl+Mayús+V` hoy pega valores, luego solo C es inválida | ninguna |
| `f1eadf63` | **defecto NUESTRO en el enunciado**, no en las opciones | restaurar el ejemplo del anexo (Burgos→BU) |
| `1bf7cd05` | **clave mal** (D es falsa), pero **A y B son ambas negativas** → pregunta mal construida | decisión de Manuel (abajo) |

## Cómo se resolvió cada uno

**Los dos de iconos (`55c6e0c9`, `d0614236`).** Descargadas y ampliadas ×6 las 8 imágenes de opción.
En la de **valores**: A=`123`, B=portapapeles+documento, **C (clave)=`fx`**, D=`%`+brocha → la clave
marca *Fórmulas* donde se pide *Valores* ⇒ correcta **A**. En la de **formato**: A=`fx`, B=`%`+brocha,
**C (clave)=`123`+brocha** (*valores y formato de origen*, que sí pega el dato), D=portapapeles con
líneas formateadas y brocha, **sin indicador de tipo de dato** = el icono real de *Formato* ⇒ correcta
**D**. Los dos iconos se reutilizan entre ambas preguntas de forma consistente, lo que cierra la lectura.

**`d94d07d9` (Word 2016, Autoajustar).** aulaClic Word 2016 y el propio contenedor coinciden: las
pestañas de Herramientas de tabla en Word 2016 son *Diseño* y **Presentación**, y *Autoajustar* vive en
**Presentación > grupo Tamaño de celda**. *Disposición* es el renombrado de Word 365/2019. El enunciado
fija «En Word 2016» ⇒ correcta **C**. La explicación actual afirma justo lo contrario.

**`a7ab2b0c` (macro de Excel).** El cuadro *Ver macros* del Excel **español** tiene el botón
**«Modificar»** (automateexcel es). La clave C era correcta desde el principio; **lo que está mal es
nuestro contenedor**, que afirma que ese botón no existe y que se llama «Editar». La pregunta se retiró
por un error de nuestra propia fuente.

**`6f8d7590` (nota al pie).** ⚠️ **Falso positivo de las dos pasadas, por la trampa de traducción que
ya está documentada.** La página `es-es` de Microsoft reproduce los atajos **ingleses**. El set español
está desplazado en bloque por iniciales: `Alt+Ctrl+E` = vista **E**squema (inglés: Ctrl+Alt+O,
**O**utline) y `Alt+Ctrl+D` = vista **D**iseño de impresión (inglés: Ctrl+Alt+P), lo que libera la `O`
⇒ **`Alt+Ctrl+O` = insertar nota al pie**. Confirmado en dos listados españoles independientes
(epapontevedra, academiacartablanca) coherentes entre sí, y en el hilo de MS Q&A donde WordExperto
recuerda que la página oficial es una traducción del inglés. **La clave C es correcta.**

**`aad17666` (pegar solo valores).** La duda era si la opción D (`Mayús+Ctrl+V`) también sería inválida,
lo que daría dos respuestas. Microsoft incorporó `Ctrl+Mayús+V` como pegado de valores real en Excel
365, así que **hoy D es un método válido** y la única opción inválida sigue siendo C («Pegar sin
fórmulas» no existe como botón). **Sin defecto.**

**`f1eadf63` (fórmulas de iniciales).** Abierta la imagen del anexo: la tabla real es
*Provincia / Inicial*, con **B23 = «Burgos»** y **C23 = «BU»**. Nuestro enunciado dice en cambio
«un nombre completo (por ejemplo, "Manuel García")». Ese ejemplo lo pusimos nosotros y **contradice a
su propia imagen** — y es lo que crea la ambigüedad: con 13 caracteres,
`REEMPLAZAR(B23;1;10;…)` deja «MAcía», así que la opción B tampoco daría el resultado y habría dos
respuestas válidas. Con «Burgos» (6 caracteres) B sí devuelve «BU» y **solo D falla**, por error de
sintaxis (`MAYUSC` no admite tres argumentos). **La clave D es correcta; el defecto es el ejemplo
inventado en el enunciado.**

**`1bf7cd05` (termómetro timpánico).** El manual clínico del H. Virgen del Rocío dice literalmente
«Evitar realizar la medición de la temperatura timpánica en pacientes con infecciones agudas de oído,
tubo de drenaje timpánico o tapones de cerumen voluminosos», así que la clave actual («Sí, es
correcto») es **falsa**. Pero **A** («No es correcto dado el estado del paciente») y **B** («No se debe
poner… ya que alteraría la temperatura») son **las dos negativas y las dos defendibles**: B es la
respuesta canónica de los bancos TCAE porque da el motivo, pero A no es falsa. Es una pregunta mal
construida, no solo mal clavada. No es de examen oficial y vive en un contenedor de los que T-302
bloquea, con 5 apariciones. **Decisión de Manuel:** (a) clave → B y reescribir A como distractor claro,
o (b) dejarla retirada hasta que T-302 enriquezca el contenedor.

---

## Anexo — las dos pasadas originales

Preguntas donde la revisión detectó un posible defecto de **CLAVE** o de **OPCIONES**. Cada una pasó
por **dos pasadas independientes**: la verificación del lote y una **auditoría ciega** (otro agente,
sin ver el veredicto anterior, resolviendo la pregunta desde la fuente antes de mirar qué clave
estaba marcada).

**Ninguna clave se ha modificado.** Las 5 con defecto probable o con discrepancia están retiradas de
circulación (`lifecycle_state = needs_human`) para no seguir sirviendo una respuesta dudosa. Es
reversible: una transición a `approved` / `tech_approved` las devuelve a los tests.

| pregunta | verificación | auditoría ciega | estado |
|---|---|---|---|
| `1bf7cd05` | defecto_clave → A (media) | B · clave actual MAL (alta) | coinciden en el defecto, DISTINTA clave → retirada |
| `55c6e0c9` | defecto_clave → A (alta) | A · clave actual MAL (alta) | coinciden → retirada |
| `6f8d7590` | defecto_opciones (alta) | C · clave actual OK (baja) | opciones → sigue visible |
| `a7ab2b0c` | defecto_clave → D (alta) | C · clave actual OK (alta) | DISCREPAN → retirada |
| `aad17666` | defecto_opciones (alta) | C · clave actual OK (alta) | opciones → sigue visible |
| `d0614236` | defecto_clave → D (alta) | D · clave actual MAL (media) | coinciden → retirada |
| `d94d07d9` | defecto_clave → C (alta) | C · clave actual MAL (alta) | coinciden → retirada |
| `f1eadf63` | defecto_opciones (alta) | D · clave actual OK (media) | opciones → sigue visible |

## `1bf7cd05-9c9a-455a-9d8c-f3a73cdb0b6a`

- 🟡 **Las dos coinciden en que la clave está mal, pero proponen claves distintas** — hace falta decidir cuál
- **Verificación del lote:** defecto_clave → propone clave A · confianza media
  - Fuentes externas (manual clínico H. Virgen del Rocío, Preevid Murciasalud) indican que el termómetro timpánico DEBE EVITARSE en pacientes con otitis, tubo de drenaje o cerumen voluminoso. La clave actual ('Sí, es correcto') contradice esa doctrina. El art. 2 vinculado tampoco cubre el supuesto. Dudo entre las dos opciones que niegan su uso; la más genérica y defendible parece la correcta, pero declaro confianza media.
- **Auditoría ciega:** resuelve **B** · NO coincide con la clave actual · confianza alta
  - Resolví primero desde la clínica: la toma de temperatura timpánica está contraindicada/no debe realizarse en presencia de otitis (otitis aguda, tubo de drenaje timpánico o tapón de cerumen voluminoso), porque la inflamación local del oído falsea/altera la lectura respecto a la temperatura central. Confirmado en el manual clínico del H. Virgen del Rocío ('Evitar realizar la medición de la temperatura timpánica en pacientes con infecciones agudas de oído, tubo de drenaje timpánico o tapones de cerumen voluminosos') y en guías de buenas prácticas de termómetros de oído. Además localicé que este enunciado exacto ('¿Es correcto poner el termómetro timpánico en presencia de otitis, para medir la temperatura?') es un ítem de banco de test TCAE conocido cuya respuesta marcada es 'No se debe poner el termómetro en esas condiciones, ya que alteraría la temperatura' (opción B), no 'Sí, es correcto'. El artículo interno del tema no menciona la contraindicación por otitis (solo lista las localizaciones), así que la clave actual (D) no está respaldada por ninguna fuente y contradice la práctica estándar. Confianza alta porque múltiples fuentes clínicas independientes coinciden en la contraindicación y en la razón (altera la lectura).
  - fuente: https://manualclinico.hospitaluvrocio.es/procedimientos-generales-de-enfermeria/medicion-de-constantes-vitales/medicion-de-la-temperatura-corporal/ ; https://testenfermeria.es/auxiliar-simulacro-2/ ; guía de buenas prácticas termómetros de oído (CEM)
- **Literalidad de la opción marcada:** ❌ no reproduce la fuente

## `55c6e0c9-a0b9-4060-9a97-df4ca58e5a47`

- ✅ **Las dos pasadas coinciden en que la clave está mal, y en cuál debería ser**
- **Verificación del lote:** defecto_clave → propone clave A · confianza alta
  - Las 4 opciones son imágenes de iconos de pegado; descargadas y verificadas: la marcada muestra el icono 'fx' (Fórmulas), no '123' (Valores). El icono de Valores está entre las otras opciones. Contrastado con la sección Pegado especial del artículo y con la nomenclatura estándar de Microsoft.
- **Auditoría ciega:** resuelve **A** · NO coincide con la clave actual · confianza alta
  - Descargué y visualicé las 4 imágenes de opciones. A = icono de portapapeles con '123' (icono estándar de Excel para 'Valores'/pegar solo valores, tal como describe el propio artículo de referencia: 'icono 123 / opción Valores'). B = portapapeles liso, sin símbolo (Pegar completo/Todo). C = portapapeles con 'fx' (Fórmulas). D = portapapeles con '%' y brocha (Formato). La clave marcada actualmente es el índice 2 = C = el icono 'fx' (Fórmulas), que no corresponde en absoluto a 'pegar solo valores'. La correcta según el estándar de Excel (y el propio artículo que documenta la tabla de iconos de pegado especial) es A (123).
  - fuente: artículo vinculado (tabla 'Resumen de opciones de pegado': icono 123 = Valores, icono fx = Fórmulas) + comparación visual directa de las 4 imágenes descargadas
- **Literalidad de la opción marcada:** ❌ no reproduce la fuente

## `6f8d7590-fcfc-4c4b-b853-e6c910248846`

- ℹ️ Defecto de **opciones** (la clave no se cuestiona)
- **Verificación del lote:** defecto_opciones · confianza alta
  - Verificado en Microsoft Support (es-es, accesibilidad): "Insertar una nota al pie" = Ctrl+Alt+F; Ctrl+Alt+O corresponde a "Cambiar a la vista Esquema", no a notas al pie. La opción marcada atribuye un atajo real a una acción que no realiza. Ninguna otra opción describe correctamente insertar una nueva nota al pie.
- **Auditoría ciega:** resuelve **C** · coincide con la clave actual · confianza baja
  - Por descarte, C es la única opción que describe un mecanismo plausible para insertar un número de nota al pie (las otras tres son rutas claramente erróneas: A es para citas bibliográficas con marcador de posición, B es para pie de página -no nota al pie-, D es para referenciar un elemento numerado YA existente, no para crear la marca numerada). Sin embargo, verifiqué el atajo exacto contra la documentación oficial de Microsoft en español (support.microsoft.com/es-es, página de métodos abreviados de Word) y el atajo real para 'Insertar nota al pie' es Ctrl+Alt+F, no Alt+Ctrl+O como dice la opción C; Ctrl+Alt+D es para nota al final. Es decir: pulsar literalmente Alt+Ctrl+O en Word 365 NO inserta una nota al pie según la fuente oficial vigente, así que el enunciado de la opción marcada como correcta no es literalmente cierto. El propio artículo interno ya señala esta discrepancia como un error conocido heredado de versiones del examen oficial de Castilla y León. No tengo forma de confirmar si la plantilla original del examen (papel) usó realmente 'O' por error tipográfico propio o si el error es de nuestra digitalización, así que mantengo confianza baja y NO propongo tocar la clave: entre las 4 alternativas dadas, C sigue siendo, con diferencia, la menos incorrecta.
  - fuente: https://support.microsoft.com/es-es/office/m%C3%A9todos-abreviados-de-teclado-de-word-95ef89dd-7142-4b50-afb2-f762f663ceb2 (Ctrl+Alt+F = nota al pie, Ctrl+Alt+D = nota al final); artículo vinculado (nota interna sobre la discrepancia Alt+Ctrl+O vs Alt+Ctrl+F)
- **Literalidad de la opción marcada:** ❌ no reproduce la fuente

## `a7ab2b0c-f3f6-4167-bdff-1fc6109c305f`

- ⚠️ **Discrepan**: la auditoría defiende la clave actual
- **Verificación del lote:** defecto_clave → propone clave D · confianza alta
  - El propio artículo advierte que el botón 'Modificar' NO existe en el cuadro Ver macros de Excel y que el botón correcto es 'Editar'. La clave marcada usa la ruta con 'Modificar'; la opción con la misma ruta pero 'Editar' es la correcta.
- **Auditoría ciega:** resuelve **C** · coincide con la clave actual · confianza alta
  - Resolví desde cero: para editar el código de una macro en Excel se va a Vista → Macros → Ver macros, y en el cuadro de diálogo se selecciona la macro. Verifiqué el nombre EXACTO del botón en la interfaz en español mediante varias fuentes independientes (internetpasoapaso.com, automateexcel.com/es, e-iceblue.com): todas coinciden en que el botón se llama 'Modificar' (no 'Editar') y que abre el Editor de Visual Basic. Esto confirma la opción C ('VISTA > Macros > Ver macros > Modificar') como correcta, y contradice justo lo que afirma el propio artículo interno vinculado (que dice que 'Modificar' no existe y que el botón correcto es 'Editar' — ese texto del artículo está equivocado). B falla porque la pestaña 'Datos' no tiene grupo Macros; A falla porque el atajo real para abrir 'Ver macros' es Alt+F8, no Ctrl+F8; D acierta la ruta pero se equivoca en el nombre del botón ('Editar' en vez de 'Modificar').
  - fuente: https://internetpasoapaso.com/editar-eliminar-macro-excel/ ; https://www.automateexcel.com/es/macros/modificacion-de-macros-vba-excel/ (confirman el botón 'Modificar' en la UI en español de Excel)
- **Literalidad de la opción marcada:** sin objeción

## `aad17666-058c-43ce-ba85-2aafac81b3ac`

- ℹ️ Defecto de **opciones** (la clave no se cuestiona)
- **Verificación del lote:** defecto_opciones · confianza alta
  - El contenedor confirma que 'Pegar sin fórmulas' no existe (opción marcada, correcta) PERO también dice explícitamente que Mayús+Ctrl+V NO abre el pegado especial en Excel (es Ctrl+Alt+V, confirmado también externamente). La opción D, presentada implícitamente como método válido, es también falsa.
- **Auditoría ciega:** resuelve **C** · coincide con la clave actual · confianza alta
  - La pregunta pide la opción que NO es un método válido para pegar solo valores. A (clic derecho > Valores) y B (Inicio > desplegable Pegar > tecla V) son métodos reales y documentados. C afirma que existe un botón llamado 'Pegar sin fórmulas' en Inicio > Portapapeles: ese nombre de botón no existe en Excel; el nombre real es siempre 'Valores'. D (Mayús+Ctrl+V) verifiqué que, aunque tradicionalmente no era un atajo nativo de Excel, Microsoft lo introdujo como atajo real de 'Pegar valores' en Excel 365 (desplegado a Insiders a mediados de 2024 y a la mayoría de suscriptores a comienzos de 2025), por lo que en la versión vigente HOY sí es un método válido. Esto refuerza que C sigue siendo la única opción inválida.
  - fuente: https://office-watch.com/2023/excel-paste-values-keyboard-shortcut/ (rollout de Ctrl+Shift+V como atajo real de pegar valores en Excel 365); documentación de Excel sobre nomenclatura de botones de Pegado especial ('Valores', no 'Pegar sin fórmulas')
- **Literalidad de la opción marcada:** sin objeción

## `d0614236-a02c-42f8-9ad7-03b7dcfb74b7`

- ✅ **Las dos pasadas coinciden en que la clave está mal, y en cuál debería ser**
- **Verificación del lote:** defecto_clave → propone clave D · confianza alta
  - Las 4 opciones son imágenes de iconos de pegado; descargadas y verificadas: la marcada combina brocha+123 (pega también valores, no 'solo formato'). El icono de brocha sola (Formato, tal como lo describe el artículo) es otra de las opciones.
- **Auditoría ciega:** resuelve **D** · NO coincide con la clave actual · confianza media
  - Descargué y amplié las 4 imágenes. A = portapapeles + 'fx' (Fórmulas). B = portapapeles + '%' con brocha. C (clave actual) = portapapeles + '123' con brocha. D = portapapeles + líneas de texto genérico con brocha. En la pregunta gemela de este mismo examen (pegar SOLO VALORES, question_id 55c6e0c9) confirmé visualmente que el icono '123' SIN brocha es el que Excel usa para 'Valores' puro; por tanto '123 + brocha' (opción C aquí) representa la combinación 'Valores y formato de origen', que SÍ modifica el contenido de la celda (pega el valor de origen), no 'solo formato' como pide el enunciado. El icono real de Excel para 'Formato' (Formatting, la única opción que trae 'solo el formato y ninguno de los datos') no lleva ningún indicador de tipo de dato (ni 123, ni fx, ni %); de las 4 imágenes, D es la que más se ajusta a esa idea (contenido genérico + brocha, sin indicador numérico específico), coincidiendo además con la propia descripción del artículo vinculado ('Pega únicamente el formato de las celdas copiadas: colores, bordes, tipo de letra'). No pude contrastar pixel a pixel contra una captura oficial de Microsoft con nombres visibles, así que dejo la confianza en media: creo que la clave actual (C) confunde 'formato' con 'valores y formato de origen', pero reconozco margen de error en la lectura de iconos custom.
  - fuente: comparación visual de las 4 imágenes descargadas + icono '123' sin brocha = Valores (confirmado en la pregunta gemela 55c6e0c9) + descripción del artículo vinculado sobre 'Pegar solo formato'
- **Literalidad de la opción marcada:** ❌ no reproduce la fuente

## `d94d07d9-53b5-4d5f-b597-d3ac11f455aa`

- ✅ **Las dos pasadas coinciden en que la clave está mal, y en cuál debería ser**
- **Verificación del lote:** defecto_clave → propone clave C · confianza alta
  - El propio art.3 dice 'Pestañas contextuales: Diseño y Presentación', no 'Disposición'. Verificado con fuentes externas: en Word 2016 el grupo Tamaño de celda con Autoajustar vive en la pestaña Presentación de Herramientas de Tabla; 'Disposición' es nomenclatura de Word 365 posterior.
- **Auditoría ciega:** resuelve **C** · NO coincide con la clave actual · confianza alta
  - La pregunta especifica explícitamente 'Word 2016' (no 365). En Word 2016, la pestaña contextual de 'Herramientas de tabla' que contiene el grupo 'Tamaño de celda' con la opción 'Autoajustar' se llama 'Presentación' (junto con 'Diseño'). El renombrado de esa pestaña a 'Disposición' es posterior (Word 365/2019+). Esto lo confirman fuentes externas (curso Word 2016 de aulaClic, hilos de Microsoft Q&A sobre el cambio de nombre 'Presentación'→'Disposición') Y, de forma decisiva, el propio artículo interno vinculado a esta pregunta (el contenedor 'Word 2016' de nuestra base), que dice literalmente: 'Pestañas contextuales: Diseño y Presentación ... Presentación: insertar/eliminar filas y columnas, combinar/dividir celdas, alineación, ordenar, fórmulas'. La explicación actual de la clave (B) afirma justo lo contrario ('en Word 2016 en español la pestaña se llama Disposición... no Presentación'), lo cual contradice tanto fuentes externas como nuestra propia fuente vinculada. Por tanto la clave correcta para esta pregunta sobre Word 2016 es C (Presentación), no B (Disposición).
  - fuente: artículo vinculado (scratchpad/t291/articulos/e64ea742...: 'Pestañas contextuales: Diseño y Presentación'); https://www.aulaclic.es/word-2016/t_2_2.htm ; https://learn.microsoft.com/es-es/answers/questions/5142182/nombre-de-pesta-as-de-word-disposici-n-o-formato
- **Literalidad de la opción marcada:** ❌ no reproduce la fuente

## `f1eadf63-b13f-412a-8971-9834531e16ee`

- ℹ️ Defecto de **opciones** (la clave no se cuestiona)
- **Verificación del lote:** defecto_opciones · confianza alta
  - Con el ejemplo del enunciado (13 caracteres), REEMPLAZAR(B23;1;10;...) no reproduce 'MA' sino 'MAcía' (el tramo tras la posición 10 queda sin sustituir): hay dos fórmulas que no logran el resultado, no solo la marcada. Verificado por cálculo de cadena carácter a carácter.
- **Auditoría ciega:** resuelve **D** · coincide con la clave actual · confianza media
  - Resolví desde la sintaxis de Excel: MAYUSC() acepta un único argumento (el texto), por lo que '=EXTRAE(MAYUSC(B23;1;2))' pasa 3 argumentos a MAYUSC, lo cual es un error de sintaxis (Excel ni siquiera calcularía un resultado válido, mostraría error de argumentos). Por tanto D nunca obtiene 'MA': es la opción más clara e inequívocamente rota. A (=MAYUSC(EXTRAE(B23;1;2))) y C (=MAYUSC(IZQUIERDA(B23;2))) sí calculan correctamente las dos primeras letras en mayúsculas. Aviso importante detectado en la auditoría: la opción B (=REEMPLAZAR(B23;1;10;MAYUSC(IZQUIERDA(B23;2)))) usa un número de caracteres a reemplazar fijo en '10'; para el ejemplo textual del propio artículo ('Manuel García', 13 caracteres) esto reemplaza solo los primeros 10 caracteres y deja un residuo de los 3 últimos ('cía'), dando como resultado 'MAcía' y NO 'MA'. Es decir, con ese ejemplo concreto B tampoco obtendría el resultado 'MA', lo que sugiere que la pregunta (o el nombre de ejemplo usado al redactarla) tiene un defecto adicional. Aun así, D sigue siendo la respuesta más clara y segura para 'NO obtiene el resultado' porque falla por diseño (error de sintaxis) en cualquier caso, mientras que el fallo de B depende de la longitud exacta del nombre. Mantengo mi_clave en D, pero bajo la confianza a media por esta ambigüedad detectada en B.
  - fuente: artículo vinculado (sintaxis de MAYUSC, EXTRAE, IZQUIERDA y REEMPLAZAR); cálculo manual de REEMPLAZAR(B23;1;10;...) sobre 'Manuel García' (13 caracteres)
- **Literalidad de la opción marcada:** sin objeción

---

## Lo aplicado (30/07, verificado contra la BD)

1. **Tres claves** (`55c6e0c9` C→A, `d0614236` C→D, `d94d07d9` B→C), cada una con **explicación
   estructurada nueva y cita literal**, así que las tres pasan a ser barajables. Las tres, de vuelta a
   visible.
2. **`a7ab2b0c` devuelta a visible sin tocar la clave** — se había retirado por un error de nuestro
   contenedor, no suyo.
3. **`f1eadf63`**: restaurado el ejemplo de su propio anexo (Burgos → «BU»). No se tocó el examen
   oficial: se deshizo una paráfrasis nuestra que contradecía la imagen adjunta.
4. **`1bf7cd05` reparada por los tres sitios a la vez**, que era lo que le faltaba: el artículo se
   amplió con la contraindicación de la vía timpánica (fuente: Manual Clínico del H. U. Virgen del
   Rocío), la opción A —que era una segunda negativa igual de defendible— se reescribió como distractor
   inequívoco, y la clave pasó a B, la única que da el motivo. De vuelta a visible y barajable.

## Lo que esto deja para T-302 (contenido de los contenedores)

Tres errores **de nuestra propia fuente** — y dos de ellos son los que provocaron falsos positivos:

- «Supuesto Excel CyL»: afirma que el botón «Modificar» no existe en *Ver macros* y que se llama
  «Editar». Es al revés.
- «Supuesto Word CyL»: lleva una nota interna que da `Alt+Ctrl+O` por erróneo. Es el atajo correcto
  del Word español.
- «Word 2016»: el artículo acierta (*Diseño y Presentación*) pero la explicación de la pregunta
  afirmaba lo contrario; se rehace al reparar la clave.

**Lección de método:** dos de los ocho casos no eran defectos de la pregunta sino **de la fuente contra
la que se verificó**. Cuando la única prueba de cargo es un contenedor virtual, el veredicto vale lo
que valga el contenedor. Y un tercero (`6f8d7590`) cayó en la trampa de traducción de los atajos, que
ya estaba documentada: la página `es-es` de Microsoft **no** refleja los atajos de la instalación
española.

Trazabilidad en BD: `ai_verification_results` con `ai_provider` `claude_code_t291_escalon2`
(verificación) y `claude_code_t291_audit_ciega` (auditoría), ambas con `review_method_version = v2.1`.
