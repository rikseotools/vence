require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Word 365 Ctrl+M formato fuente (version espanola)
  const exp1 = `**Atajos de teclado en Microsoft Word 365 (version espanola):**

> **Ctrl + M** = Abrir el cuadro de dialogo **Formato > Fuente** (en la version espanola de Word).

**Por que A es correcta:**
En la version **espanola** de Word 365, el atajo para abrir el menu Formato Fuente es **Ctrl + M**. Este atajo permite cambiar el tipo de fuente, tamano, estilo, color, efectos, espaciado, etc.

**Nota importante:** En la version **inglesa** de Word el atajo equivalente es Ctrl + D. Los atajos varian segun el idioma de la instalacion de Office.

**Por que las demas son incorrectas:**

- **B)** "Ctrl + S". Este atajo no abre el formato de fuente. **Ctrl + S** equivale a **Guardar** el documento (Save). En la version espanola, Guardar tambien puede ser Ctrl + G en algunas versiones.

- **C)** "Ctrl + F". Este atajo no abre el formato de fuente. **Ctrl + F** abre el panel de **Buscar** (Find) para buscar texto dentro del documento.

- **D)** "Ctrl + N". Este atajo no abre el formato de fuente. **Ctrl + N** aplica formato de **negrita** al texto seleccionado (en la version espanola). En la version inglesa, Ctrl + N crea un nuevo documento.

**Atajos frecuentes en Word (version espanola):**
| Atajo | Funcion |
|-------|---------|
| **Ctrl + M** | Formato Fuente |
| Ctrl + N | Negrita |
| Ctrl + K | Cursiva |
| Ctrl + S | Subrayado / Guardar |
| Ctrl + F | Buscar |`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "df5e6b1b-c207-4c5f-94ac-5588ec563ec4");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Word Ctrl+M fuente (" + exp1.length + " chars)");

  // #2 - Word tabla de ilustraciones excluir imagen
  const exp2 = `**Tabla de ilustraciones en Microsoft Word 365:**

> Word genera la tabla de ilustraciones automaticamente a partir de todos los elementos que tengan un **titulo** (leyenda) creado con "Insertar titulo". Si un elemento tiene titulo, **aparecera obligatoriamente** en la tabla.

**Por que D es correcta:**
La unica forma de **excluir** una imagen concreta de la tabla de ilustraciones es **eliminar su titulo** (leyenda). Word no ofrece ninguna opcion para mantener el titulo visible y al mismo tiempo excluir ese elemento de la tabla. Es un sistema de "todo o nada": con titulo, aparece; sin titulo, no.

**Por que las demas son incorrectas:**

- **A)** "Word no permite excluir elementos individuales si tienen titulo". Es parcialmente cierto (no puedes excluirlos **manteniendo** el titulo), pero la pregunta tiene solucion: eliminar el titulo. La opcion A sugiere que no hay solucion posible, lo cual es falso.

- **B)** "Opciones de la tabla marcando 'Excluir por categoria'". Falso: no existe la opcion "Excluir por categoria" en el cuadro de dialogo de tabla de ilustraciones de Word. Las opciones disponibles son filtrar por **etiqueta de titulo** (Ilustracion, Tabla, Ecuacion), no excluir elementos individuales.

- **C)** "Ocultando el texto del titulo en blanco". Falso: aunque ocultes o pongas en blanco el texto del titulo, Word seguira detectando la marca de campo del titulo y lo incluira en la tabla (posiblemente como entrada vacia).

**Clave:** Sin titulo = no aparece en la tabla de ilustraciones. Es la unica forma de excluir un elemento concreto.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "1b9e6973-00af-4d33-99fc-1402fb6c2b1e");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Word tabla ilustraciones (" + exp2.length + " chars)");
})();
