# Interfaz y cinta de opciones de Word 2016

Microsoft **Word** es el procesador de textos del paquete **Microsoft Office**: una herramienta más de la suite, junto a Excel, PowerPoint, Access u Outlook. Su archivo ejecutable se llama **`Winword.exe`**.

---

## 1. Elementos de la ventana

| Elemento | Qué contiene |
|---|---|
| **Barra de título** | el nombre del documento y el de la aplicación |
| **Barra de herramientas de acceso rápido** | la barra pequeña que aparece **encima de la cinta de opciones** de forma predeterminada, con Guardar, Deshacer y Rehacer. Es **personalizable** (se le añaden comandos) y puede moverse debajo de la cinta |
| **Cinta de opciones** (*ribbon*) | las fichas con todos los comandos, organizados en grupos |
| **Reglas** | horizontal y vertical |
| **Barra de estado** | página actual, número de páginas y palabras, idioma, vistas y zoom |
| **Barras de desplazamiento** | vertical y horizontal |

---

## 2. La cinta de opciones

Fichas fijas de Word 2016: **Archivo, Inicio, Insertar, Diseño, Disposición, Referencias, Correspondencia, Revisar y Vista**. Además aparecen **fichas contextuales** cuando se selecciona un objeto (por ejemplo *Herramientas de tabla ▸ Diseño y Presentación*).

| Ficha | Grupos principales |
|---|---|
| **Inicio** | Portapapeles · Fuente · Párrafo · Estilos · Edición (Buscar, Reemplazar, Seleccionar) |
| **Insertar** | Páginas · Tablas · Ilustraciones · Vínculos · Comentarios · Encabezado y pie de página · Texto · Símbolos |
| **Diseño** | Formato del documento (temas, estilos) · **Fondo de página** (marca de agua, color de página, bordes de página) |
| **Disposición** | Configurar página (márgenes, orientación, tamaño, columnas, saltos) · Párrafo · Organizar |
| **Referencias** | **Tabla de contenido** · **Notas al pie** · **Citas y bibliografía** · Títulos · Índice · Tabla de autoridades |
| **Correspondencia** | Crear (sobres y etiquetas) · Iniciar combinación de correspondencia · Escribir e insertar campos · Finalizar |
| **Revisar** | **Revisión** (Ortografía y gramática, **Contar palabras**, **Sinónimos**) · Idioma · Comentarios · **Seguimiento** · Cambios · Comparar · Proteger |
| **Vista** | Vistas · Mostrar (**Regla**, Líneas de cuadrícula, **Panel de navegación**) · **Zoom** · **Ventana** (Nueva ventana, Organizar todo, **Dividir**) · Macros |

Puntos que se preguntan a menudo:

- **La Tabla de contenido está en Referencias**, no en Insertar ni en Vista.
- **Administrar fuentes** está en **Referencias ▸ grupo Citas y bibliografía**, junto a Insertar cita, Estilo y Bibliografía.
- **El Panel de navegación se activa en Vista ▸ grupo Mostrar** (también desde Buscar).
- **Contar palabras está en Revisar ▸ grupo Revisión** (la barra de estado también muestra el recuento).
- **Sinónimos** está igualmente en **Revisar ▸ Revisión**: es la herramienta para **no repetir una palabra** y sustituirla por otra de significado parecido. Alternativa: clic derecho sobre la palabra ▸ Sinónimos.

### 2.1 Grupo Mostrar (ficha Vista)

Casillas que activan u ocultan elementos: **Regla**, Líneas de cuadrícula y Panel de navegación. Al marcar **Regla** se muestran **la regla horizontal y también la vertical** (esta última solo en la vista Diseño de impresión).

### 2.2 Grupo Zoom y grupo Ventana (ficha Vista)

