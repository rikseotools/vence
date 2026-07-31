# Gráficos y gestión de datos en Excel 2016

---

## 1. Gráficos

Se insertan desde **Insertar ▸ Gráficos**, con el rango de datos seleccionado. Al crearse aparecen dos fichas contextuales, **Herramientas de gráficos ▸ Diseño** y **Formato**.

### 1.1 Tipos de gráfico de Excel 2016

| Tipo | Subtipos habituales |
|---|---|
| **Columna** | agrupada, apilada, 100 % apilada, 3D |
| **Barra** | las mismas, en horizontal |
| **Línea** | línea, **línea apilada**, línea 100 % apilada, con marcadores |
| **Circular** | circular, circular 3D, **anillo**, circular con subgráfico |
| **Área** | área, área apilada, 100 % apilada |
| **Dispersión (XY)** | solo con marcadores, con líneas suavizadas, con líneas rectas |
| **Otros** | Burbuja, Radial, Superficie, **Cotizaciones**, **Cascada**, **Rectángulos** (*treemap*), **Proyección solar**, **Histograma**, **Pareto**, **Cajas y bigotes**, **Embudo** y **Combinado** |

> **No existe ningún tipo de gráfico llamado «toroidal» en Excel.** El gráfico con forma de rosquilla se llama **anillo** y es un subtipo de los circulares.

**El gráfico de dispersión (XY)** es el que **combina pares de valores en puntos de datos únicos** y los representa a intervalos irregulares: se usa para ver la relación entre dos variables numéricas, no para comparar categorías.

### 1.2 Elementos del gráfico

Título del gráfico, títulos de eje, leyenda, etiquetas de datos, líneas de cuadrícula, líneas de tendencia y barras de error. Se activan con el botón **+** del gráfico o desde *Diseño ▸ Agregar elemento de gráfico*.

### 1.3 Minigráficos (*sparklines*)

Se insertan desde **Insertar ▸ Minigráficos** (Línea, Columna o Pérdidas y ganancias).

**Diferencia esencial con un gráfico normal:** **el minigráfico se dibuja DENTRO de una celda**, como si fuera su fondo, y **no incluye elementos independientes** (ni título, ni leyenda, ni ejes ni etiquetas). Un gráfico tradicional es un objeto flotante sobre la hoja con todos esos elementos.

---

## 2. Ordenar, filtrar y limpiar datos

- **Ordenar** (Datos ▸ Ordenar y filtrar): A-Z, Z-A y **Orden personalizado** con varios niveles.
- **Autofiltro**: coloca flechas desplegables en los encabezados.
- **Quitar duplicados**: en **Datos ▸ Herramientas de datos**. **Pero si el rango se ha convertido en tabla, el comando está además en Herramientas de tabla ▸ Diseño ▸ grupo Herramientas ▸ Quitar duplicados.**

### 2.1 Filtro avanzado

**Datos ▸ Ordenar y filtrar ▸ Avanzadas** permite filtrar con un rango de criterios y elegir entre filtrar la lista en el sitio o **copiar a otro lugar**. Al copiar a otro lugar **se llevan los valores y también los formatos** de las celdas de origen si así se ha configurado el copiado; y con la casilla *Solo registros únicos* se descartan las filas repetidas.

### 2.2 Validación de datos

**Datos ▸ Herramientas de datos ▸ Validación de datos** restringe lo que se puede escribir en una celda.

- Para que una celda **solo admita valores de un conjunto cerrado** hay que **crear una lista desplegable**: en *Permitir* se elige **Lista** y se indica el origen (un rango o los valores separados por `;`).
- La pestaña **Mensaje de error** tiene un desplegable **Estilo** con exactamente **tres** opciones: **Alto** (impide la entrada), **Advertencia** (avisa pero permite continuar) e **Información** (solo informa).

### 2.3 Subtotales

**Datos ▸ Esquema ▸ Subtotal** es el comando para **obtener totales por grupos** dentro de una lista larga. Exige **ordenar antes** por el campo de agrupación.

### 2.4 Consolidar

**Datos ▸ Herramientas de datos ▸ Consolidar** sirve para **agrupar y resumir los datos de varios rangos** —de la misma hoja, de otras hojas o de otros libros— en una única tabla de resultados, aplicando una función (Suma, Promedio, Máx…).

---

## 3. Tablas y tablas dinámicas

