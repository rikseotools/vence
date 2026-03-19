require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.29.2 derecho petición FFAA solo individualmente
  const exp1 = `**Articulo 29 de la Constitucion Espanola - Derecho de peticion:**

> Art. 29.1: "Todos los espanoles tendran el derecho de peticion **individual y colectiva**, por escrito, en la forma y con los efectos que determine la ley."
>
> Art. 29.2: "Los miembros de las **Fuerzas o Institutos armados** o de los Cuerpos sometidos a **disciplina militar** podran ejercer este derecho **solo individualmente** y con arreglo a lo dispuesto en su legislacion especifica."

**Por que A es correcta (FFAA solo individualmente):**
El art. 29.2 CE establece una restriccion especifica: los miembros de las Fuerzas Armadas, Institutos armados o Cuerpos sometidos a disciplina militar solo pueden ejercer el derecho de peticion de forma **individual**, no colectiva. Esta limitacion se justifica por la especial sujecion de estos colectivos a la disciplina militar, que impide las peticiones colectivas para evitar presiones de grupo.

**Por que las demas son incorrectas (no tienen esta restriccion):**

- **B)** "Los **funcionarios publicos**." Falso: los funcionarios publicos ejercen el derecho de peticion en las mismas condiciones que cualquier ciudadano (individual y colectivamente). El art. 29.2 solo restringe a los sometidos a disciplina militar, no a los funcionarios civiles.

- **C)** "Los **miembros del Gobierno**." Falso: los miembros del Gobierno no tienen ninguna restriccion especifica sobre el derecho de peticion en el art. 29 CE. Ademas, como ciudadanos, pueden ejercerlo individual y colectivamente.

- **D)** "Las personas que ostenten la condicion de **cargos publicos**." Falso: los cargos publicos en general no tienen restriccion en el ejercicio del derecho de peticion. La limitacion del art. 29.2 se aplica exclusivamente a los sometidos a disciplina militar.

**Derecho de peticion (art. 29 CE):**

| Colectivo | Individual | Colectiva |
|-----------|-----------|-----------|
| Ciudadanos en general | **Si** | **Si** |
| Funcionarios publicos | **Si** | **Si** |
| **FFAA / disciplina militar** | **Si** | **No** |

**Clave:** Solo los miembros de FFAA y Cuerpos de disciplina militar tienen restringido el derecho de peticion a la forma individual (art. 29.2 CE). El resto de ciudadanos pueden ejercerlo individual y colectivamente.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "538cc362-4f4a-4828-8bda-6268be5f0ed9");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.29 peticion FFAA individual (" + exp1.length + " chars)");
})();
