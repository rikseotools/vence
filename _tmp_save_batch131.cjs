require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word convertir tabla a texto Disposicion de Tabla
  const exp1 = `**Convertir tabla en texto en Word 365:**

Los pasos correctos son:
> 1. **Seleccionar la tabla** que se quiere convertir
> 2. Hacer clic en **"Disposicion de Tabla"** en la cinta de opciones
> 3. Hacer clic en **"Convertir a texto"**
> 4. En el cuadro "Convertir tabla en texto", seccion **"Separadores"**, elegir **"puntos y comas"**
> 5. Hacer clic en "Aceptar"

**Por que B es correcta:**
La opcion "Convertir a texto" se encuentra en la pestana contextual **"Disposicion de Tabla"** (o "Layout" en ingles), que solo aparece cuando hay una tabla seleccionada. Esta pestana contiene herramientas especificas de tablas como filas, columnas, combinar celdas, formulas y conversion a texto.

**Por que las demas son incorrectas:**

- **A)** "Hacer clic en **Datos** de la cinta de opciones". Falso: no existe una pestana "Datos" en Word 365. "Datos" es una pestana de **Excel**, no de Word. La trampa mezcla elementos de dos programas de Office.

- **C)** "Hacer clic en **Datos** y en **Exportar datos CSV**". Falso: igual que en A, "Datos" no existe en Word. Ademas, "Exportar datos CSV" tampoco es una funcion de Word. CSV es un formato de datos tabulares, no un formato de procesador de texto. La opcion inventa funciones que no existen.

- **D)** "Hacer clic en **Insertar > Tabla > Convertir tabla en texto**". Falso: en "Insertar > Tabla" se encuentran opciones para **crear** tablas (insertar tabla, dibujar tabla, convertir texto en tabla), no para convertir tabla en texto. La opcion invierte la ruta: "Insertar" es para crear, "Disposicion de Tabla" es para modificar o convertir.

**Clave:** La ruta correcta es **Disposicion de Tabla > Convertir a texto**. No confundir con "Datos" (Excel) ni con "Insertar > Tabla" (crear tablas).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "557ddc62-ab17-407b-9ecc-8b8e5b510126");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word convertir tabla texto (" + exp1.length + " chars)");
})();
