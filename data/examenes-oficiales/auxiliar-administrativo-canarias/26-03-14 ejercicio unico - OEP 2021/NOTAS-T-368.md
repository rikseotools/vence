# Auxiliar Administrativo Gobierno de Canarias — Ejercicio único 14/03/2026 (OEP 2021)

Investigado en T-368 (07/08/2026). **NO importado — falta la plantilla de respuestas correctas.**

## Corrección a la ficha original de T-368

La ficha decía que el examen fue el **13/03/2026**. Es incorrecto. Verificado contra la
FUENTE oficial (no contra la ficha, que se equivocaba):

- El propio texto de la resolución (`resoluc_publica_test_ejercicio_unico_aux_libres_C211L24_14032026.pdf`,
  ya en esta carpeta como `cuestionario.pdf`) dice literalmente: **"Habiéndose celebrado
  dicho ejercicio el 14 de marzo de 2026"**.
- Coincide con `convocatorias.exam_date = 2026-03-14` en BD (fila OEP 2021, 285 plazas
  libres + 14 discapacidad = 299) y con una fuente independiente (blog de CSIF-AGCA
  Canarias: "el Gobierno de Canarias fijó el 14 de marzo como fecha del examen").
- El 13/03/2026 es la fecha de la Resolución de la OTRA convocatoria (la de 2026, 278+18
  plazas, la que tiene la inscripción cerrada) — dos fechas distintas de dos convocatorias
  distintas que la ficha mezcló.

## Qué hay en esta carpeta

- `cuestionario.pdf` / `cuestionario.txt` — el CUESTIONARIO COMPLETO, verbatim, extraído y
  verificado (ver método abajo). 54 preguntas de Parte General (50 + 4 reserva) + dos
  "Supuestos Prácticos" alternativos (A y B, 25+3 reserva cada uno — parecen ser dos
  versiones paralelas del mismo examen para grupos/aulas distintas, NO dos partes
  distintas: ambos empiezan a numerar en la pregunta 55 y el Tribunal resuelve
  impugnaciones de los dos por separado en la misma resolución).
- `califica_provisional_impugnaciones_04062026.pdf` — Resolución de 4/06/2026 con el
  resultado de las impugnaciones. **IMPORTANTE para cuando se importe:**
  - Pregunta 4 (Parte General) **ANULADA** → sustituida por la pregunta 51 de reserva.
  - Preguntas 56 y 60 del Supuesto A **ANULADAS** → sustituidas por las de reserva 80 y 81.
  - Pregunta 58 del Supuesto B **ANULADA** → sustituida por la de reserva 80.
  - Las preguntas anuladas NO deben importarse como válidas (o se importan marcadas y
    nunca se activan).

## LO QUE FALTA — LA PLANTILLA DE RESPUESTAS CORRECTAS

**No la he encontrado.** El título del propio PDF del cuestionario dice *"por la que se
hace pública LA PLANTILLA CON LAS PREGUNTAS Y RESPUESTAS"*, pero el documento que descarga
esa URL **no contiene ninguna respuesta marcada de forma que pueda leerse de forma fiable**:

- Comprobado color de TEXTO (rojo/granate, el método que SÍ funciona para el examen de
  julio 2024 de la carpeta hermana `24-07-08 segundo ejercicio…`): no hay texto rojo en
  ningún sitio del documento.
- Comprobado color de FONDO: hay rectángulos amarillos (`1 1 0 rg` + `re f*`) detrás de
  una línea de texto por pregunta, en TODAS las páginas — visualmente parecen resaltar la
  opción correcta (igual que hizo la sesión que importó `24-03-09 OEP 2022`, que dejó
  anotado en su `answers.json`: *"extracted_via: claude-vision (PDF con fondo amarillo en
  la opción correcta de cada pregunta)"* — o sea, EXISTE precedente de que esta es la
  convención real de esta institución para OTRO examen del mismo cuerpo).
- Monté un decodificador geométrico (rectángulo amarillo → rango Y → qué texto cae dentro)
  y en la Pregunta 1 de la página 2 acertó de forma **verificable de forma independiente**:
  marcó como correcta la opción c) *"La irretroactividad de las disposiciones
  sancionadoras no favorables o restrictivas de derechos individuales, la seguridad
  jurídica y la responsabilidad"* — que es **literalmente el texto del art. 9.3 CE**, así
  que es objetivamente la respuesta correcta. Pero en la Pregunta 2 de la misma página
  (una opción de una sola línea) el mismo método **no marcó nada** — no até el porqué
  (sospecho un problema de posicionamiento de texto relativo-vs-absoluto dentro del mismo
  bloque `BT…ET`, no lo confirmé). Con una tasa de acierto desconocida y sin poder
  verificar cada pregunta una a una contra una fuente independiente (no hay 82 artículos
  de la Constitución que verificar a mano), **no es seguro para producción**. Publicar un
  examen oficial con respuestas mal marcadas es peor que no publicarlo (regla de la casa).

**Qué hace falta para cerrar esto (no lo he podido hacer yo):**

1. **Lo más fiable:** alguien con `pdftoppm`/`magick`/un visor de PDF renderice
   `cuestionario.pdf` como imagen y lea a ojo (o vía Claude-vision, como hizo la sesión de
   `24-03-09`) qué opción tiene el fondo amarillo en cada una de las 82 preguntas. Esta
   máquina (worker de la flota) **no tiene `pdftoppm` ni `magick` instalados** — comprobado
   (`which pdftoppm pdftoppm magick` → nada). Es la vía más simple si alguien tiene esas
   herramientas.
2. **Alternativa código:** terminar de depurar el decodificador geométrico
   (rectángulo-amarillo → línea de texto) hasta que acierte el 100% verificado contra una
   muestra grande, no solo la Pregunta 1. El bug de la Pregunta 2 probablemente esté en
   cómo se actualiza la posición Y del texto dentro de un mismo bloque `BT…ET` (¿son
   siempre `Td` absolutos, o a veces relativos encadenados?). No forma parte de
   `scripts/examenes-oficiales/extraer-pdf-con-respuestas.cjs` (el color de TEXTO, que sí
   está terminado y probado) — sería una segunda función (`decodificarResaltadoAmarillo` o
   similar) en el mismo fichero/tool.
3. Puede que exista una plantilla SEPARADA en formato lista simple ("1-b 2-c 3-a…") que no
   he localizado — busqué en la ficha de la convocatoria
   (`gobiernodecanarias.org/.../convocatorias-en-curso/2024/Acceso_libre/ficha/AUXILIAR-Turno-Libre/`)
   y no apareció ningún PDF con "plantilla" o "respuesta" en el nombre, solo el propio
   cuestionario y las resoluciones de calificación. No descarté que un enlace roto o una
   URL que cambia de sesión a sesión lo tenga.

## Verbatim del cuestionario — método usado (para confiar en el texto, no solo en las respuestas)

`cuestionario.txt` se generó con `scripts/examenes-oficiales/extraer-pdf-con-respuestas.cjs`
(mismo script que la carpeta hermana), que interpreta el content stream del PDF a mano
(sin `pdftotext`, que esta máquina no tiene) y decodifica cada fuente con su propio
`/ToUnicode`. Contrastado contra la extracción independiente de `pdfjs-dist` (texto plano,
sin colores): mismo recuento de caracteres (±5%, la diferencia es solo espaciado), mismas
82 preguntas, mismo orden — el TEXTO se puede dar por bueno. Solo falta la clave.
