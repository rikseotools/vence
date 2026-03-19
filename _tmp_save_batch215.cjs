require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE art.53.2 recurso de amparo libertad de cátedra
  const exp1 = `**Articulo 53.2 de la Constitucion Espanola - Recurso de amparo:**

> "Cualquier ciudadano podra recabar la tutela de las libertades y derechos reconocidos en el **articulo 14** y la **Seccion primera del Capitulo segundo** (arts. 15-29) ante los Tribunales ordinarios [...] y, en su caso, a traves del **recurso de amparo** ante el Tribunal Constitucional."

**Por que D es correcta (libertad de catedra):**
La **libertad de catedra** esta reconocida en el art. **20.1.c)** CE, que se encuentra dentro de la Seccion 1.a del Capitulo 2.o del Titulo I (arts. 15-29). Por tanto, esta protegida por el recurso de amparo ante el TC segun el art. 53.2 CE.

**Por que las demas son incorrectas (estan en la Seccion 2.a, sin amparo):**

- **A)** "El **derecho de fundacion**." Falso: el derecho de fundacion esta en el art. **34** CE, que pertenece a la Seccion **2.a** del Capitulo 2.o (arts. 30-38). Los derechos de la Seccion 2.a no son susceptibles de amparo ante el TC.

- **B)** "La **libertad de empresa** en el marco de la economia de mercado." Falso: la libertad de empresa esta en el art. **38** CE, tambien en la Seccion 2.a. No tiene proteccion via amparo constitucional.

- **C)** "El derecho a adoptar medidas de **conflicto colectivo**." Falso: este derecho esta en el art. **37.2** CE, igualmente en la Seccion 2.a. No es susceptible de amparo ante el TC.

**Proteccion de derechos segun su ubicacion en la CE:**

| Ubicacion | Articulos | Amparo TC | Ejemplo |
|-----------|-----------|-----------|---------|
| Art. 14 | Igualdad | **Si** | Igualdad ante la ley |
| **Seccion 1.a** | **15-29** | **Si** | **Libertad de catedra (art. 20)** |
| Seccion 2.a | 30-38 | **No** | Fundacion (34), empresa (38), conflicto colectivo (37) |

**Clave:** Solo los derechos del art. 14 y arts. 15-29 (Seccion 1.a) + objecion de conciencia (art. 30) tienen amparo ante el TC. La libertad de catedra (art. 20) esta en la Seccion 1.a, los demas estan en la Seccion 2.a.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "3900bee0-1917-435c-9b1d-f5a8e52127be");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE art.53.2 amparo catedra (" + exp1.length + " chars)");

  // #2 - Ley 4/2023 art.42 turismo LGTBI respuesta INCORRECTA
  const exp2 = `**Articulo 42 de la Ley 4/2023 - Promocion del turismo LGTBI:**

> Art. 42: "Las Administraciones publicas, en el ambito de sus competencias:
> 1. Promoveran un turismo diverso e inclusivo [...]
> 2. Adoptaran las medidas e iniciativas necesarias para fomentar y apoyar el turismo orientado al publico LGTBI y a sus familiares.
> 3. Incluiran el turismo LGTBI dentro de los planes y proyectos de planificacion, promocion y fomento del turismo [...]"

**Por que B es la respuesta INCORRECTA (y por tanto la correcta):**
La opcion B dice "**Elaboraran campanas de prevencion de la violencia** en los planes o proyectos turisticos orientados a la integracion del publico LGTBI." Esta funcion **no aparece** en el art. 42 de la Ley 4/2023. El articulo se centra en la promocion, visibilizacion e inclusion del turismo LGTBI, no en la prevencion de la violencia dentro del ambito turistico. Las campanas contra la violencia se regulan en otros articulos de la ley.

**Por que las demas SI aparecen en el art. 42:**

- **A)** "Promoveran un turismo diverso e inclusivo donde se visibilice a las personas LGTBI [...] con especial enfasis en el **medio rural**." **Correcto**: reproduce literalmente el art. 42.1.

- **C)** "Incluiran el turismo LGTBI dentro de los **planes y proyectos de planificacion, promocion y fomento** del turismo [...]" **Correcto**: reproduce el art. 42.3.

- **D)** "Adoptaran las medidas e iniciativas necesarias para **fomentar y apoyar** el turismo orientado al publico LGTBI y a sus familiares." **Correcto**: reproduce el art. 42.2.

**Funciones de las AAPP en turismo LGTBI (art. 42):**

| Apartado | Funcion |
|----------|---------|
| 42.1 | Turismo diverso e inclusivo, enfasis en medio rural |
| 42.2 | Fomentar y apoyar turismo LGTBI y familiares |
| 42.3 | Incluir turismo LGTBI en planes de planificacion |
| ~~42.?~~ | ~~Campanas de prevencion de violencia~~ (no existe) |

**Clave:** El art. 42 regula la **promocion** del turismo LGTBI (visibilizar, incluir, fomentar), no la **prevencion de violencia** en el ambito turistico.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "a0e3fd3f-8d62-4097-b394-999d7398d1b3");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 4/2023 art.42 turismo LGTBI (" + exp2.length + " chars)");

  // #3 - LO 3/1981 art.5 vacante Defensor del Pueblo expiración plazo
  const exp3 = `**Articulo 5 de la LO 3/1981 - Cese y vacante del Defensor del Pueblo:**

> Art. 5.2: "La vacante en el cargo se declarara por el **Presidente del Congreso** en los casos de **muerte, renuncia y expiracion del plazo** del mandato. En los demas casos se decidira, por mayoria de las **tres quintas partes** de los componentes de cada Camara, mediante debate y previa audiencia del interesado."

**Por que A es correcta (Presidente del Congreso):**
Cuando la vacante del DP se produce por **expiracion del plazo** de su nombramiento, la declaracion de vacante la realiza el **Presidente del Congreso** unilateralmente. Es un acto automatico que no requiere votacion ni debate, ya que el cese es por una causa objetiva (fin del mandato de 5 anos).

**Por que las demas son incorrectas:**

- **B)** "Conjuntamente por los **Presidentes del Congreso y Senado**." Falso: el art. 5.2 atribuye esta competencia unicamente al Presidente del Congreso, no a ambos Presidentes de forma conjunta. El DP es un "alto comisionado de las Cortes Generales" (art. 54 CE), pero la declaracion de vacante corresponde solo al Presidente del Congreso.

- **C)** "Por el **Rey**." Falso: el Rey no interviene en la declaracion de vacante del DP. El nombramiento del DP es competencia de las Cortes (no del Rey), y la vacante la declara el Presidente del Congreso.

- **D)** "Por el **Presidente del Gobierno**." Falso: el Presidente del Gobierno no tiene competencia alguna sobre la declaracion de vacante del DP. El DP es un organo del Parlamento, independiente del Gobierno.

**Cese del Defensor del Pueblo (art. 5 LO 3/1981):**

| Causa de cese | Quien declara la vacante |
|---------------|--------------------------|
| Muerte, renuncia, **expiracion del plazo** | **Presidente del Congreso** (automatico) |
| Negligencia notoria, condena penal | 3/5 de cada Camara (con debate y audiencia) |

**Clave:** Expiracion del plazo = Presidente del Congreso declara la vacante. Las causas "cualificadas" (negligencia, condena) requieren mayoria de 3/5 de cada Camara.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "a70ef4d8-cf53-4729-8d8d-c88946c225f4");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - LO 3/1981 art.5 vacante DP (" + exp3.length + " chars)");
})();
