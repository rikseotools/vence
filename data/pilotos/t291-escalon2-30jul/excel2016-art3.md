# Fórmulas y funciones en Excel 2016

Toda fórmula empieza por **`=`**. Puede combinar valores constantes, referencias a celdas, operadores, funciones y nombres definidos. Excel la recalcula automáticamente cuando cambia cualquiera de las celdas de las que depende.

---

## 1. Qué se puede escribir en una celda

Una celda de Excel admite **texto, números, fechas y horas, fórmulas, valores lógicos (VERDADERO/FALSO) y valores de error**. Además, sobre la hoja pueden insertarse **objetos** (imágenes, formas, gráficos, SmartArt), que no ocupan una celda pero se anclan a ella.

Los números, las fechas y las horas se alinean por defecto a la **derecha**; el texto, a la **izquierda**. Ese comportamiento es la forma rápida de detectar un número que en realidad ha entrado como texto.

---

## 2. Operadores

| Tipo | Operadores |
|---|---|
| **Aritméticos** | `+` suma · `-` resta y negación · `*` producto · `/` división · `%` porcentaje · `^` potencia |
| **Comparación** | `=` igual · `>` mayor · `<` menor · `>=` mayor o igual · `<=` menor o igual · `<>` distinto |
| **Concatenación de texto** | `&` (une cadenas: `="Ref "&A1`) |
| **Referencia** | `:` rango (`A1:A10`) · `;` unión (`A1:A5;C1:C5`) · **espacio** intersección (`A1:C5 B1:B10`) |

**Orden de precedencia** (de mayor a menor): referencia (`:` `;` espacio) → negación (`-1`) → `%` → `^` → `*` y `/` → `+` y `-` → `&` → operadores de comparación. Los paréntesis alteran ese orden.

> El operador **espacio** es el que produce el error `#¡NULO!` cuando los dos rangos indicados **no se cruzan**.

---

## 3. Referencias a celdas

| Tipo | Escritura | Al copiar la fórmula… |
|---|---|---|
| **Relativa** | `A1` | se ajustan fila y columna |
| **Absoluta** | `$A$1` | no cambia nada |
| **Mixta (columna fija)** | `$A1` | la columna se mantiene, la fila se ajusta |
| **Mixta (fila fija)** | `A$1` | la fila se mantiene, la columna se ajusta |

El símbolo que fija una referencia es el **`$`**: convierte en absoluta la parte a la que precede. La tecla **F4**, con el cursor sobre la referencia, va alternando los cuatro tipos en este orden: `A1` → `$A$1` → `A$1` → `$A1` → `A1`.

**Ejemplo de ajuste al copiar.** Si en la celda **C5** hay la fórmula `=$C4` y se copia y pega **15 filas más abajo** (a C20), el resultado es **`=$C19`**: la columna estaba fijada con `$` y no se mueve, mientras que la fila, relativa, se desplaza las mismas 15 filas.

**Otras hojas y otros libros:** `=Hoja2!A1`, `='Hoja de datos'!A1` (comillas simples si el nombre lleva espacios) y `=[Libro1.xlsx]Hoja1!A1`. Una referencia **3D** abarca varias hojas: `=SUMA(Hoja1:Hoja3!A1)`.

---

## 4. Categorías de funciones

El cuadro **Insertar función** (`fx`, o la ficha **Fórmulas**) agrupa las funciones en estas categorías:

| Categoría | Para qué sirve |
|---|---|
| **Financieras** | amortizaciones, pagos, tasas, valor actual y futuro |
| **Fecha y hora** | operaciones con fechas, días laborables, día de la semana |
| **Matemáticas y trigonométricas** | redondeos, sumas condicionales, potencias, divisores, trigonometría |
| **Estadísticas** | promedios, medianas, modas, desviaciones, recuentos |
| **Búsqueda y referencia** | localizar valores y devolver referencias |
| **Base de datos** | cálculos sobre listas con criterios (`BDSUMA`, `BDCONTAR`…) |
| **Texto** | manipulación de cadenas |
| **Lógicas** | condiciones y operadores lógicos |
| **Información** | **consultar el estado de una celda o valor**: si contiene un número o texto, si está vacía, si es par o impar, si hay un error, en qué hoja está (`ESNUMERO`, `ESTEXTO`, `ESBLANCO`, `ES.PAR`, `ESERROR`, `HOJA`, `TIPO`, `CELDA`) |
| **Ingeniería** | **funciones de Bessel** (`BESSELI`, `BESSELJ`, `BESSELK`, `BESSELY`), **conversiones entre sistemas de numeración** (`DEC.A.BIN`, `BIN.A.HEX`, `HEX.A.DEC`…), números complejos y conversión de unidades (`CONVERTIR`) |
| **Cubo** | consultas a modelos de datos OLAP |
| **Compatibilidad** | versiones antiguas de funciones renombradas (p. ej. `MODA` frente a `MODA.UNO`) |
| **Web** | `SERVICIOWEB`, `URLCODIF`, `XMLFILTRO` |

