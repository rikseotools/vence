require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // #1 - Ley 40/2015 art.58 Ministerios SE y SG pueden existir no obligatorias
  const exp1 = `**Articulo 58 de la Ley 40/2015 - Organizacion interna de los Ministerios:**

> Art. 58.1: "En los Ministerios **pueden existir** Secretarias de Estado, y Secretarias Generales, para la gestion de un sector de actividad administrativa."
>
> Art. 58.2: "Los Ministerios contaran, **en todo caso**, con una Subsecretaria, y dependiendo de ella una Secretaria General Tecnica."

**Por que B es la opcion INCORRECTA (y por tanto la respuesta):**
La opcion B dice "En **todos** los Ministerios existiran Secretarias de Estado y Secretarias Generales". Falso: el art. 58.1 dice que "**pueden** existir", lo que significa que son **potestativas**, no obligatorias. No todos los Ministerios tienen SE o SG.

**La clave es la diferencia verbal:**
- "**Pueden** existir" (art. 58.1) = facultativo (SE y SG)
- "Contaran, **en todo caso**" (art. 58.2) = obligatorio (Subsecretaria y SGT)

**Por que las demas SI son correctas:**

- **A)** "Las Direcciones Generales son organos de gestion de una o varias areas funcionalmente homogeneas". **SI**: art. 58.**3** lo dice textualmente.

- **C)** "En todos los Ministerios existira una Subsecretaria, y dependiendo de ella una SGT". **SI**: art. 58.**2** dice "contaran, en todo caso" = obligatorio.

- **D)** "Las Subdirecciones Generales dependeran de las DG o podran adscribirse directamente a otros organos directivos de mayor nivel o a organos superiores". **SI**: art. 58.**4** lo recoge.

**Estructura obligatoria vs potestativa de los Ministerios:**

| Organo | Obligatorio | Articulo |
|--------|-------------|----------|
| Subsecretaria | SI ("en todo caso") | Art. 58.2 |
| SGT | SI (depende de la Subsecretaria) | Art. 58.2 |
| Secretaria de Estado | **NO** ("pueden existir") | Art. 58.1 |
| Secretaria General | **NO** ("pueden existir") | Art. 58.1 |

**Clave:** "Pueden existir" (SE, SG) ≠ "en todo caso" (Subsecretaria, SGT). No todos los Ministerios tienen SE ni SG.`;

  const { error: e1 } = await supabase.from("questions").update({ explanation: exp1 }).eq("id", "22b5c805-b27b-4b68-baa2-97ea52dd2075");
  console.log(e1 ? "Error 1: " + e1.message : "OK 1 - Ley 40/2015 art.58 SE SG pueden (" + exp1.length + " chars)");

  // #2 - CE Titulo I 5 capitulos
  const exp2 = `**Titulo I de la Constitucion Espanola: "De los derechos y deberes fundamentales" (arts. 10-55)**

Se estructura en **5 capitulos**:

> **Cap. I** - De los espanoles y los extranjeros (arts. 11-13)
> **Cap. II** - Derechos y libertades (arts. 14-38)
>   - Seccion 1.a: Derechos fundamentales y libertades publicas (arts. 15-29)
>   - Seccion 2.a: Derechos y deberes de los ciudadanos (arts. 30-38)
> **Cap. III** - Principios rectores de la politica social y economica (arts. 39-52)
> **Cap. IV** - Garantias de las libertades y derechos fundamentales (arts. 53-54)
> **Cap. V** - Suspension de los derechos y libertades (art. 55)

**Por que C es correcta (5 capitulos):**
Contando los capitulos: I (espanoles y extranjeros) + II (derechos y libertades) + III (principios rectores) + IV (garantias) + V (suspension) = **5**.

**Por que las demas son incorrectas:**

- **A)** "6 capitulos". Falso: solo hay 5. El error puede venir de contar las dos **secciones** del Cap. II como capitulos separados, pero las secciones estan **dentro** del Cap. II, no son capitulos independientes.

- **B)** "3 capitulos". Falso: son 5, no 3. Esta opcion reduce drasticamente la estructura del Titulo I.

- **D)** "4 capitulos". Falso: son 5, no 4. Podria confundirse si se olvida el Cap. V (suspension, que tiene un solo articulo: el 55).

**Clave:** 5 capitulos. Las 2 secciones del Cap. II no son capitulos aparte. Y el Cap. V existe aunque solo tenga un articulo (art. 55).`;

  const { error: e2 } = await supabase.from("questions").update({ explanation: exp2 }).eq("id", "fa78e0de-0a87-40e5-ba46-ce61c0eff2a1");
  console.log(e2 ? "Error 2: " + e2.message : "OK 2 - CE Titulo I 5 capitulos (" + exp2.length + " chars)");

  // #3 - CE art.148 CCAA competencia asistencia social vs art.149 Estado
  const exp3 = `**Articulo 148.1 de la Constitucion Espanola - Competencias de las CCAA:**

> Art. 148.1.**20.a**: Las Comunidades Autonomas podran asumir competencias en "**Asistencia social**."

**Por que C es correcta (asistencia social):**
La asistencia social figura expresamente en el listado del art. 148.1 CE como competencia que las CCAA pueden asumir (numero 20.a). De hecho, todas las CCAA la han asumido en sus Estatutos de Autonomia, siendo una de las competencias mas claramente autonomicas.

**Por que las demas son incorrectas (son competencias exclusivas del Estado, art. 149.1):**

- **A)** "Administracion de Justicia". Falso: es competencia **exclusiva del Estado** segun el art. **149.1.5.a** CE. La Administracion de Justicia es unica en todo el territorio nacional, aunque las CCAA pueden colaborar en medios materiales y personales.

- **B)** "Legislacion basica sobre proteccion del medio ambiente". Falso: es competencia del **Estado** segun el art. **149.1.23.a** CE: "Legislacion **basica** sobre proteccion del medio ambiente". Las CCAA pueden establecer normas adicionales de proteccion, pero la legislacion basica es estatal.

- **D)** "Legislacion laboral". Falso: es competencia **exclusiva del Estado** segun el art. **149.1.7.a** CE. Las CCAA pueden ejecutar la legislacion laboral, pero no legislar sobre ella.

**Art. 148 (CCAA) vs Art. 149 (Estado):**

| Materia | Competencia | Articulo |
|---------|-------------|----------|
| **Asistencia social** | **CCAA** | **Art. 148.1.20.a** |
| Administracion de Justicia | Estado | Art. 149.1.5.a |
| Legislacion basica medio ambiente | Estado | Art. 149.1.23.a |
| Legislacion laboral | Estado | Art. 149.1.7.a |

**Clave:** Asistencia social = CCAA (art. 148). Las demas opciones son competencias exclusivas del Estado (art. 149). No confundir el listado del 148 con el del 149.`;

  const { error: e3 } = await supabase.from("questions").update({ explanation: exp3 }).eq("id", "3d688da0-ad7f-4227-8ae0-bb97424568d6");
  console.log(e3 ? "Error 3: " + e3.message : "OK 3 - CE art.148 asistencia social CCAA (" + exp3.length + " chars)");
})();