- **Una página**, **Varias páginas** y **Ancho de página**. Para **ver dos o más páginas a la vez** en pantalla, la opción es **Varias páginas**.
- **Nueva ventana** abre otra ventana del mismo documento; **Organizar todo** las coloca; **Dividir** parte **la ventana del documento en dos paneles**, cada uno con su desplazamiento, para trabajar sobre dos zonas alejadas del mismo documento.

---

## 3. La ficha Archivo (vista Backstage)

No es una ficha más: ocupa toda la pantalla y agrupa lo que se hace *con* el documento, no *dentro* de él.

| Sección | Contenido |
|---|---|
| **Información** | propiedades, **Proteger documento**, **Comprobar si hay problemas** (Inspeccionar documento), **Administrar documento** (versiones y recuperación) |
| **Nuevo** | documento en blanco y **plantillas**. La ruta para llegar a las plantillas es **Archivo ▸ Nuevo** |
| **Abrir** | recientes, OneDrive, este equipo |
| **Guardar** y **Guardar como** | ubicación, nombre y **tipo de archivo** |
| **Imprimir** | vista previa y configuración |
| **Exportar** | crear PDF/XPS, cambiar el tipo de archivo |
| **Opciones** | configuración general de Word |

### 3.1 Guardar y Guardar como

Al usar **Guardar como** por primera vez, Word permite elegir **la ubicación, el nombre del archivo y el formato**, y además crear carpetas desde el propio cuadro: todas esas posibilidades conviven en el mismo diálogo.

**Cuando se modifica una plantilla y se quiere conservar también la original**, lo que hay que cambiar es el **nombre del archivo** al guardarla: si se mantiene el nombre, la nueva versión sustituye a la anterior.

En **Archivo ▸ Opciones ▸ Guardar** se configura, entre otras cosas, **el formato en el que se guardan los documentos de forma predeterminada**, la carpeta por defecto y cada cuántos minutos se guarda la información de Autorrecuperación.

### 3.2 Formatos y extensiones

| Extensión | Qué es |
|---|---|
| **`.docx`** | **documento de Word, formato predeterminado desde Word 2007** (XML comprimido) |
| `.docm` | documento **habilitado para macros** |
| `.doc` | formato binario de Word 97-2003 |
| **`.dotx`** | **plantilla sin macros** |
| **`.dotm`** | **plantilla que puede contener y ejecutar macros VBA** — esa es exactamente la diferencia con `.dotx` |
| `.pdf`, `.rtf`, `.txt`, `.odt`, `.xps` | formatos de exportación e intercambio |

### 3.3 Abrir un documento

En el cuadro **Abrir** se puede navegar por las carpetas o **escribir directamente el nombre del documento en el campo «Nombre de archivo»**, que admite además rutas completas.

### 3.4 Recuperar y versiones

En **Archivo ▸ Información ▸ Administrar documento** están las versiones guardadas por Autorrecuperación y la opción **Recuperar documentos sin guardar**. La opción **Versión ▸ Restaurar** **devuelve el documento a una versión anterior**, sustituyendo la actual (Word ofrece guardar antes una copia).

### 3.5 Inspeccionar documento

**Archivo ▸ Información ▸ Comprobar si hay problemas ▸ Inspeccionar documento** busca y permite eliminar **metadatos e información oculta**: autor, comentarios, revisiones, propiedades del documento, texto oculto, encabezados y pies. Es el paso previo recomendado antes de distribuir un archivo.

### 3.6 Proteger documento

Desde **Archivo ▸ Información ▸ Proteger documento**: marcar como final, cifrar con contraseña, **Restringir edición**, restringir el acceso y agregar firma digital.

- La ruta completa para limitar qué puede modificarse es **Archivo ▸ Información ▸ Proteger documento ▸ Restringir edición**.
- **Para que un usuario no pueda desactivar el control de cambios hay que proteger el documento**: en Restringir edición se elige «Cambios controlados» y se establece una contraseña (equivale a *Revisar ▸ Control de cambios ▸ Bloquear seguimiento*). Sin protección, cualquiera puede apagar el seguimiento.

---

## 4. Impresión

