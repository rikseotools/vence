# Tablas, imágenes e inserción en Word 2016

## 1. Tablas

Se insertan desde **Insertar ▸ Tabla**: cuadrícula, *Insertar tabla* (indicando filas y columnas), *Dibujar tabla*, *Hoja de cálculo de Excel* y *Tablas rápidas*. También puede **convertirse texto en tabla** y a la inversa.

### 1.1 Fichas contextuales

Al situar el cursor en una tabla se activan **Herramientas de tabla ▸ Diseño** y **Presentación** — esos son sus nombres en Word 2016.

- **Diseño**: opciones de estilo, estilos de tabla, sombreado y bordes.
- **Presentación**: seleccionar, ver líneas, propiedades, insertar y eliminar filas y columnas, **combinar**, **tamaño de celda**, alineación, datos (ordenar, repetir filas de título, fórmula).

> **La opción «Autoajustar» está en la ficha Presentación, grupo Tamaño de celda**, con las variantes *Autoajustar al contenido*, *Autoajustar a la ventana* y *Ancho de columna fijo*.

### 1.2 Combinar y dividir

- **Combinar celdas** — al seleccionar varias celdas y aplicarlo, **se fusionan en una sola celda**; si tenían contenido, este se conserva y queda uno debajo de otro, separado en párrafos.
- **Dividir celdas** parte la celda en el número de filas y columnas que se indique; **Dividir tabla** separa la tabla en dos.

### 1.3 Borrar contenido y borrar celdas

**Si se selecciona una celda y se pulsa `Supr`, se elimina el CONTENIDO de la celda, pero la celda sigue existiendo**: la estructura de la tabla no cambia. Para quitar la celda, la fila o la columna hay que usar *Presentación ▸ Eliminar*.

### 1.4 Otras opciones

**Repetir filas de título** hace que la primera fila se repita como encabezado en cada página. Las fórmulas de tabla usan la sintaxis `=SUM(ABOVE)`, `=AVERAGE(LEFT)`.

---

## 2. Imágenes y objetos

Desde la ficha **Insertar**: Imágenes (desde archivo), Imágenes en línea, Formas, SmartArt, Gráfico, Captura, Cuadro de texto, **WordArt**, Letra capital, Ecuación y Símbolo. Los vínculos (Hipervínculo, Marcador, Referencia cruzada) están en el grupo Vínculos.

- **WordArt** consiste en **aplicar efectos tipográficos concretos a un texto** —contornos, rellenos, sombras, reflejos, transformaciones— convirtiéndolo en un objeto gráfico que se puede mover y girar.
- **El número de página se inserta desde Insertar ▸ Número de página**, eligiendo posición y formato; queda dentro del encabezado o del pie.
- **Ajuste de imagen** (Herramientas de imagen ▸ Formato ▸ Ajustar texto): En línea con el texto, Cuadrado, Estrecho, Transparente, Arriba y abajo, **Detrás del texto** y **Delante del texto**.

---

## 3. Pegado especial

Tras copiar un fragmento, **Inicio ▸ Pegar ▸ Pegado especial** permite elegir el formato con el que se incorpora: **texto sin formato**, texto con formato (RTF), imagen, documento de Word, HTML, o **pegar con vínculo** al origen. Es la vía para pegar un texto sin arrastrar el formato de origen.

---

## 4. Temas

**Diseño ▸ Temas** aplica a todo el documento un conjunto coordinado: **al elegir un tema se ajustan automáticamente los colores, las fuentes y los efectos** de todo el documento a la vez, respetando los estilos aplicados.

---

## 5. Interlineado

Los valores del desplegable de interlineado de Word son **1,0 · 1,15 · 1,5 · 2,0 · 2,5 · 3,0**, más las opciones del cuadro Párrafo (Sencillo, 1,5 líneas, Doble, Mínimo, Exacto y Múltiple).

> Cuidado con la pregunta inversa: **el valor 1,15 sí existe** en Word (es el predeterminado de los documentos nuevos desde 2007); el que no aparece en el desplegable es cualquier otro valor intermedio que no esté en esa lista.

---

## 6. Referencias

### 6.1 Referencias cruzadas

Vinculan a otra parte del mismo documento (título, marcador, tabla, figura, nota). **Regla fundamental: hay que crear ANTES el elemento al que se va a hacer referencia**; si no existe, no aparece en la lista de destinos.

### 6.2 Tabla de contenido y niveles

La tabla de contenido se genera a partir de los estilos de título. **Si se crea incluyendo hasta el nivel 3 y después se añaden títulos de nivel 4, estos no aparecen**: la tabla se generó con un número de niveles fijado, y para incorporarlos hay que regenerarla cambiando la opción *Mostrar niveles* en **Tabla de contenido personalizada**.

### 6.3 Tabla de autoridades

**Sirve para listar automáticamente las citas legales** (leyes, sentencias, reglamentos) que se han marcado previamente en el documento, agrupadas por categorías. Se marcan con *Referencias ▸ Tabla de autoridades ▸ Marcar cita*.

**Las citas marcadas se insertan en el documento como códigos de campo ocultos `XE`** (campos de entrada), visibles solo al mostrar las marcas de formato; son esos códigos los que Word recopila al generar la tabla.

---

## 7. Revisión e idioma

- El cuadro **Idioma** (ficha **Revisar** ▸ Idioma ▸ Establecer idioma de corrección) sirve para **fijar el idioma con el que se revisan la ortografía y la gramática** del texto seleccionado o de todo el documento, y para marcar texto como «no revisar».
- **Panel de revisiones**: puede mostrarse **vertical** (a la izquierda) u **horizontal** (bajo el documento). **El vertical presenta los cambios de forma más compacta y ocupa menos ancho de pantalla**, mientras que el horizontal deja más ancho al documento pero menos alto.

---

## 8. Formatos de archivo

Cambiar la extensión de **`.docx` a `.dotx`** convierte el archivo en **plantilla**: **al abrirla, Word crea un documento nuevo basado en ella** en lugar de abrir el propio archivo, que queda intacto.
