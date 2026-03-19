require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 39/2015 art.128 reglamentos no pueden tipificar infracciones
  const exp1 = `**Articulo 128.2 de la Ley 39/2015 (LPAC) - Potestad reglamentaria:**

> "Los reglamentos [...] no podran **tipificar delitos, faltas o infracciones administrativas**, establecer penas o sanciones, asi como tributos, exacciones parafiscales u otras cargas o prestaciones personales o patrimoniales de caracter publico."

**Por que D es la opcion que NO puede regularse por reglamento:**
La **tipificacion de infracciones administrativas** esta reservada a la **ley** (principio de reserva de ley sancionadora). El art. 128.2 LPAC prohibe expresamente que los reglamentos tipifiquen infracciones o establezcan sanciones. Esta reserva deriva del art. 25.1 CE: "Nadie puede ser condenado o sancionado por acciones u omisiones que [...] no constituyan delito, falta o infraccion administrativa, segun la legislacion vigente."

**Por que las demas SI pueden regularse por reglamento:**

- **A)** "Procedimientos administrativos". SI: los reglamentos pueden regular aspectos procedimentales, siempre que respeten el procedimiento comun de la LPAC. Muchos procedimientos especiales se desarrollan reglamentariamente.

- **B)** "Organizacion de servicios publicos". SI: la potestad de autoorganizacion es una competencia tipica del reglamento. Los Reales Decretos regulan frecuentemente la estructura de los Ministerios y sus organos.

- **C)** "Publicidad institucional". SI: la publicidad institucional puede regularse por reglamento (desarrollo de la Ley 29/2005 de Publicidad y Comunicacion Institucional).

**Materias prohibidas al reglamento (art. 128.2):**
- Tipificar **delitos**, faltas o **infracciones** administrativas
- Establecer **penas** o **sanciones**
- Crear **tributos**, exacciones o cargas publicas

**Clave:** Infracciones y sanciones = reserva de ley. Los reglamentos pueden regular procedimientos, organizacion y servicios, pero no castigar.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "9f025a7f-1ae6-4e9b-82f8-7dc96d3b9bd6");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 39/2015 art.128 infracciones ley (" + exp1.length + " chars)");

  // #2 - LOTC art.8 Secciones despacho ordinario y admisibilidad
  const exp2 = `**Articulo 8.1 de la LOTC (LO 2/1979) - Secciones del Tribunal Constitucional:**

> "Para el **despacho ordinario** y la decision o propuesta, segun proceda, sobre la **admisibilidad o inadmisibilidad** de procesos constitucionales, el Pleno y las Salas constituiran **Secciones** compuestas por el respectivo Presidente o quien le sustituya y dos Magistrados."

**Por que D es correcta (las Secciones):**
Las Secciones del TC son los organos encargados del trabajo cotidiano: el **despacho ordinario** (tramitacion diaria) y la decision sobre **admisibilidad e inadmisibilidad** de los procesos constitucionales. Cada Seccion se compone de 3 miembros (Presidente + 2 Magistrados).

**Por que las demas son incorrectas (tienen otras funciones):**

- **A)** "El Pleno". Falso: el Pleno (12 magistrados) conoce de los asuntos mas importantes: recursos de inconstitucionalidad, conflictos de competencias, recusaciones de magistrados, etc. (art. 10 LOTC). No se ocupa del despacho ordinario ni de la admision.

- **B)** "La Sala 1.a". Falso: las Salas (6 magistrados cada una) conocen principalmente de los **recursos de amparo** (art. 11 LOTC). La Sala 1.a es presidida por el Presidente del TC. No es el organo de despacho ordinario.

- **C)** "La Sala 2.a". Falso: al igual que la Sala 1.a, la Sala 2.a conoce de recursos de amparo. Es presidida por el Vicepresidente. Tampoco se ocupa del despacho ordinario.

**Estructura del TC y funciones:**

| Organo | Composicion | Funcion principal |
|--------|-------------|-------------------|
| Pleno | 12 magistrados | Inconstitucionalidad, conflictos |
| Salas (1.a y 2.a) | 6 magistrados | Recursos de amparo |
| **Secciones** | **3 magistrados** | **Despacho ordinario + admisibilidad** |

**Clave:** Secciones = despacho ordinario + admisibilidad/inadmisibilidad. No confundir con Pleno (grandes asuntos) ni Salas (amparo).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "489e1e78-7d1c-4aee-8f31-379a3410e8d0");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - LOTC art.8 Secciones despacho (" + exp2.length + " chars)");
})();
