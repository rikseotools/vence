require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.57 sucesion trono orden
  const exp1 = `**Articulo 57.1 de la Constitucion Espanola** (Sucesion en el trono):

> "La sucesion en el trono seguira el orden regular de primogenitura y representacion, siendo preferida siempre:
> 1o) La **linea anterior** a las posteriores;
> 2o) en la misma linea, el **grado mas proximo** al mas remoto;
> 3o) en el mismo grado, el **varon** a la mujer;
> 4o) en el mismo sexo, la persona de **mas edad** a la de menos."

**Por que D es correcta:**
La pregunta pide el **primer** requisito. El art. 57.1 establece una jerarquia de criterios, y el primero es "la **linea anterior** a las posteriores". Los demas criterios solo se aplican cuando no se puede resolver con el anterior.

**Por que las demas son incorrectas (no son el primer criterio):**

- **A)** "El varon a la mujer". Falso como primer criterio: es el **tercer** criterio, que solo se aplica "en el mismo grado". Antes esta la linea y el grado.

- **B)** "El grado mas proximo al mas remoto". Falso como primer criterio: es el **segundo** criterio, que solo se aplica "en la misma linea". Antes esta la preferencia de linea.

- **C)** "La persona de mas edad a la de menos". Falso como primer criterio: es el **cuarto** y ultimo criterio, que solo se aplica "en el mismo sexo".

**Orden jerarquico de la sucesion (art. 57.1):**
| Prioridad | Criterio | Se aplica cuando... |
|-----------|----------|---------------------|
| 1o | Linea anterior | Siempre |
| 2o | Grado mas proximo | En la misma linea |
| 3o | Varon sobre mujer | En el mismo grado |
| 4o | Mayor edad | En el mismo sexo |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "8b315170-7f51-4ce9-aa6d-6c96369fe942");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.57 sucesion trono (" + exp1.length + " chars)");

  // #2 - Windows Ctrl+Shift+E explorador
  const exp2 = `**Atajo de teclado en el Explorador de archivos de Windows:**

**Ctrl + Mayus + E** muestra todas las carpetas situadas **sobre** la carpeta seleccionada en el panel de navegacion (arbol de carpetas). Expande el arbol completo hasta llegar a la ubicacion actual.

**Por que B es correcta:**
El atajo Ctrl + Mayus + E expande la jerarquia de carpetas superiores en el panel de navegacion, mostrando la estructura completa desde la raiz hasta la carpeta actual. Es util para ver el contexto de donde te encuentras.

**Por que las demas son incorrectas:**

- **A)** "Alt + D". Este atajo selecciona la **barra de direcciones** del Explorador, no muestra carpetas superiores. Permite escribir una ruta directamente.

- **C)** "Ctrl + Mayus" (sin letra). Este atajo incompleto no tiene una funcion asignada por si solo en el Explorador de archivos. Necesita una tecla adicional para ejecutar una accion.

- **D)** "Ctrl + rueda del raton". Este atajo cambia el **tamano de los iconos** en la vista de archivos (los hace mas grandes o mas pequenos), no tiene relacion con mostrar carpetas superiores.

**Atajos utiles del Explorador:**
| Atajo | Funcion |
|-------|---------|
| **Ctrl + Mayus + E** | Expandir arbol hasta carpeta actual |
| Alt + D | Seleccionar barra de direcciones |
| Ctrl + rueda | Cambiar tamano de iconos |
| F11 | Maximizar/restaurar ventana |`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "9794127c-6aa9-456f-a319-298c81801e54");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Windows Ctrl+Shift+E explorador (" + exp2.length + " chars)");
})();
