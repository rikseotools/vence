require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Windows 11 Ctrl+N nueva ventana explorador
  const exp1 = `**Atajos de teclado en el Explorador de Archivos de Windows 11:**

**Por que B es correcta (Ctrl + N):**
**Ctrl + N** abre una **nueva ventana** del Explorador de Archivos. Es el atajo estandar en Windows para abrir una nueva ventana en la aplicacion activa (funciona tambien en navegadores y otras aplicaciones).

**Por que las demas son incorrectas (hacen otras cosas):**

- **A)** **Ctrl + T**: abre una **nueva pestana** (tab) en el Explorador de Archivos, no una nueva ventana. La diferencia es importante: la pestana se abre dentro de la misma ventana (funcion incorporada en Windows 11), mientras que Ctrl + N abre una ventana completamente nueva e independiente.

- **C)** **Ctrl + Shift + E**: **expande el panel de navegacion** (arbol de carpetas del lado izquierdo) hasta la carpeta actual. No abre una nueva ventana.

- **D)** **Windows + N**: abre el **panel de notificaciones** (centro de notificaciones y calendario). No tiene relacion con el Explorador de Archivos.

**Atajos del Explorador de Archivos (Windows 11):**

| Atajo | Funcion |
|-------|---------|
| **Ctrl + N** | **Nueva ventana** |
| Ctrl + T | Nueva pestana |
| Ctrl + W | Cerrar pestana/ventana actual |
| Ctrl + Shift + E | Expandir panel de navegacion |

**Clave:** Ctrl + N = nueva ventana. Ctrl + T = nueva pestana. No confundir ventana con pestana.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "170e0e8b-6e73-4e89-89a5-743518825d5f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Windows 11 Ctrl+N nueva ventana (" + exp1.length + " chars)");

  // #2 - Windows 11 F2 renombrar archivo
  const exp2 = `**Atajos de teclado de funcion en el Explorador de Archivos de Windows 11:**

**Por que B es correcta (F2):**
La tecla **F2** es el atajo universal en Windows para **renombrar** el archivo o carpeta seleccionado. Al pulsarla, el nombre del archivo queda editable y se puede escribir el nuevo nombre directamente.

**Por que las demas son incorrectas (realizan otras funciones):**

- **A)** **F5**: **Actualizar** (refrescar) la ventana del Explorador. Recarga el contenido de la carpeta actual para mostrar los cambios mas recientes. No tiene relacion con el cambio de nombre.

- **C)** **F3**: **Abrir la barra de busqueda** en el Explorador de Archivos. Permite buscar archivos y carpetas dentro de la ubicacion actual. No renombra.

- **D)** **ALT + F4**: **Cerrar la ventana activa**. Es el atajo universal de Windows para cerrar la aplicacion o ventana en primer plano. Es la opcion mas peligrosa de las cuatro: en vez de renombrar, cerraria el Explorador.

**Teclas de funcion en el Explorador (Windows 11):**

| Tecla | Funcion |
|-------|---------|
| **F2** | **Renombrar** archivo/carpeta seleccionado |
| F3 | Buscar en la ubicacion actual |
| F4 | Seleccionar barra de direcciones |
| F5 | Actualizar (refrescar) la ventana |
| ALT + F4 | Cerrar la ventana activa |

**Clave:** F2 = Renombrar. F5 = Actualizar. F3 = Buscar. ALT+F4 = Cerrar.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "ad187fbc-826c-4042-8da9-a9a92449d428");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Windows 11 F2 renombrar (" + exp2.length + " chars)");
})();