> Dos categorías se confunden a menudo en examen: **Ingeniería** (Bessel, conversiones de base, números complejos) e **Información** (preguntar *qué* hay en una celda). No son intercambiables.

---

## 5. Funciones más utilizadas

### 5.1 Recuento y suma

| Función | Qué hace |
|---|---|
| `SUMA(rango)` | suma los valores numéricos |
| `PROMEDIO(rango)` | media aritmética |
| `MAX` / `MIN` | mayor y menor valor |
| `CONTAR(rango)` | cuenta **solo celdas con números** |
| `CONTARA(rango)` | cuenta **las celdas no vacías**, sea cual sea su contenido (texto, números, fechas, errores) |
| `CONTAR.BLANCO(rango)` | cuenta las celdas **vacías** |
| `CONTAR.SI(rango; criterio)` | cuenta las que cumplen una condición |
| `SUMAR.SI(rango; criterio; [rango_suma])` | suma las que cumplen una condición |
| `SUMAR.SI.CONJUNTO` / `CONTAR.SI.CONJUNTO` | varias condiciones a la vez |

**Ejemplo.** `=CONTAR.SI(A1:A5;">5")` sobre el rango `{2; 6; 8; 3; 9}` devuelve **3**, porque hay tres valores mayores que 5 (6, 8 y 9). El criterio va **entre comillas** cuando incluye un operador de comparación.

**Ejemplo.** `=CONTARA(A1:A6)` cuenta cuántas celdas del rango **contienen algo**, sin importar el tipo de dato; solo deja fuera las completamente vacías.

### 5.2 Lógicas

- `SI(prueba_lógica; valor_si_verdadero; valor_si_falso)`
- `Y(...)`, `O(...)`, `NO(...)`
- `SI.ERROR(valor; valor_si_error)` — devuelve el segundo argumento cuando el primero da error

**Ejemplo.** `=SI(A12>1000;"Superior";"Inferior")` evalúa si el valor de A12 es mayor que 1000 y devuelve un texto u otro según el resultado.

### 5.3 Búsqueda y referencia

| Función | Sintaxis | Devuelve |
|---|---|---|
| `BUSCARV` | `(valor; matriz; indicador_columnas; [ordenado])` | el valor de la columna indicada, buscando en la **primera columna** |
| `BUSCARH` | igual, pero buscando en la **primera fila** | |
| `COINCIDIR` | `(valor; matriz; [tipo])` | **la POSICIÓN** que ocupa el valor dentro del rango, no el valor |
| `INDICE` | `(matriz; fila; [columna])` | el valor situado en esa posición |
| `INDIRECTO` | `(ref_texto)` | la referencia que describe una cadena de texto |
| `DESREF`, `TRANSPONER`, `ELEGIR` | | |

**Ejemplo.** `=COINCIDIR("azul";{"verde";"rojo";"azul";"blanco"};0)` devuelve **3**: «azul» es el tercer elemento de la matriz. El tipo `0` exige coincidencia exacta.

> `INDICE` + `COINCIDIR` es la pareja habitual para sustituir a `BUSCARV` cuando la columna buscada no es la primera.

### 5.4 Texto

| Función | Qué hace |
|---|---|
| `IZQUIERDA(texto; n)` / `DERECHA(texto; n)` | extrae n caracteres por un extremo |
| `EXTRAE(texto; inicio; n)` | extrae n caracteres desde una posición |
| `LARGO(texto)` | número de caracteres |
| `CONCATENAR(...)` o `&` | une cadenas |
| `MAYUSC` / `MINUSC` / `NOMPROPIO` | cambian el uso de mayúsculas |
| `HALLAR` / `ENCONTRAR` | posición de un texto dentro de otro (`ENCONTRAR` distingue mayúsculas) |
| `SUSTITUIR` / `REEMPLAZAR` | cambian parte del contenido |
| `ESPACIOS(texto)` | elimina los **espacios sobrantes** |
| `LIMPIAR(texto)` | elimina los **caracteres no imprimibles** |

**Ejemplo.** `=EXTRAE("PreparaTest";1;7)` devuelve **`Prepara`**: siete caracteres a partir del primero.

