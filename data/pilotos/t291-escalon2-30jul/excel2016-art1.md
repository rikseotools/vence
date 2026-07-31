# Interfaz y conceptos básicos de Excel 2016

---

## 1. La ventana de Excel

| Elemento | Qué muestra |
|---|---|
| **Cinta de opciones** | fichas **Archivo, Inicio, Insertar, Diseño de página, Fórmulas, Datos, Revisar y Vista** (más **Programador**, si se activa) |
| **Barra de fórmulas** | el contenido real de la celda activa (la fórmula, no su resultado) |
| **Cuadro de nombres** | la referencia de la celda activa; también sirve para ir a una celda o crear nombres |
| **Área de trabajo** | la cuadrícula de celdas |
| **Etiquetas de hoja** | en la parte inferior, con los botones de navegación |
| **Barra de estado** | modo, cálculos rápidos (suma, promedio, recuento) del rango seleccionado, vistas y zoom |

### 1.1 Qué contiene cada ficha

- **Inicio** — Portapapeles, Fuente, Alineación, Número, **Estilos** (formato condicional, dar formato como tabla y **estilos de celda**), Celdas y Modificar.
- **Insertar** — Tablas, Ilustraciones, Gráficos, Minigráficos, Filtros, Vínculos, Texto y Símbolos.
- **Diseño de página** — Temas, **Configurar página**, **Ajustar área de impresión**, Opciones de la hoja y Organizar.
- **Fórmulas** — Biblioteca de funciones, **Nombres definidos**, **Auditoría de fórmulas** y Cálculo.
- **Datos** — Obtener datos externos, Conexiones, Ordenar y filtrar, Herramientas de datos, Previsión y Esquema.
- **Revisar** — Revisión, Idioma, Comentarios y **Proteger** (**Proteger hoja** y Proteger libro).
- **Vista** — Vistas de libro, Mostrar, Zoom, Ventana y Macros.

> **Proteger hoja está en la ficha Revisar**, no en Inicio ni en Datos. Y **los estilos de celda están en Inicio**.

---

## 2. Conceptos básicos

| Concepto | Definición |
|---|---|
| **Libro** | el archivo; su extensión **predeterminada es `.xlsx`** (`.xlsm` con macros, `.xlsb` binario, `.xltx` plantilla, `.xls` formato 97-2003) |
| **Hoja** | **1.048.576 filas × 16.384 columnas** (de A a **XFD**) |
| **Celda** | intersección de fila y columna (B3) |
| **Rango** | conjunto de celdas (A1:C5) |

**Tipos de datos admitidos:** números, texto, fechas y horas, valores lógicos, valores de error y fórmulas.

### 2.1 Texto que no cabe en la celda

Si se escribe un texto **más largo que el ancho de la celda** y la celda de al lado está **vacía**, **el texto se desborda visualmente sobre la celda adyacente**: se ve entero, pero sigue perteneciendo únicamente a la celda original. Si la celda contigua tiene contenido, el texto se recorta en pantalla (y aparece completo en la barra de fórmulas). Con **Ajustar texto** se reparte en varias líneas dentro de la propia celda.

### 2.2 Tipos de referencia

| Referencia | Escritura | Comportamiento |
|---|---|---|
| **Relativa** | `A1` | **es la referencia por defecto**: al copiar la fórmula, se ajusta a la nueva posición |
| Absoluta | `$A$1` | no varía al copiar |
| Mixta | `$A1`, `A$1` | se fija solo la fila o solo la columna |

**Las referencias relativas son las que Excel utiliza de forma predeterminada** para identificar una celda: se escriben sin `$` y se adaptan solas cuando la fórmula se copia a otro sitio.

---

## 3. Operaciones elementales

Toda fórmula empieza por `=`. **Para restar el contenido de D6 al de D5 se escribe `=D5-D6`**: primero la celda minuendo, después el operador y luego el sustraendo. No hay ninguna función «RESTA» en Excel.

---

## 4. Categorías de funciones

Excel clasifica las funciones por categorías, y en examen se pregunta a cuál pertenece cada una:

