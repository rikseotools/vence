require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.111 interpelaciones tiempo mínimo semanal por Reglamento
  const exp1 = `**Articulo 111.1 de la Constitucion Espanola - Interpelaciones y preguntas:**

> "El Gobierno y cada uno de sus miembros estan sometidos a las interpelaciones y preguntas que se le formulen en las Camaras. Para esta clase de debate los **Reglamentos** estableceran un **tiempo minimo semanal**."

**Por que A es correcta (por Reglamento):**
El art. 111.1 CE remite a los **Reglamentos** de las Camaras (Reglamento del Congreso y Reglamento del Senado) la determinacion del tiempo minimo semanal dedicado a interpelaciones y preguntas al Gobierno. Son los Reglamentos parlamentarios los que organizan la actividad de las Camaras.

**Por que las demas son incorrectas:**

- **B)** "Por **Ley de las Cortes**." Falso: el art. 111.1 dice "los Reglamentos", no una ley. Los Reglamentos de las Camaras tienen naturaleza especial (no son leyes stricto sensu) y regulan la organizacion interna del Parlamento. No se requiere una ley para fijar el tiempo de debates.

- **C)** "Mediante **acuerdo de la Camara** respectiva." Falso: el art. 111.1 habla de "los Reglamentos", no de acuerdos puntuales de las Camaras. Un acuerdo de la Camara es una decision puntual, mientras que el Reglamento es la norma permanente que regula el funcionamiento parlamentario.

- **D)** "Mediante acuerdo de la **Mesa del Congreso**." Falso: la Mesa del Congreso organiza el trabajo parlamentario, pero el art. 111.1 reserva la determinacion del tiempo minimo a los Reglamentos, no a los acuerdos de la Mesa.

**Art. 111 CE:**
- El Gobierno se somete a interpelaciones y preguntas
- Los Reglamentos fijan el **tiempo minimo semanal**
- Las interpelaciones pueden dar lugar a una **mocion** (art. 111.2)

**Clave:** El tiempo minimo para interpelaciones y preguntas se fija en los **Reglamentos** parlamentarios, no por ley, ni por acuerdo de la Camara, ni por la Mesa.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "54f6f5b7-2710-4d8b-9d6c-c6661b3a0dd5");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.111 interpelaciones (" + exp1.length + " chars)");

  // #2 - CE art.27.4 enseñanza básica obligatoria y gratuita
  const exp2 = `**Articulo 27.4 de la Constitucion Espanola - Derecho a la educacion:**

> "La ensenanza basica es **obligatoria** y **gratuita**."

**Por que A es correcta (obligatoria y gratuita):**
El art. 27.4 CE establece dos caracteristicas de la ensenanza basica: es **obligatoria** (los padres o tutores deben escolarizar a los menores) y **gratuita** (el Estado garantiza que no tenga coste en los centros publicos). Actualmente, la ensenanza basica abarca de los 6 a los 16 anos (Educacion Primaria y ESO).

**Por que las demas son incorrectas:**

- **B)** "**Voluntaria** y gratuita." Falso: acierta en "gratuita" pero falla en "voluntaria". La ensenanza basica es **obligatoria**, no voluntaria. Los padres no pueden elegir no escolarizar a sus hijos en la etapa basica.

- **C)** "Obligatoria y **de pago**." Falso: acierta en "obligatoria" pero falla en "de pago". La CE garantiza que sea **gratuita**, no de pago. El Estado asume el coste de la educacion basica en centros publicos.

- **D)** "**Voluntaria** y **de pago**." Falso: ambos terminos son incorrectos. Ni es voluntaria (es obligatoria) ni es de pago (es gratuita). Es la opcion mas alejada del texto constitucional.

**Art. 27 CE - Derecho a la educacion (puntos principales):**

| Apartado | Contenido |
|----------|-----------|
| 27.1 | Derecho a la educacion + libertad de ensenanza |
| 27.2 | Objeto: pleno desarrollo de la personalidad |
| 27.3 | Derecho de los padres a la formacion religiosa/moral |
| **27.4** | **Ensenanza basica: obligatoria y gratuita** |
| 27.5 | Poderes publicos garantizan el derecho a la educacion |
| 27.6 | Libertad de creacion de centros docentes |

**Clave:** Ensenanza basica = obligatoria + gratuita. Dos palabras clave que no admiten variacion: ni voluntaria ni de pago.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "c83b7e92-9228-4275-9e14-db5e55ba6109");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.27.4 ensenanza (" + exp2.length + " chars)");
})();