> **`LIMPIAR()` es la función típica tras importar datos de una fuente externa**: quita los caracteres de control que no se ven pero que impiden que los datos se traten bien. Para los espacios de más, la función es `ESPACIOS()`.

### 5.5 Fecha y hora

`HOY()` (fecha actual) · `AHORA()` (fecha y hora) · `AÑO`, `MES`, `DIA` · `FECHA(año;mes;día)` · `DIAS.LAB` · **`DIASEM(fecha; [tipo])`**, que devuelve **el día de la semana en formato numérico** (con `tipo`=1, domingo = 1; con `tipo`=2, lunes = 1).

### 5.6 Matemáticas

`REDONDEAR`, `REDONDEAR.MAS`, `REDONDEAR.MENOS`, `TRUNCAR`, `ENTERO`, `ABS`, `RAIZ`, `POTENCIA`, `ALEATORIO`, `SUMAPRODUCTO`.

- **`RESIDUO(número; divisor)`** devuelve **el resto** de una división. `=RESIDUO(10;3)` → 1.
- **`M.C.D(números)`** devuelve el **máximo común divisor**. `=M.C.D(10;5)` → **5**.
- **`M.C.M(números)`** devuelve el **mínimo común múltiplo**.

### 5.7 Estadísticas

`MEDIANA`, `DESVEST.M`, `VAR`, `K.ESIMO.MAYOR`, `JERARQUIA` y **`MODA.UNO(rango)`**, que devuelve **el valor que más veces se repite** en el rango (`MODA` es su versión antigua, hoy en la categoría *Compatibilidad*).

### 5.8 Financieras

`PAGO`, `PAGOPRIN`, `VA`, `VF`, `TASA`, `NPER` y **`PAGOINT`**:

```
PAGOINT(tasa; período; nper; va; [vf]; [tipo])
```

El argumento **`tipo`** es el que establece **cuándo vencen los pagos**: `0` u omitido = al **final** del período; `1` = al **principio**.

---

## 6. Valores de error

| Error | Cuándo aparece |
|---|---|
| `#¡VALOR!` | un argumento es de un tipo que la fórmula no admite (texto donde se espera número) |
| `#¡REF!` | **la referencia utilizada ya no es válida**: se ha eliminado la celda, fila, columna u hoja a la que apuntaba |
| `#¡DIV/0!` | división entre cero o entre una celda vacía |
| `#¿NOMBRE?` | **Excel no reconoce el texto de la fórmula**: nombre de función mal escrito, texto sin comillas o nombre definido inexistente |
| `#N/A` | el valor buscado no está disponible (típico de `BUSCARV`) |
| `#¡NUM!` | el resultado no es un número válido o se sale del rango representable |
| `#¡NULO!` | **la intersección de dos rangos que no se cruzan** (operador espacio) |

> `#####` **no es un error**: solo indica que la columna es demasiado estrecha para mostrar el número. Se corrige ensanchándola.

---

## 7. Herramientas relacionadas

### 7.1 Pegado especial

Además de pegar todo, permite pegar **solo valores**, **solo formatos**, **solo fórmulas**, **ancho de columnas**, aplicar una **operación** (sumar, restar, multiplicar, dividir) y **Transponer**.

**Transponer** **intercambia la orientación de los datos**: lo que estaba en filas pasa a columnas y viceversa.

### 7.2 Subtotales

En **Datos ▸ Esquema ▸ Subtotal** se insertan totales por grupos. **Para que funcione, los datos deben estar ORDENADOS previamente por el campo por el que se va a agrupar**; si no lo están, Excel crea un subtotal cada vez que el valor cambia y el resultado carece de sentido.

### 7.3 Análisis rápido

Al seleccionar un rango aparece el botón **Análisis rápido** en su esquina inferior derecha, con cinco categorías: **Formato**, **Gráficos**, **Totales**, **Tablas** y **Minigráficos**.

La categoría **Totales** ofrece **Suma, Promedio, Recuento, % del total y Total acumulado**, en variantes por columna y por fila. **No incluye Máximo ni Mínimo**: para eso hay que escribir las funciones `MAX` y `MIN`.

---

## 8. Límites que conviene recordar

| Especificación | Límite |
|---|---|
| Fórmulas que pueden depender de una sola celda | **4.000 millones (4 mil millones)** |
| Argumentos de una función | 255 |
| Longitud del contenido de una fórmula | 8.192 caracteres |
| Niveles de anidamiento de funciones | 64 |
| Filas y columnas de una hoja | 1.048.576 × 16.384 |

---

**Fuente:** documentación oficial de Microsoft para Excel — *Especificaciones y límites de Excel* y las páginas de referencia de cada función (support.microsoft.com, es-es).
