require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - LOPJ art.84.2 Tribunales de Instancia estructura
  const exp1 = `**Articulo 84.2 de la LOPJ:**

> "Los Tribunales de Instancia estaran integrados por una **Seccion Unica, de Civil y de Instruccion**. En los supuestos determinados por la Ley 38/1988, de 28 de diciembre, de Demarcacion y de Planta Judicial, el Tribunal de Instancia se integrara por una **Seccion Civil** y otra **Seccion de Instruccion**."

**Por que B es correcta:**
El art. 84.2 LOPJ establece dos formulas organizativas basicas para los Tribunales de Instancia:
1. **Seccion Unica** de Civil y de Instruccion (un solo organo que conoce de ambas materias)
2. **Dos Secciones separadas**: una Civil y otra de Instruccion (cuando la carga de trabajo lo justifica segun la Ley de Demarcacion)

La opcion B recoge fielmente ambas posibilidades.

**Por que las demas son incorrectas:**

- **A)** "Una Seccion de Civil y de Instruccion y otra Seccion de lo **Penal**". Falso: la estructura basica obligatoria NO incluye una Seccion de lo Penal. Lo Penal es una seccion **adicional posible** (art. 84.2, letra e), pero no forma parte de la estructura basica. La base es siempre Civil + Instruccion.

- **C)** "Una Seccion Unica, de Civil y de lo **Contencioso-Administrativo**". Falso: la Seccion Unica combina **Civil e Instruccion**, no Civil y Contencioso-Administrativo. Lo Contencioso-Administrativo es una seccion adicional posible (letra h), pero no forma parte de la estructura basica.

- **D)** "Una Seccion de Civil y de Instruccion y otra Seccion de **Violencia sobre la Mujer**". Falso: Violencia sobre la Mujer es una seccion adicional posible (letra c), pero no forma parte de la estructura obligatoria. La estructura basica es Civil + Instruccion, no Civil + Violencia.

**Estructura de los Tribunales de Instancia (art. 84.2 LOPJ):**
- **Base obligatoria:** Seccion Unica (Civil + Instruccion) O dos Secciones (Civil + Instruccion)
- **Secciones adicionales posibles:** Familia, Mercantil, Violencia sobre la Mujer, Penal, Menores, Contencioso-Administrativo, Social, etc.

**Clave:** La base siempre es Civil + Instruccion (juntas o separadas). Las demas opciones confunden secciones adicionales con la estructura basica.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b4cec9c6-0131-4874-8345-c3865dead29f");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - LOPJ art.84 Tribunales Instancia (" + exp1.length + " chars)");
})();