| Categoría | Ejemplos |
|---|---|
| **Matemáticas y trigonométricas** | **RAIZ, ENTERO, POTENCIA**, ABS, REDONDEAR, RESIDUO, SUMA |
| **Búsqueda y referencia** | **INDICE, INDIRECTO**, BUSCARV, BUSCARH, COINCIDIR, DESREF, ELEGIR |
| **Fecha y hora** | HOY, AHORA, AÑO, MES, DIA, **HORA**, MINUTO, SEGUNDO, **FECHA**, **FIN.MES**, DIASEM |
| **Texto** | IZQUIERDA, DERECHA, **EXTRAE**, LARGO, CONCATENAR, ESPACIOS, LIMPIAR |
| **Estadísticas** | PROMEDIO, CONTAR, MODA.UNO, MEDIANA, MAX, MIN |
| **Lógicas** | SI, Y, O, NO, SI.ERROR |
| **Información** | ESNUMERO, ESTEXTO, ESBLANCO, TIPO, CELDA |
| **Ingeniería** | funciones de Bessel, conversiones de base, números complejos |
| **Financieras** | PAGO, PAGOINT, VA, VF, TASA, NPER |

### 4.1 Ejemplos que conviene tener resueltos

- **`=HORA("16:45:30")`** devuelve **`16`**: la función `HORA` extrae **solo la hora** de un valor de tiempo, como número entre 0 y 23.
- **`=EXTRAE("Vence";4;7)`** devuelve **`ce`**. Empieza en el carácter 4 y pide 7, pero la cadena solo tiene 5 caracteres: **Excel devuelve los que hay a partir de esa posición, sin error**.
- **`=FECHA(2024;13;5)`** **no genera ningún error**. `FECHA` admite valores fuera de rango y los reajusta: el mes 13 de 2024 es **enero de 2025**, así que devuelve el 05/01/2025.
- **`=FIN.MES(11-3-2022;2)`** devuelve **`#¡NUM!`**. Al escribir la fecha **sin comillas**, Excel no la interpreta como fecha sino como una **resta**: 11 − 3 − 2022 = −2014, un número de serie negativo que no corresponde a ninguna fecha válida. La forma correcta sería `=FIN.MES("11/3/2022";2)` o `=FIN.MES(FECHA(2022;3;11);2)`.

---

## 5. Imprimir

En **Archivo ▸ Imprimir**, la sección **Configuración** ofrece:

- **Qué se imprime:** Imprimir hojas activas · **Imprimir todo el libro** · **Imprimir selección** · Imprimir área de impresión.
- Orientación, tamaño del papel, márgenes y ordenación de copias.
- **Escalado:** Sin ajuste de escala · Ajustar hoja en una página · **Ajustar todas las columnas en una página** · Ajustar todas las filas en una página.

Dos matices que se preguntan:

- **Para que la hoja salga con una sola página de ancho** (sin partir las columnas a la derecha), la opción es **«Ajustar todas las columnas en una página»**.
- **Para imprimir solo unas tablas concretas de la hoja activa**, se seleccionan y se elige **«Imprimir selección»**.
- **No existe ninguna opción llamada «imprimir el área impar»**: el desplegable no distingue páginas pares e impares.

---

## 6. Diferencias con Excel 365

Excel 2016 **no** dispone de `BUSCARX`, `FILTRAR`, `ORDENAR`, `UNICOS` ni `SECUENCIA`, ni de **matrices dinámicas**, ni de coautoría en tiempo real, ni de tipos de datos enriquecidos. **Sí** tiene `BUSCARV`, `BUSCARH`, `SI`, `CONTAR.SI`, `SUMAR.SI`, tablas dinámicas, Power Pivot y Power Query (*Obtener y transformar*).

---

## 7. Personalizar la cinta de opciones

En **Archivo ▸ Opciones ▸ Personalizar cinta de opciones** se añaden fichas y grupos propios. El botón **Restablecer** **elimina todas las personalizaciones y devuelve la cinta a su estado predeterminado**.
