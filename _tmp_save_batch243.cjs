require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - TREBEP art.15 derechos individuales ejercidos colectivamente
  const exp1 = `**Articulos 14 y 15 del RDL 5/2015 (TREBEP) - Derechos de los empleados publicos:**

> Art. 15: "Los empleados publicos tienen los siguientes derechos **individuales que se ejercen de forma colectiva**: a) Libertad sindical. b) Negociacion colectiva. c) Huelga. d) Conflictos colectivos. e) Reunion."
>
> Art. 14.p): "[Tienen derecho] a la **libre asociacion profesional**." [Derecho individual, NO ejercido colectivamente]

**Por que D es la que NO tiene consideracion de derecho ejercido colectivamente:**
La **libre asociacion profesional** esta en el art. **14.p)** TREBEP como derecho **individual** (no colectivo). No aparece en la lista del art. 15, que enumera los derechos individuales ejercidos de forma colectiva. La asociacion profesional es un derecho que cada empleado ejerce por si mismo, a diferencia de la sindicacion, huelga o reunion que se ejercen colectivamente.

**Por que las demas SI son derechos ejercidos colectivamente (art. 15):**

- **A)** "La **libertad sindical**." **Correcto**: art. 15.a) TREBEP. La libertad sindical se ejerce colectivamente (afiliacion a sindicatos, actividad sindical).

- **B)** "El de **reunion**." **Correcto**: art. 15.e) TREBEP. El derecho de reunion se ejerce colectivamente por su propia naturaleza.

- **C)** "El ejercicio de la **huelga**." **Correcto**: art. 15.c) TREBEP. La huelga es un derecho que se ejerce de forma colectiva, con garantia de los servicios esenciales.

**Derechos individuales ejercidos colectivamente (art. 15 TREBEP):**

| Letra | Derecho |
|-------|---------|
| a) | **Libertad sindical** |
| b) | Negociacion colectiva |
| c) | **Huelga** |
| d) | Conflictos colectivos |
| e) | **Reunion** |

**NO esta en el art. 15:** La **libre asociacion profesional** (art. 14.p) es derecho individual, no ejercido colectivamente.

**Clave:** El art. 15 tiene 5 derechos (sindical, negociacion, huelga, conflictos, reunion). La libre asociacion profesional esta en el art. 14 como derecho individual puro. No confundir libertad sindical (art. 15.a, colectivo) con asociacion profesional (art. 14.p, individual).`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "c15ee8fd-cf72-49c4-a67e-f1acdf5223e2");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - TREBEP art.15 derechos colectivos (" + exp1.length + " chars)");

  // #2 - CE art.61 diferencia juramento Rey vs Príncipe heredero
  const exp2 = `**Articulo 61 de la Constitucion Espanola - Juramentos del Rey y del Principe heredero:**

> Art. 61.1: "El Rey, al ser proclamado ante las Cortes Generales, prestara juramento de desempenar fielmente sus funciones, **guardar y hacer guardar la Constitucion** y las leyes y **respetar los derechos** de los ciudadanos y de las Comunidades Autonomas."
>
> Art. 61.2: "El Principe heredero [...] prestara **el mismo juramento**, asi como el de **fidelidad al Rey**."

**Por que C es correcta (fidelidad al Rey):**
La diferencia entre ambos juramentos es que el Principe heredero, ademas de prestar **el mismo juramento** que el Rey (guardar la Constitucion, respetar derechos, etc.), debe prestar tambien juramento de **fidelidad al Rey**. Este juramento adicional de fidelidad es lo que distingue el juramento del Principe del juramento del Rey.

**Por que las demas son incorrectas:**

- **A)** "El Principe debe prestar juramento de respeto a la **Casa Real**." Falso: el art. 61.2 dice "fidelidad **al Rey**", no "respeto a la Casa Real". El objeto de la fidelidad es la persona del Rey, no la institucion de la Casa Real.

- **B)** "El Rey debe prestar juramento de **guardar y hacer guardar** la Constitucion." Parcialmente verdadero pero **no es una diferencia**: el Rey si jura guardar la Constitucion (art. 61.1), pero el Principe tambien, porque presta "el mismo juramento" (art. 61.2). No es algo exclusivo del Rey, sino comun a ambos.

- **D)** "El Rey debe prestar juramento de **respetar los derechos** de los ciudadanos." Misma razon que B: es cierto que el Rey jura respetar los derechos (art. 61.1), pero el Principe presta "el mismo juramento", por lo que tambien lo jura. No es una diferencia entre ambos.

**Comparacion de juramentos (art. 61 CE):**

| Contenido del juramento | Rey | Principe heredero |
|------------------------|-----|-------------------|
| Desempenar fielmente funciones | **Si** | **Si** (mismo juramento) |
| Guardar Constitucion y leyes | **Si** | **Si** (mismo juramento) |
| Respetar derechos ciudadanos/CCAA | **Si** | **Si** (mismo juramento) |
| **Fidelidad al Rey** | No aplica | **Si (diferencia)** |

**Clave:** La unica diferencia es que el Principe jura "fidelidad al Rey" (art. 61.2). Todo lo demas es comun a ambos juramentos.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "398f35d6-c940-487a-bde1-6bb25a952477");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.61 juramento Rey Principe (" + exp2.length + " chars)");
})();
