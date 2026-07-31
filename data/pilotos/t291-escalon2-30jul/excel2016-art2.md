# Formato de celdas en Excel 2016

El cuadro completo se abre con **Inicio ▸ Formato ▸ Formato de celdas** o con **Ctrl+1**, y tiene seis pestañas: **Número, Alineación, Fuente, Bordes, Relleno y Proteger**.

---

## 1. Pestaña Número: categorías

| Categoría | Para qué |
|---|---|
| **General** | sin formato específico; es el que trae la celda por defecto |
| **Número** | decimales, separador de miles y presentación de negativos |
| **Moneda** y **Contabilidad** | símbolo monetario (Contabilidad alinea símbolos y decimales) |
| **Fecha** y **Hora** | los distintos modelos de presentación |
| **Porcentaje** | multiplica por 100 y añade % |
| **Fracción**, **Científica** | notación de fracción y exponencial |
| **Texto** | trata el contenido como texto aunque sea un número |
| **Personalizada** | códigos propios (`0,00`, `dd/mm/aaaa`, `#.##0 €`) |

### 1.1 Qué formato aplica Excel solo

Excel **interpreta lo que se escribe** y aplica el formato correspondiente, incluso en una celda con formato General:

- Al escribir **`20/2`** en español, Excel lo entiende como una **fecha** y la muestra como **`20-feb`**.
- Al escribir **`1/21`** o `ene-21`, lo muestra como **`ene-21`**.
- Al introducir **`01/01/2021`**, Excel aplica el formato de fecha corta **`d-mm-aaaa`**.

> Para que un dato de ese tipo se conserve como texto hay que aplicar antes la categoría **Texto** o escribirlo precedido de un apóstrofo (`'20/2`).

### 1.2 Obtener partes de una fecha

Con una fecha en A1: **`=DIA(A1)`** devuelve **el día del mes**, `=MES(A1)` el mes y `=AÑO(A1)` el año.

---

## 2. Fuente, alineación, bordes y relleno

- **Fuente**: tipo, tamaño, **negrita, cursiva, subrayado**, color, tachado, superíndice y subíndice.
- **Alineación**: horizontal y vertical, **Ajustar texto**, **Combinar y centrar**, orientación y sangría.
- **Bordes** y **Relleno**: contorno, bordes interiores, color y trama.
- **Estilos de celda**: **están en la ficha Inicio ▸ grupo Estilos**, junto a Formato condicional y Dar formato como tabla.

> **La ficha Inicio NO contiene el grupo «Tablas»**: insertar una tabla o una tabla dinámica se hace desde la ficha **Insertar**. En Inicio están Portapapeles, Fuente, Alineación, Número, Estilos, Celdas y Modificar.

---

## 3. Formato condicional

**Inicio ▸ Estilos ▸ Formato condicional**:

- **Reglas de resaltado de celdas**: es mayor que, es menor que, entre, es igual a, texto que contiene, una fecha, **valores duplicados**.
- **Reglas superiores e inferiores**: 10 superiores, 10 % superiores, por encima o por debajo del promedio.
- **Barras de datos**, **Escalas de color** y **Conjuntos de iconos**.
- **Nueva regla** (con fórmula personalizada) y **Administrar reglas**.

En el cuadro *Nueva regla de formato*, el primer tipo de regla es **«Aplicar formato a todas las celdas según sus valores»**: es el que agrupa **Escala de 2 colores, Escala de 3 colores, Barra de datos y Conjunto de iconos**, porque todos ellos colorean el rango completo en función del valor relativo de cada celda.

---

## 4. Listas desplegables (validación de datos)

Para que una celda solo admita valores de una lista cerrada:

**Datos ▸ Herramientas de datos ▸ Validación de datos ▸ pestaña Configuración ▸ Permitir: «Lista»**, y en *Origen* se indica el rango o los valores separados por punto y coma.

---

## 5. Rellenar series

Para rellenar una columna con una serie de valores hay **dos caminos igual de válidos**:

1. **Arrastrar el controlador de relleno** (el cuadradito de la esquina inferior derecha de la selección) tras escribir los dos primeros valores, que es lo que fija el incremento.
2. **Inicio ▸ Modificar ▸ Rellenar ▸ Series**, donde se indica el tipo (lineal, geométrica, cronológica), el incremento y el límite.

---

## 6. Encabezado y pie de página

En **Insertar ▸ Texto ▸ Encabezado y pie**, o desde *Diseño de página ▸ Configurar página ▸ Encabezado y pie*, se insertan códigos de autotexto:

| Código | Resultado |
|---|---|
| `&[Página]` | el número de la página actual |
| `&[Páginas]` | el número total de páginas |
| `&[Fecha]`, `&[Hora]` | fecha y hora de impresión |
| `&[Archivo]`, `&[Pestaña]` | nombre del libro y de la hoja |

Por eso la numeración del tipo «Página 3 de 12» se escribe **`Página &[Página] de &[Páginas]`**.
