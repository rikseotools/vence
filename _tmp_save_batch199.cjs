require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.53.2 recurso de amparo solo Sección 1ª + art.14
  const exp1 = `**Articulo 53.2 de la Constitucion Espanola - Recurso de amparo:**

> "Cualquier ciudadano podra recabar la tutela de las libertades y derechos reconocidos en el **articulo 14** y la **Seccion primera del Capitulo segundo** ante los Tribunales ordinarios [...] y, en su caso, a traves del **recurso de amparo** ante el Tribunal Constitucional."

**Por que D es correcta (derecho de participacion politica):**
El derecho de **participacion politica** esta en el art. 23 CE, que pertenece a la **Seccion 1.a del Capitulo II del Titulo I** (arts. 15-29: derechos fundamentales y libertades publicas). Al estar en esta Seccion, es susceptible de recurso de amparo ante el TC.

**Por que las demas NO son susceptibles de amparo (estan fuera de la Seccion 1.a):**

- **A)** "Derecho a la **negociacion colectiva**." Falso: el derecho a la negociacion colectiva esta en el art. **37** CE, que pertenece a la **Seccion 2.a** del Capitulo II (arts. 30-38: derechos y deberes de los ciudadanos). La Seccion 2.a **no** esta protegida por recurso de amparo.

- **B)** "Derecho a la **propiedad privada**." Falso: el derecho a la propiedad privada esta en el art. **33** CE, tambien en la **Seccion 2.a** del Capitulo II. No es amparable.

- **C)** "Derecho al **trabajo**." Falso: el derecho al trabajo esta en el art. **35** CE, en la **Seccion 2.a** del Capitulo II. No es amparable ante el TC.

**Proteccion de los derechos segun su ubicacion en la CE:**

| Ubicacion | Articulos | Proteccion |
|-----------|-----------|-----------|
| Art. 14 + **Seccion 1.a** | **14-29** | **Recurso de amparo** + procedimiento preferente |
| Seccion 2.a | 30-38 | Reserva de ley (no amparo) |
| Capitulo III (principios rectores) | 39-52 | Informan legislacion (no amparo) |

**Clave:** Solo son amparables los derechos del art. 14 y la Seccion 1.a (arts. 15-29). La participacion politica (art. 23) esta dentro; la negociacion colectiva (37), la propiedad (33) y el trabajo (35) estan fuera.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "ea3c4d4b-061c-45e3-be2c-98c758cd4241");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.53.2 amparo participacion (" + exp1.length + " chars)");

  // #2 - CE art.22.4 disolución asociaciones solo resolución judicial motivada
  const exp2 = `**Articulo 22.4 de la Constitucion Espanola - Disolucion de asociaciones:**

> "Las asociaciones **solo** podran ser disueltas o suspendidas en sus actividades en virtud de **resolucion judicial motivada**."

**Por que A es correcta (resolucion judicial motivada):**
El art. 22.4 CE establece una **reserva jurisdiccional** absoluta: las asociaciones solo pueden disolverse o suspenderse por decision de un juez, y ademas esa decision debe estar **motivada** (explicar las razones). La Administracion **no** puede disolver asociaciones; es una garantia del derecho fundamental de asociacion.

**Por que las demas son incorrectas:**

- **B)** "Mediante **autorizacion de la autoridad**." Falso: la autoridad administrativa no tiene potestad para disolver ni suspender asociaciones. Solo los tribunales pueden hacerlo. Si la Administracion pudiera disolver asociaciones, el derecho de asociacion quedaria desprotegido frente al poder ejecutivo.

- **C)** "En virtud de resolucion judicial **o mediante autorizacion de la autoridad competente**." Falso: el art. 22.4 dice "**solo** en virtud de resolucion judicial motivada". No existe la alternativa de autorizacion administrativa. La palabra "solo" excluye cualquier otra via.

- **D)** "En virtud de **mandamiento judicial**." Falso: el art. 22.4 dice "**resolucion** judicial **motivada**", no "mandamiento judicial". Un mandamiento es una orden especifica (como un mandamiento de entrada y registro), mientras que una resolucion motivada es una decision razonada del juez. Ademas, la opcion D omite el requisito de que sea "motivada".

**Art. 22 CE - Asociaciones:**

| Apartado | Contenido |
|----------|-----------|
| 22.1 | Derecho de asociacion |
| 22.2 | Fines delictivos = ilegales |
| 22.3 | Inscripcion (solo publicidad) |
| **22.4** | **Disolucion solo por resolucion judicial motivada** |
| 22.5 | Prohibicion: secretas y paramilitares |

**Clave:** "Solo" resolucion judicial "motivada". No cabe disolucion administrativa ni por mandamiento. La garantia jurisdiccional es absoluta.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "abc2c60a-013a-4bc8-8011-cd2e2e7970b7");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.22.4 disolucion judicial (" + exp2.length + " chars)");
})();