En **Archivo ▸ Imprimir** se elige impresora, número de copias, intervalo y configuración. El desplegable de intervalo ofrece: Imprimir todas las páginas, Imprimir selección, Imprimir página actual y **Impresión personalizada**, que es la opción con la que **se imprime un intervalo concreto de páginas** (por ejemplo `2-5;8`).

---

## 5. Edición básica

- **Para eliminar varias palabras a la vez**: **seleccionarlas y pulsar la tecla `Supr`**. Con `Ctrl+Retroceso` se borra la palabra anterior y con `Ctrl+Supr` la siguiente, pero de una en una.
- **Portapapeles múltiple**: el panel del grupo Portapapeles (ficha Inicio) almacena **hasta 24 elementos** copiados, permite pegarlos individualmente, **Pegar todo** y **Borrar todo**, y funciona **compartido entre las aplicaciones de Office**.

### 5.1 Buscar con caracteres comodín

Activando **«Usar caracteres comodín»** en Buscar avanzado, el patrón admite operadores:

| Comodín | Significado |
|---|---|
| **`<`** | los caracteres indicados deben estar **al PRINCIPIO de la palabra**. `<ba` encuentra *banco* o *barco*, pero no *aba* |
| **`>`** | los caracteres deben estar **al final** de la palabra |
| `?` | un carácter cualquiera |
| `*` | cualquier secuencia de caracteres |
| `[ ]` | uno de los caracteres del conjunto |
| `{n;m}` | número de repeticiones |

---

## 6. Notas al pie y notas al final

Se insertan desde **Referencias ▸ grupo Notas al pie**. El **iniciador de cuadro de diálogo del grupo** (la flecha de su esquina inferior derecha, el **botón desplegable del comando «Notas al pie»**) abre las opciones donde se decide **dónde aparece la nota**: la nota al final puede situarse **al final del documento o al final de la sección**, y ahí se cambia también el formato de numeración.

---

## 7. Comentarios y control de cambios

- Los comentarios se insertan desde **Revisar ▸ Nuevo comentario** (o Insertar ▸ Comentario).
- **Word admite el solapamiento**: se puede comentar una palabra que ya está dentro de otro comentario, y los comentarios quedan **anidados/superpuestos**, mostrándose ambos globos.
- El **Control de cambios** (Revisar ▸ Seguimiento) registra inserciones, eliminaciones y cambios de formato.

---

## 8. Macros

- **Vista ▸ Macros** contiene **Ver macros** y **Grabar macro**. El botón **«Grabar macro»** **inicia la grabación de las acciones** que se realicen a continuación, **para automatizarlas** y poder repetirlas después.
- **Habilitar o deshabilitar las macros** se hace en **Archivo ▸ Opciones ▸ Centro de confianza ▸ Configuración del Centro de confianza ▸ Configuración de macros**.
- Los archivos que guardan macros son `.docm` (documento) y **`.dotm`** (plantilla).

---

## 9. Herramientas de aprendizaje (vista inmersiva)

Word 2016 incorpora **Herramientas de aprendizaje**, la lectura inmersiva. Además del color de página y el enfoque de línea, **permite modificar el ancho de columna, el tamaño y el espaciado del texto** para facilitar la lectura, y leer el documento en voz alta. Es una ayuda de lectura: **no modifica el documento guardado**.

---

## 10. Diferencias con Word 365

Word 2016 **no tiene** coautoría en tiempo real, ni @menciones, ni la ficha **Dibujar**, ni las funciones basadas en IA. La caja **«¿Qué desea hacer?»** (*Tell me*) sí se introdujo en 2016, pero es un buscador de comandos, no un asistente inteligente.

> ⚠️ **Cuidado con trasladar nombres de Word 365 a Word 2016.** Varias fichas cambiaron de nombre entre versiones — el caso típico es la ficha contextual de tabla, que en **Word 2016 se llama «Presentación»** y pasó a llamarse «Disposición» en versiones posteriores.
