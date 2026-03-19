require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - CE estado de sitio NO es instrumento del Gobierno
  const exp1 = `**Articulo 116.4 de la Constitucion Espanola:**

> "El estado de sitio sera declarado por la **mayoria absoluta del Congreso** de los Diputados, a propuesta exclusiva del Gobierno."

**Por que D es la respuesta (NO es un instrumento del Gobierno):**
El estado de sitio lo **declara el Congreso**, no el Gobierno. El Gobierno solo puede **proponerlo**, pero la decision final corresponde al Congreso por mayoria absoluta. Por tanto, declarar el estado de sitio **no es un instrumento** del Gobierno para ejercer la direccion politica.

**Por que las demas SI son instrumentos del Gobierno:**

- **A)** "Subordinacion de las Fuerzas y Cuerpos de Seguridad". **SI**: el art. **104.1** CE establece que las FCS "tendran como mision proteger el libre ejercicio de los derechos y libertades [...] **bajo la dependencia del Gobierno**". Es un instrumento de direccion politica.

- **B)** "Elaboracion de los Presupuestos Generales". **SI**: el art. **134.1** CE dice "Corresponde al **Gobierno** la elaboracion de los Presupuestos Generales del Estado". Es una competencia exclusiva gubernamental.

- **C)** "Dictar Decretos-Leyes". **SI**: el art. **86.1** CE permite al **Gobierno** dictar disposiciones legislativas provisionales en caso de extraordinaria y urgente necesidad. Es un instrumento legislativo del Gobierno.

**Estados excepcionales y quien los declara (art. 116 CE):**

| Estado | Quien declara | Papel del Gobierno |
|--------|--------------|-------------------|
| Alarma | **Gobierno** (decreto) | Declara directamente |
| Excepcion | **Gobierno** con autorizacion del Congreso | Declara, pero necesita permiso |
| Sitio | **Congreso** por mayoria absoluta | Solo propone |

**Clave:** El Gobierno declara alarma, propone excepcion y sitio. Pero el estado de sitio lo **declara el Congreso**, no el Gobierno.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "78d7d70e-6a7c-4def-a9be-a42f5da6a914");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - CE estado sitio no Gobierno (" + exp1.length + " chars)");

  // #2 - CE art.70 inelegibilidad excepcion miembros del Gobierno
  const exp2 = `**Articulo 70.1 de la Constitucion Espanola - Inelegibilidad:**

> "La ley electoral determinara las causas de inelegibilidad [...] que comprenderan, en todo caso:
> a) A los componentes del Tribunal Constitucional.
> b) A los altos cargos de la Administracion del Estado [...] **con la excepcion de los miembros del Gobierno**.
> c) Al Defensor del Pueblo.
> d) A los Magistrados, Jueces y Fiscales en activo.
> e) A los militares profesionales y miembros de las FCS en activo.
> f) A los miembros de las Juntas Electorales."

**Por que C es correcta (miembros del Gobierno SI pueden ser elegidos):**
El art. 70.1.b CE excluye a los altos cargos de la Administracion de ser elegidos como Diputados o Senadores, pero hace una **excepcion expresa**: los **miembros del Gobierno**. Esto tiene logica constitucional: un ministro puede ser simultaneamente diputado o senador, ya que la CE no establece incompatibilidad entre ambos cargos.

**Por que las demas son incorrectas (son inelegibles):**

- **A)** "Miembros del Tribunal Constitucional". Falso: son **inelegibles** segun el art. 70.1.**a**. Los magistrados del TC no pueden ser simultameamente Diputados o Senadores, para garantizar su independencia e imparcialidad.

- **B)** "Defensor del Pueblo". Falso: es **inelegible** segun el art. 70.1.**c**. El Defensor del Pueblo es un alto comisionado de las Cortes y no puede ser parlamentario para preservar su neutralidad.

- **D)** "Ninguna de las respuestas anteriores es correcta". Falso: la opcion C si es correcta, porque los miembros del Gobierno son la excepcion expresa del art. 70.1.b.

**Inelegibles vs elegibles (art. 70.1 CE):**

| Cargo | Elegible |
|-------|----------|
| Miembros del TC | No (art. 70.1.a) |
| Altos cargos AGE | No (art. 70.1.b) |
| **Miembros del Gobierno** | **Si (excepcion del 70.1.b)** |
| Defensor del Pueblo | No (art. 70.1.c) |
| Jueces y Fiscales en activo | No (art. 70.1.d) |

**Clave:** Los miembros del Gobierno son la unica excepcion expresa a la inelegibilidad de altos cargos. Un ministro puede ser diputado o senador.`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "672e69fb-7fe5-4a57-b328-3b0912ce4644");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE art.70 Gobierno elegible (" + exp2.length + " chars)");

  // #3 - CE art.116.1 ley organica regula estados excepcionales
  const exp3 = `**Articulo 116.1 de la Constitucion Espanola:**

> "Una **ley organica** regulara los estados de alarma, de excepcion y de sitio, y las competencias y limitaciones correspondientes."

**Por que A es correcta (Ley organica):**
El art. 116.1 CE reserva la regulacion de los estados excepcionales a una **ley organica**. Esta ley es la **LO 4/1981, de 1 de junio**, de los estados de alarma, excepcion y sitio. La reserva a ley organica se justifica porque estos estados afectan a **derechos fundamentales** (pueden suspenderlos o limitarlos), y la CE exige ley organica para el desarrollo de los derechos del Titulo I (art. 81.1 CE).

**Por que las demas son incorrectas:**

- **B)** "Un Decreto-Ley". Falso: los Decretos-Leyes (art. 86 CE) no pueden regular esta materia por dos razones: (1) el art. 116.1 exige expresamente "ley organica"; (2) el art. 86.1 prohibe que los Decretos-Leyes afecten a derechos, deberes y libertades del Titulo I.

- **C)** "Un Real Decreto". Falso: un Real Decreto es una norma reglamentaria del Gobierno. No tiene rango de ley y no puede regular materias reservadas a ley organica. Nota: el estado de **alarma** se declara mediante Real Decreto (art. 116.2), pero eso es la declaracion, no la regulacion general de los estados excepcionales.

- **D)** "Una Ley ordinaria". Falso: la CE dice expresamente "ley **organica**", no ley ordinaria. La diferencia es relevante: la ley organica requiere **mayoria absoluta del Congreso** para su aprobacion (art. 81.2 CE), mientras que la ley ordinaria solo requiere mayoria simple.

**Clave:** Regulacion de estados excepcionales = ley organica (art. 116.1). No confundir con la declaracion: la alarma se declara por decreto, pero la regulacion general siempre es por ley organica (LO 4/1981).`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "27b39247-96a0-4f12-846d-83226e9bca8e");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.116.1 LO estados excepcionales (" + exp3.length + " chars)");
})();
