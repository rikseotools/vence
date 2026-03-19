require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.62 Secretarios de Estado mision
  const exp1 = `**Articulo 62.2 de la Ley 40/2015:**

> "Los Secretarios de Estado dirigen y coordinan las Direcciones Generales situadas bajo su dependencia, y responden ante el Ministro de la ejecucion de los objetivos fijados para la Secretaria de Estado. A tal fin les corresponde: [...] **Ejercer las competencias inherentes a su responsabilidad de direccion** y, en particular, **impulsar la consecucion de los objetivos** y la ejecucion de los proyectos de su organizacion, controlando su cumplimiento, **supervisando la actividad de los organos directivos** adscritos e **impartiendo instrucciones a sus titulares**."

**Por que A es correcta (Secretarios de Estado):**
El art. 62.2 atribuye expresamente esta mision a los Secretarios de Estado. Son organos superiores (art. 55.4) situados entre el Ministro y las Direcciones Generales. Su funcion principal es la direccion ejecutiva de un sector de actividad gubernamental.

**Por que las demas son incorrectas:**

- **B)** "Los Ministros". Falso: los Ministros tienen funciones de rango superior (art. 61): fijar los objetivos del Ministerio, aprobar planes de actuacion, resolver recursos, etc. Los Ministros **fijan** los objetivos; los SE **impulsan su consecucion**. El Ministro no "supervisa organos directivos adscritos" porque esa funcion intermedia es del SE.

- **C)** "Los Subsecretarios". Falso: los Subsecretarios (art. 63) tienen funciones diferentes: representacion ordinaria del Ministerio, direccion de servicios comunes, jefatura del personal, inspeccion de servicios. No dirigen Direcciones Generales sustantivas, sino los servicios internos.

- **D)** "Los Directores Generales". Falso: los Directores Generales (art. 66) son precisamente los organos que el SE supervisa. Estan **bajo** la dependencia del SE, no por encima. Un DG no "supervisa organos directivos adscritos" porque el es un organo directivo supervisado.

**Jerarquia de la AGE (organos superiores y directivos):**

| Nivel | Organo | Funcion principal |
|-------|--------|-------------------|
| Superior | **Ministro** | Fijar objetivos, potestad reglamentaria |
| Superior | **Secretario de Estado** | Impulsar objetivos, supervisar DG |
| Directivo | Subsecretario | Servicios comunes, jefatura personal |
| Directivo | Director General | Gestion sectorial |

**Clave:** SE = impulsar objetivos + supervisar organos directivos. El Ministro fija, el SE impulsa, el DG ejecuta.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "b5c48eb5-1db4-409d-9ded-50f0562f1dfc");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.62 SE mision (" + exp1.length + " chars)");

  // #2 - Ley 40/2015 art.63 Subsecretarios control eficacia
  const exp2 = `**Articulo 63.1.b) de la Ley 40/2015:**

> "Corresponde a los Subsecretarios: [...] b) **Asistir al Ministro en el control de eficacia** del Ministerio y sus Organismos publicos."

**Por que B es correcta (asistir al Ministro en control de eficacia):**
El art. 63.1.b) atribuye expresamente esta funcion a los Subsecretarios. El control de eficacia consiste en evaluar si los organos del Ministerio cumplen sus objetivos. El Subsecretario **asiste** al Ministro en esta tarea (no la ejerce en solitario).

**Por que las demas son incorrectas (son competencias de los Ministros, no de los Subsecretarios):**

- **A)** "Aprobar las propuestas de los estados de gastos del Ministerio y de los presupuestos de los Organismos publicos dependientes y remitirlas al Ministerio de Hacienda". Falso: esta es competencia del **Ministro** (art. 61.c). La aprobacion de estados de gastos y presupuestos es una decision de rango superior que corresponde al titular del Departamento.

- **C)** "Resolver los recursos administrativos y declarar la lesividad de los actos administrativos". Falso: esta es competencia del **Ministro** (art. 61.f y g). Resolver recursos y declarar lesividad son actos de autoridad maxima dentro del Ministerio.

- **D)** "Nombrar y separar a los titulares de los organos directivos del Ministerio y de los Organismos publicos". Falso: esta es competencia del **Ministro** (art. 61.b), salvo que corresponda al Consejo de Ministros. El nombramiento de altos cargos directivos es una prerrogativa del Ministro.

**Competencias clave del Subsecretario (art. 63):**
- Representacion ordinaria del Ministerio
- **Asistir al Ministro en control de eficacia**
- Programas de inspeccion de servicios
- Asesoramiento tecnico
- Jefatura superior del personal
- Direccion de servicios comunes

**Clave:** El Subsecretario asiste y apoya; el Ministro decide (presupuestos, nombramientos, recursos). Las opciones A, C y D son competencias ministeriales del art. 61.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "54bca8e3-0d56-4030-a84b-bdf471768306");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - Ley 40/2015 art.63 Subsecretarios eficacia (" + exp2.length + " chars)");

  // #3 - Ley 40/2015 art.62 funciones SE (incorrecta = resolver recursos)
  const exp3 = `**Articulo 62.2 de la Ley 40/2015 (funciones de los Secretarios de Estado):**

> "A tal fin les corresponde: a) Dirigir y coordinar las Direcciones Generales [...]; b) Nombrar y separar a los **Subdirectores Generales** de la Secretaria de Estado; c) **Autorizar las comisiones de servicio** con derecho a indemnizacion [...]; d) **Celebrar contratos** relativos a asuntos de su Secretaria de Estado y los convenios no reservados al Ministro [...]"

**Por que A es la que NO corresponde a los SE (y por tanto la respuesta):**
"Resolver los recursos administrativos y declarar la lesividad de los actos administrativos" **NO** es funcion de los Secretarios de Estado. Esta competencia pertenece a los **Ministros** (art. 61.f y g). Resolver recursos implica la autoridad maxima dentro del Ministerio, algo que corresponde al titular del Departamento, no a sus organos inferiores.

**Por que las demas SI son funciones de los SE (art. 62.2):**

- **B)** "Autorizar las comisiones de servicio con derecho a indemnizacion por cuantia exacta para los altos cargos dependientes de la Secretaria de Estado". **SI**: art. 62.2.c). Los SE autorizan comisiones de servicio de los altos cargos bajo su dependencia.

- **C)** "Celebrar contratos relativos a asuntos de su Secretaria de Estado y los convenios no reservados al Ministro del que dependan". **SI**: art. 62.2.d). Los SE pueden contratar en materias de su sector, siempre que no esten reservados al Ministro.

- **D)** "Nombrar y separar a los Subdirectores Generales de la Secretaria de Estado". **SI**: art. 62.2.b). Los SE nombran Subdirectores Generales (un nivel por debajo de Director General).

**Quien resuelve recursos y declara lesividad:**

| Competencia | Organo | Articulo |
|-------------|--------|----------|
| Resolver recursos administrativos | **Ministro** | Art. 61.f |
| Declarar lesividad | **Ministro** | Art. 61.g |
| Nombrar Subdirectores Generales | Secretario de Estado | Art. 62.2.b |
| Autorizar comisiones de servicio | Secretario de Estado | Art. 62.2.c |
| Celebrar contratos y convenios | Secretario de Estado | Art. 62.2.d |

**Clave:** Resolver recursos y declarar lesividad = Ministro (art. 61). Los SE nombran, autorizan comisiones y celebran contratos, pero no resuelven recursos.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "9277b110-6ad0-4e6f-9958-073339b7a57d");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - Ley 40/2015 art.62 SE funcion incorrecta (" + exp3.length + " chars)");
})();
