require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Saltos de seccion y encabezados diferentes en Word:**

Para tener un encabezado diferente en cada parte de un documento, es necesario dividirlo en **secciones** mediante **saltos de seccion**. Cada seccion puede tener su propia configuracion de encabezados, margenes, orientacion, etc.

**Por que C es correcta:**
Los **saltos de seccion** (ficha Disposicion > Saltos) dividen el documento en bloques independientes. Despues de insertar un salto de seccion, se desactiva "Vincular al anterior" en la ficha Encabezado y pie de pagina, y cada seccion puede tener un encabezado distinto.

**Por que las demas son incorrectas:**

- **A)** "Saltos de pagina". Un salto de pagina solo fuerza el inicio de una nueva pagina, pero **no crea una seccion nueva**. Sin seccion nueva, no se puede tener un encabezado diferente. El encabezado se mantiene igual en todas las paginas de la misma seccion.

- **B)** "Configuracion de margenes". Los margenes definen el espacio entre el texto y los bordes de la pagina. No tienen relacion con la creacion de encabezados diferentes. Se pueden cambiar por seccion, pero primero hay que crear las secciones.

- **D)** "Encabezado vinculado". Esta opcion no existe como tal en el menu Disposicion. Lo que existe es "Vincular al anterior" dentro de las herramientas de encabezado, y precisamente hay que **desactivarla** para tener encabezados diferentes. Ademas, la vinculacion es una propiedad del encabezado, no una herramienta de Disposicion.

**Proceso completo para encabezados diferentes:**
1. Insertar salto de seccion (Disposicion > Saltos > Pagina siguiente)
2. Doble clic en el encabezado de la nueva seccion
3. Desactivar "Vincular al anterior"
4. Editar el encabezado de la nueva seccion`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "c2009e7e-120a-4072-baa0-79b8fcbd47b6");
  if (error) console.error("Error:", error);
  else console.log("OK - Word saltos seccion encabezados (" + explanation.length + " chars)");
})();
