require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.4 principios intervencion proporcionalidad vs jerarquia
  const exp1 = `**Articulo 4.1 de la Ley 40/2015:**

> "Las Administraciones Publicas que [...] establezcan medidas que limiten el ejercicio de derechos individuales o colectivos [...] deberan aplicar el principio de **proporcionalidad** y elegir la medida menos restrictiva, **motivar** su necesidad para la proteccion del interes publico asi como **justificar** su adecuacion para lograr los fines que se persiguen, sin que en ningun caso se produzcan diferencias de trato discriminatorias. Asimismo deberan **evaluar periodicamente** los efectos y resultados obtenidos."

**Por que D es la incorrecta (y por tanto la respuesta):**
La opcion D dice "aplicar el principio de **jerarquia normativa**". Pero el art. 4.1 dice "aplicar el principio de **proporcionalidad**". La trampa es sustituir "proporcionalidad" por "jerarquia normativa". Son principios completamente distintos:
- **Proporcionalidad**: la medida restrictiva debe ser proporcionada al fin perseguido
- **Jerarquia normativa**: las normas de rango inferior no pueden contradecir las de rango superior (es un principio del art. 9.3 CE, no del art. 4 Ley 40/2015)

**Por que las demas SI estan en el art. 4.1:**

- **A)** "Motivar su necesidad para la proteccion del interes publico". **SI**: el art. 4.1 exige expresamente la motivacion de la necesidad.

- **B)** "Justificar su adecuacion [...] sin diferencias de trato discriminatorias". **SI**: el art. 4.1 exige justificar la adecuacion y prohibe la discriminacion.

- **C)** "Evaluar periodicamente los efectos y resultados obtenidos". **SI**: el art. 4.1 incluye la evaluacion periodica como obligacion.

**Obligaciones del art. 4.1 Ley 40/2015:**
1. Principio de **proporcionalidad** + medida menos restrictiva
2. **Motivar** necesidad para interes publico
3. **Justificar** adecuacion + no discriminacion
4. **Evaluar** periodicamente resultados

**Clave:** "Proporcionalidad" (no "jerarquia normativa"). La trampa cambia un principio por otro que suena igualmente juridico pero es de otro ambito.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "82b80fe8-6670-4e71-8847-6fba19f133bc");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 proporcionalidad (" + exp1.length + " chars)");
})();
