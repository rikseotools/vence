require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const explanation = `**Articulo 143.1 de la Constitucion Espanola** (Acceso al autogobierno):

> **143.1:** "Las provincias limitrofes con caracteristicas historicas, culturales y economicas comunes, los territorios insulares y las provincias con entidad regional historica podran acceder a su autogobierno y constituirse en Comunidades Autonomas con arreglo a lo previsto en **este Titulo** y en los respectivos **Estatutos**."

"Este Titulo" se refiere al **Titulo VIII** de la CE ("De la Organizacion Territorial del Estado", arts. 137-158).

**Por que D es correcta:**
El art. 143.1 dice "este Titulo" (VIII) y "los respectivos Estatutos". La opcion D reproduce esto correctamente: Titulo VIII de la CE y los Estatutos.

**Por que las demas son incorrectas:**

- **A)** "Exclusivamente en sus respectivos Estatutos". Falso: el articulo menciona DOS fuentes: el Titulo VIII de la CE **y** los Estatutos. No es exclusivamente en los Estatutos.

- **B)** "Titulo VI de la CE". Falso: el Titulo VI regula el **Poder Judicial** (arts. 117-127), no la organizacion territorial. La organizacion territorial es el Titulo VIII.

- **C)** "Titulo VII de la CE". Falso: el Titulo VII regula la **Economia y Hacienda** (arts. 128-136), no la organizacion territorial.

**Estructura de Titulos de la CE (para no confundirlos):**

| Titulo | Contenido | Articulos |
|--------|-----------|-----------|
| VI | Poder Judicial | 117-127 |
| VII | Economia y Hacienda | 128-136 |
| **VIII** | **Organizacion Territorial del Estado** | **137-158** |`;

  const { error } = await supabase.from("questions").update({ explanation }).eq("id", "9f5251bc-451c-4e00-a950-8ce75e8e847b");
  if (error) console.error("Error:", error);
  else console.log("OK - CE art.143.1 acceso autogobierno (" + explanation.length + " chars)");
})();