- **Tabla** (*Insertar ▸ Tabla*): encabezados con filtro automático, fila de totales, estilos y **referencias estructuradas**.
- **Tabla dinámica** (*Insertar ▸ Tabla dinámica*): campos en las áreas **Filas, Columnas, Valores y Filtros**; configuración de campo (Suma, Cuenta, Promedio, Máx, Mín); agrupación por meses, trimestres o años; y **segmentación de datos** y escala de tiempo para filtrar visualmente.
- **Power Pivot** es el complemento de modelo de datos: **permite combinar grandes volúmenes de datos de orígenes distintos**, relacionarlos entre sí y crear medidas con DAX, superando los límites de una tabla dinámica normal.

---

## 4. Análisis de hipótesis

**Datos ▸ Previsión ▸ Análisis de hipótesis** reúne tres herramientas:

### 4.1 Buscar objetivo

Responde a «sé el resultado que quiero, ¿qué valor necesito?». Es la herramienta indicada cuando, por ejemplo, **se conoce la cuota mensual que se puede pagar de un crédito y se quiere saber el importe máximo a solicitar**.

Su cuadro de diálogo tiene **tres campos**:

| Campo | Qué se indica |
|---|---|
| **Definir la celda** | la celda con la fórmula cuyo resultado se quiere fijar |
| **Con el valor** | el resultado que se desea obtener |
| **Cambiando la celda** | **la celda que Excel irá modificando** hasta alcanzarlo (debe ser un valor, no una fórmula) |

### 4.2 Escenarios

El **Administrador de escenarios** guarda conjuntos de valores de entrada para comparar resultados. **Cada escenario admite un máximo de 32 celdas cambiantes.**

### 4.3 Tabla de datos

Calcula los resultados de una o dos variables de entrada sobre una misma fórmula.

---

## 5. Auditoría y supervisión

- **Fórmulas ▸ Auditoría de fórmulas**: Rastrear precedentes, Rastrear dependientes, Quitar flechas, Mostrar fórmulas y Evaluar fórmula.
- **Ventana Inspección** (mismo grupo): **permite ir supervisando el valor de determinadas celdas** aunque no estén visibles en pantalla, incluso si pertenecen a otra hoja del libro. Es la herramienta para vigilar celdas clave mientras se trabaja lejos de ellas.

---

## 6. Nombres definidos

**Fórmulas ▸ Nombres definidos ▸ Administrador de nombres** es la herramienta desde la que **se gestionan todos los nombres del libro**: crear, editar, eliminar y filtrar los nombres definidos y los de tabla, y ver a qué rango se refiere cada uno.

---

## 7. Ventanas y vista

En **Vista ▸ Ventana**:

- **Nueva ventana** — **crea un duplicado exacto de la ventana del libro activo**, de modo que puede verse la misma información en dos ventanas a la vez (por ejemplo, dos hojas del mismo libro).
- **Cambiar ventanas** — **muestra la lista de todos los libros abiertos** y permite saltar a cualquiera de ellos.
- **Organizar todo**, **Inmovilizar paneles** y **Dividir** completan el grupo.

---

## 8. Análisis rápido

Al seleccionar un rango aparece el botón **Análisis rápido**, con cinco categorías: **Formato, Gráficos, Totales, Tablas y Minigráficos**.

La categoría **Totales** ofrece **Suma, Promedio, Recuento, % del total y Total acumulado**. **No incluye Máximo ni Mínimo.**

---

## 9. Protección

| Comando | Dónde | Qué protege |
|---|---|---|
| **Proteger hoja** | Revisar ▸ Proteger | el contenido de las celdas bloqueadas de esa hoja |
| **Proteger libro** | Revisar ▸ Proteger | la estructura: impide añadir, eliminar, mover u ocultar hojas |
| **Bloquear celdas** | Formato de celdas ▸ Protección | marca qué celdas quedarán bloqueadas *cuando* se proteja la hoja |

> **La contraseña es opcional, y ahí está el matiz que se pregunta: si se protege una hoja SIN contraseña, cualquier otro usuario puede desprotegerla sin contraseña** desde *Revisar ▸ Desproteger hoja*. La protección sin contraseña evita cambios accidentales, no intencionados.

---

## 10. Personalizar la cinta de opciones

En **Archivo ▸ Opciones ▸ Personalizar cinta de opciones** se crean fichas y grupos propios. El botón **Restablecer** **elimina todas las personalizaciones y devuelve la cinta a su configuración predeterminada**; puede aplicarse solo a la ficha seleccionada o a todas.

---

## 11. Condicionales anidadas

Una fórmula del tipo `=SI(A12>50;"Aprobado";"Suspenso")` **evalúa si el valor de la celda A12 es superior a 50** y devuelve un resultado u otro. Anidando varias `SI` se encadenan tramos; Excel 2016 admite hasta **64 niveles de anidamiento**.
